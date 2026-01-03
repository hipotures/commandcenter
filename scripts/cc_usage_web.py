#!/usr/bin/env python3
import argparse
import html
import json
import logging
import os
import re
import subprocess
import sys
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, WebDriverException
from selenium.webdriver.common.by import By

# Load environment variables from .env file
load_dotenv()

DEFAULT_CDP_ENDPOINT = "http://localhost:9222"
DEFAULT_EMAIL_URL = "https://claude.ai/settings/general"
DEFAULT_USAGE_URL = "https://claude.ai/settings/usage"
DEFAULT_EMAIL_LABEL = "What should Claude call you?"
DEFAULT_OUTDIR = "/tmp/claude-stats"
DEFAULT_CHROME_PROFILE = os.path.expanduser("~/DEV/ms-playwright/claude")

# Telegram notification setup
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")
API_BASE = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}" if TELEGRAM_TOKEN else None

# State tracking: alert only on state changes (error -> ok, ok -> error)
STATE_FILE = Path("/tmp/cc_usage_web_state.json")


def _chunks(s: str, n: int):
    """Split string into chunks of size n."""
    for i in range(0, len(s), n):
        yield s[i : i + n]


def load_state():
    """Load previous state from file."""
    try:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text())
    except Exception:
        pass
    return {"status": "unknown", "error": None, "timestamp": None}


def save_state(status, error=None):
    """Save current state to file."""
    try:
        state = {
            "status": status,
            "error": error,
            "timestamp": datetime.now().isoformat(),
        }
        STATE_FILE.write_text(json.dumps(state, indent=2))
    except Exception:
        pass


def should_send_alert(current_status, current_error):
    """Check if we should send alert based on state change."""
    prev_state = load_state()
    prev_status = prev_state.get("status")

    # State changed from error to ok
    if prev_status == "error" and current_status == "ok":
        return "recovery"

    # State changed from ok/unknown to error
    if prev_status in ["ok", "unknown"] and current_status == "error":
        return "new_error"

    # Same error persists - no alert
    if prev_status == "error" and current_status == "error":
        prev_error = prev_state.get("error")
        if prev_error == current_error:
            return None

    return None


def send_telegram_log(title: str, text: str) -> None:
    """Send log message to Telegram in chunks if needed."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return

    # 2 KiB limit (2048 bytes) - use 1800 chars for safety with HTML tags
    chunk_size = 1800
    escaped = html.escape(text)

    for idx, part in enumerate(_chunks(escaped, chunk_size), start=1):
        t = title if idx == 1 else f"{title} (cont. {idx})"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": f"<b>{html.escape(t)}</b>\n<pre>{part}</pre>",
            "parse_mode": "HTML",
            "link_preview_options": {"is_disabled": True},
            "disable_notification": True,
        }
        try:
            r = requests.post(f"{API_BASE}/sendMessage", json=payload, timeout=5)
            r.raise_for_status()
            data = r.json()
            if not data.get("ok"):
                raise RuntimeError(data)
        except Exception as e:
            print(f"Failed to send Telegram notification: {e}", file=sys.stderr)


class TelegramErrorHandler(logging.Handler):
    """Logging handler that sends ERROR level messages to Telegram on state change."""

    def __init__(self, level=logging.ERROR, verbose=False):
        super().__init__(level)
        self.verbose = verbose

    def emit(self, record: logging.LogRecord) -> None:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            message = record.getMessage()
            error_key = f"{record.filename}:{record.lineno}:{message}"

            # Check if we should send alert based on state change
            alert_type = should_send_alert("error", error_key)

            if alert_type == "new_error":
                # Format error message - limit to 200 chars
                formatted = f"⚠️ Error {timestamp}\n{record.filename}:{record.lineno}\n{message[:150]}"

                send_telegram_log("🔴 CC_USAGE_WEB", formatted)
                save_state("error", error_key)
                if self.verbose:
                    print(f"[Telegram] Error alert sent (state: {STATE_FILE})", file=sys.stderr)
            elif alert_type is None:
                # Same error - just update timestamp
                save_state("error", error_key)
                if self.verbose:
                    print(f"[Telegram] Same error - alert suppressed (state: {STATE_FILE})", file=sys.stderr)

        except Exception:
            self.handleError(record)


# Configure logger
logger = logging.getLogger("cc_usage_web")
logger.setLevel(logging.INFO)

# Telegram handler will be added in main() with verbose flag


def log(message, verbose):
    if not verbose:
        return
    stamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{stamp}] {message}", file=sys.stderr)


def format_timestamp():
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def xpath_literal(text):
    if "'" not in text:
        return f"'{text}'"
    if '"' not in text:
        return f'"{text}"'
    parts = text.split("'")
    pieces = []
    for idx, part in enumerate(parts):
        if part:
            pieces.append(f"'{part}'")
        if idx != len(parts) - 1:
            pieces.append("\"'\"")
    return f"concat({', '.join(pieces)})"


def convert_web_reset_format(web_format):
    """Convert web format to CLI format with timezone."""
    if not web_format:
        return ""

    now = datetime.now()
    tz_name = now.astimezone().tzname()

    # Handle "in X hr Y min" format
    relative_match = re.match(r"^in\s+(?:(\d+)\s*hr?)?\s*(?:(\d+)\s*min)?", web_format, re.IGNORECASE)
    if relative_match:
        hours = int(relative_match.group(1)) if relative_match.group(1) else 0
        minutes = int(relative_match.group(2)) if relative_match.group(2) else 0
        reset_date = now + timedelta(hours=hours, minutes=minutes)

        hour = reset_date.hour
        minute = reset_date.minute
        ampm = "pm" if hour >= 12 else "am"
        hour = hour % 12 or 12

        return f"{hour}:{minute:02d}{ampm} ({tz_name})"

    # Handle "Mon 12:00 PM" format
    weekday_match = re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})\s*(AM|PM)", web_format, re.IGNORECASE)
    if weekday_match:
        weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        target_day = weekdays.index(weekday_match.group(1))
        hour = int(weekday_match.group(2))
        minute = int(weekday_match.group(3))
        ampm = weekday_match.group(4).lower()

        if ampm == "pm" and hour != 12:
            hour += 12
        if ampm == "am" and hour == 12:
            hour = 0

        current_day = now.weekday()
        days_ahead = target_day - current_day
        if days_ahead <= 0:
            days_ahead += 7

        reset_date = now + timedelta(days=days_ahead)
        reset_date = reset_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month = months[reset_date.month - 1]
        day = reset_date.day

        display_hour = reset_date.hour
        display_ampm = "pm" if display_hour >= 12 else "am"
        display_hour = display_hour % 12 or 12

        return f"{month} {day}, {display_hour}:{reset_date.minute:02d}{display_ampm} ({tz_name})"

    # Already in CLI format or unknown - return as is
    return web_format


def parse_usage_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    section = None
    weekly_all_models = False
    session_used = ""
    session_resets = ""
    weekly_used = ""
    weekly_resets = ""

    for line in lines:
        if line == "Current session":
            section = "session"
            continue
        if line == "Weekly limits":
            section = "weekly"
            weekly_all_models = False
            continue
        if line.startswith("Current week"):
            section = "weekly"
            weekly_all_models = True
            continue
        if section == "weekly" and line == "All models":
            weekly_all_models = True
            continue

        if section == "session":
            if not session_resets and line.startswith("Resets "):
                session_resets = line.replace("Resets ", "", 1)
                continue
            if not session_used:
                match = re.search(r"\b\d{1,3}%\s*used\b", line)
                if match:
                    session_used = match.group(0)
                    continue

        if section == "weekly" and weekly_all_models:
            if not weekly_resets and line.startswith("Resets "):
                weekly_resets = line.replace("Resets ", "", 1)
                continue
            if not weekly_used:
                match = re.search(r"\b\d{1,3}%\s*used\b", line)
                if match:
                    weekly_used = match.group(0)
                    continue

    return {
        "session_used": session_used,
        "session_resets": convert_web_reset_format(session_resets),
        "weekly_used": weekly_used,
        "weekly_resets": convert_web_reset_format(weekly_resets),
    }




def cleanup_stale_lock(profile_dir):
    """Remove Chrome profile lock if process is dead."""
    lock_path = Path(profile_dir) / "SingletonLock"
    if not lock_path.exists():
        return

    try:
        target = lock_path.read_text().strip()
        if "-" in target:
            pid = int(target.split("-")[-1])
            # Check if process exists
            try:
                os.kill(pid, 0)  # Signal 0 just checks if process exists
                # Process exists - lock is valid
                return
            except OSError:
                # Process doesn't exist - remove stale lock
                lock_path.unlink()
    except Exception:
        # Can't read or parse lock - remove it
        try:
            lock_path.unlink()
        except Exception:
            pass


def build_driver(profile_dir, headless):
    try:
        # Clean up stale locks before starting
        cleanup_stale_lock(profile_dir)

        options = webdriver.ChromeOptions()
        options.add_argument(f"--user-data-dir={profile_dir}")

        # Cache directory for faster page loading
        cache_dir = "/tmp/chrome-cache"
        options.add_argument(f"--disk-cache-dir={cache_dir}")

        # Fast page loading - don't wait for images/stylesheets
        options.page_load_strategy = "eager"

        # Headless mode
        if headless:
            options.add_argument("--headless")

        # Standard options
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=3840,2160")

        # Enhanced anti-detection measures (bypass Cloudflare)
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # Additional stealth options
        options.add_argument("--disable-features=VizDisplayCompositor")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-background-networking")

        # Only disable images in headless mode for performance
        if headless:
            options.add_argument("--disable-images")

        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-default-apps")

        # Real user agent
        options.add_argument(
            "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        # Debug: show Chrome command
        args_list = [arg for arg in options.arguments]
        print(f"[DEBUG] Chrome arguments: {args_list}", file=sys.stderr)
        print(f"[DEBUG] Profile dir: {profile_dir}", file=sys.stderr)
        print(f"[DEBUG] Experimental options: {options.experimental_options}", file=sys.stderr)

        driver = webdriver.Chrome(options=options)

        # Setup anti-detection JavaScript
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
        driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']})")
        driver.execute_script("Object.defineProperty(navigator, 'permissions', {get: () => undefined})")
        driver.execute_script("window.chrome = { runtime: {} }")

        return driver
    except Exception as e:
        logger.exception(f"Failed to initialize Chrome driver: {e}")
        raise


def wait_for_email_input(driver, email_label, timeout_s):
    label = xpath_literal(email_label)
    xpaths = [
        f"//*[@aria-label={label}]",
        f"//*[@placeholder={label}]",
        f"//label[normalize-space()={label}]/following::input[1]",
        f"//label[normalize-space()={label}]/following::textarea[1]",
        f"//*[normalize-space()={label}]/following::input[1]",
        f"//*[normalize-space()={label}]/following::textarea[1]",
    ]

    start = time.time()
    while time.time() - start < timeout_s:
        for xpath in xpaths:
            try:
                element = driver.find_element(By.XPATH, xpath)
                if element:
                    return element
            except NoSuchElementException:
                continue
        time.sleep(0.2)
    return None


def wait_for_text_in_main(driver, text, timeout_s):
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            main = driver.find_element(By.TAG_NAME, "main")
            if text in main.text:
                return main
        except NoSuchElementException:
            pass
        time.sleep(0.2)
    return None


def capture_login_snapshot(driver, outdir, stamp):
    html_path = Path(outdir) / f"login-snapshot-{stamp}.html"
    png_path = Path(outdir) / f"login-snapshot-{stamp}.png"
    html_path.write_text(driver.page_source, encoding="utf-8")
    try:
        driver.save_screenshot(str(png_path))
    except WebDriverException:
        png_path = None
    return html_path, png_path


def scrape_with_selenium(
    profile_dir,
    outdir,
    email_url,
    usage_url,
    email_label,
    timeout_s,
    verbose,
):
    driver = build_driver(profile_dir, headless=True)
    stamp = format_timestamp()
    logfile = str(Path(outdir) / f"usage-web-{stamp}.txt")

    try:
        log(f"Headless: {email_url}", verbose)
        driver.get(email_url)

        if "/login" in driver.current_url or "/signup" in driver.current_url:
            snapshot_html, snapshot_png = capture_login_snapshot(
                driver, outdir, stamp
            )
            # Not an error - user is simply logged out
            return {
                "status": "not_logged_in",
                "logfile": str(snapshot_html),
                "snapshot_html": str(snapshot_html),
                "snapshot_png": str(snapshot_png) if snapshot_png else None,
            }

        email_input = wait_for_email_input(driver, email_label, timeout_s)
        if not email_input:
            snapshot_html, snapshot_png = capture_login_snapshot(
                driver, outdir, stamp
            )
            # Not an error - user is simply logged out
            return {
                "status": "not_logged_in",
                "logfile": str(snapshot_html),
                "snapshot_html": str(snapshot_html),
                "snapshot_png": str(snapshot_png) if snapshot_png else None,
            }

        email_value = (email_input.get_attribute("value") or "").strip()
        if not email_value:
            # This is an actual error - logged in but can't read email
            logger.error("Failed to parse email value from input field (logged in but email field empty)")
            return {"status": "failed_to_parse_email", "logfile": logfile}

        log(f"Headless: {usage_url}", verbose)
        driver.get(usage_url)
        main = wait_for_text_in_main(driver, "Plan usage limits", timeout_s)
        if not main:
            # This is an actual error - logged in but usage page won't load
            logger.error(f"Failed to load usage page within {timeout_s}s timeout (logged in but page timeout)")
            return {"status": "failed_to_load_usage", "logfile": logfile}

        main_text = main.text
        Path(logfile).write_text(main_text, encoding="utf-8")

        parsed = parse_usage_text(main_text)
        if not parsed["session_used"] or not parsed["weekly_used"]:
            # This is an actual error - page loaded but parsing failed
            logger.error(
                f"Failed to parse usage data. session_used={parsed['session_used']}, weekly_used={parsed['weekly_used']}, logfile={logfile}"
            )
            return {"status": "failed_to_parse_usage", "logfile": logfile}

        payload = {
            "current_session": {
                "used": parsed["session_used"],
                "resets": parsed["session_resets"],
            },
            "current_week_all_models": {
                "used": parsed["weekly_used"],
                "resets": parsed["weekly_resets"],
            },
            "email": email_value,
            "logfile": logfile,
        }
        return {"status": "ok", "payload": payload}
    except Exception as e:
        logger.exception(f"Unexpected error in scrape_with_selenium: {e}")
        return {"status": "unexpected_error", "logfile": logfile}
    finally:
        try:
            driver.quit()
        except Exception:
            pass


def run_visible_login(profile_dir, email_url, email_label, timeout_s, verbose):
    driver = build_driver(profile_dir, headless=False)
    try:
        log(f"Login browser: {email_url}", verbose)
        driver.get(email_url)

        email_input = wait_for_email_input(driver, email_label, timeout_s)
        if email_input:
            log("Email field detected. Close the browser when done.", verbose)
        else:
            log("Login page displayed. Close the browser after logging in.", verbose)

        while True:
            try:
                _ = driver.title
            except WebDriverException:
                break
            time.sleep(1)
    finally:
        try:
            driver.quit()
        except Exception:
            pass


def log_to_db(payload, verbose):
    if os.environ.get("CC_USAGE_LOG_DB", "1") == "0":
        return 0
    script_dir = Path(__file__).resolve().parent
    logger_path = os.environ.get(
        "CC_USAGE_LOGGER", str(script_dir / "cc_usage_logger.py")
    )
    db_path = os.environ.get(
        "CC_USAGE_DB_PATH",
        str(Path.home() / ".claude" / "db" / "cc_usage.db"),
    )
    cmd = [sys.executable, logger_path, "--db", db_path]
    if verbose:
        cmd.append("--verbose")
    result = subprocess.run(
        cmd,
        input=json.dumps(payload, ensure_ascii=True),
        text=True,
    )
    return result.returncode


def run_cdp_mode(args):
    """Run CDP mode using Python playwright"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        error_msg = "Playwright not installed. Run: uv sync"
        logger.error(error_msg)
        print(error_msg, file=sys.stderr)
        print("{}")
        return 1

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    stamp = format_timestamp()
    logfile = str(outdir / f"usage-web-{stamp}.txt")

    try:
        log(f"Connecting to CDP: {args.cdp_endpoint}", args.verbose)

        with sync_playwright() as p:
            try:
                browser = p.chromium.connect_over_cdp(args.cdp_endpoint)
            except Exception as cdp_error:
                error_msg = f"Failed to connect to CDP endpoint {args.cdp_endpoint}"
                logger.error(f"{error_msg}: {cdp_error}")
                print("{}")
                return 1
            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = context.pages[0] if context.pages else context.new_page()

            # Navigate to email settings
            log(f"Navigating to {args.email_url}", args.verbose)
            page.goto(args.email_url, timeout=int(args.timeout * 1000))
            page.wait_for_load_state("domcontentloaded")

            # Check if logged in
            if "/login" in page.url or "/signup" in page.url:
                log("Not logged in; login page detected.", args.verbose)
                print("{}")
                return 1

            # Get email - try textbox with exact label match
            email = None
            try:
                # Try playwright role selector - exact match
                email_input = page.get_by_role("textbox", name=args.email_label)
                email = email_input.input_value(timeout=5000)
                log(f"Found email using role selector", args.verbose)
            except Exception:
                # Fallback: try various XPath approaches
                label = args.email_label
                xpaths = [
                    f"//*[@aria-label='{label}']",
                    f"//*[@placeholder='{label}']",
                    f"//label[normalize-space()='{label}']/following::input[1]",
                    f"//label[normalize-space()='{label}']/following::textarea[1]",
                    f"//*[normalize-space()='{label}']/following::input[1]",
                    f"//*[normalize-space()='{label}']/following::textarea[1]",
                ]

                for xpath in xpaths:
                    try:
                        email_input = page.locator(f"xpath={xpath}").first
                        email = email_input.input_value(timeout=5000)
                        if email:
                            log(f"Found email using: {xpath}", args.verbose)
                            break
                    except Exception:
                        continue

            if not email:
                logger.error("Failed to get email")
                print("{}")
                return 1

            # Navigate to usage page
            log(f"Navigating to {args.usage_url}", args.verbose)
            page.goto(args.usage_url, timeout=int(args.timeout * 1000))
            page.wait_for_load_state("domcontentloaded")

            # Wait for usage content
            log("Waiting for usage content", args.verbose)
            try:
                page.wait_for_selector("text=Plan usage limits", timeout=int(args.timeout * 1000))
            except Exception as e:
                logger.error(f"Usage page didn't load: {e}")
                print("{}")
                return 1

            # Get main content
            main = page.locator("main").first
            main_text = main.inner_text()
            Path(logfile).write_text(main_text, encoding="utf-8")

            # Parse usage
            parsed = parse_usage_text(main_text)
            if not parsed["session_used"] or not parsed["weekly_used"]:
                logger.error(
                    f"Failed to parse usage data. session_used={parsed['session_used']}, weekly_used={parsed['weekly_used']}, logfile={logfile}"
                )
                print("{}")
                return 1

            # Build payload
            payload = {
                "current_session": {
                    "used": parsed["session_used"],
                    "resets": parsed["session_resets"],
                },
                "current_week_all_models": {
                    "used": parsed["weekly_used"],
                    "resets": parsed["weekly_resets"],
                },
                "email": email,
                "logfile": logfile,
            }

            # Output JSON
            print(json.dumps(payload, ensure_ascii=True))

            # Check for recovery alert
            alert_type = should_send_alert("ok", None)
            if alert_type == "recovery":
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                recovery_msg = f"✅ Claude Usage Scraper - Recovered\n\n"
                recovery_msg += f"Time: {timestamp}\n"
                recovery_msg += f"Status: System is working correctly (CDP mode)\n"
                recovery_msg += f"Email: {payload.get('email', 'N/A')}\n"
                send_telegram_log("🟢 CC_USAGE_WEB RECOVERY", recovery_msg)
                log("Recovery alert sent to Telegram", args.verbose)

            save_state("ok", None)

            # Log to DB
            log_to_db(payload, args.verbose)

            return 0

    except Exception as e:
        logger.exception(f"Error in CDP mode: {e}")
        print("{}")
        return 1


def main():
    env_timeout_ms = os.environ.get("TIMEOUT_MS")
    default_timeout = 45.0
    if env_timeout_ms:
        try:
            default_timeout = float(env_timeout_ms) / 1000.0
        except ValueError:
            pass

    parser = argparse.ArgumentParser(
        description="Collect Claude usage via Selenium or CDP."
    )
    parser.add_argument("--cdp", action="store_true", help="Use CDP mode.")
    parser.add_argument(
        "--cdp-endpoint",
        default=os.environ.get("CDP_ENDPOINT", DEFAULT_CDP_ENDPOINT),
        help="CDP endpoint (default: http://localhost:9222).",
    )
    parser.add_argument(
        "--profile",
        default=os.environ.get("CHROME_PROFILE", DEFAULT_CHROME_PROFILE),
        help="Chrome user data dir for Selenium.",
    )
    parser.add_argument(
        "--outdir",
        default=os.environ.get("OUTDIR", DEFAULT_OUTDIR),
        help="Output directory.",
    )
    parser.add_argument(
        "--email-url",
        default=os.environ.get("EMAIL_URL", DEFAULT_EMAIL_URL),
        help="Settings URL for email.",
    )
    parser.add_argument(
        "--usage-url",
        default=os.environ.get("TARGET_URL", DEFAULT_USAGE_URL),
        help="Settings URL for usage.",
    )
    parser.add_argument(
        "--email-label",
        default=os.environ.get("EMAIL_LABEL", DEFAULT_EMAIL_LABEL),
        help="Label for the email input.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=default_timeout,
        help="Timeout in seconds.",
    )
    parser.add_argument("--verbose", action="store_true", help="Verbose logs.")
    args = parser.parse_args()

    # Configure Telegram handler with verbose flag
    if TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
        telegram_handler = TelegramErrorHandler(level=logging.ERROR, verbose=args.verbose)
        logger.addHandler(telegram_handler)

    if args.cdp:
        return run_cdp_mode(args)

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    profile_dir = str(Path(args.profile).expanduser())

    attempts = 0
    login_attempted = False
    while attempts < 2:
        attempts += 1
        result = scrape_with_selenium(
            profile_dir=profile_dir,
            outdir=str(outdir),
            email_url=args.email_url,
            usage_url=args.usage_url,
            email_label=args.email_label,
            timeout_s=args.timeout,
            verbose=args.verbose,
        )

        status = result.get("status")
        if status == "ok":
            payload = result["payload"]
            print(json.dumps(payload, ensure_ascii=True))

            # Check for recovery alert
            alert_type = should_send_alert("ok", None)
            if alert_type == "recovery":
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                recovery_msg = f"✅ Claude Usage Scraper - Recovered\n\n"
                recovery_msg += f"Time: {timestamp}\n"
                recovery_msg += f"Status: System is working correctly\n"
                recovery_msg += f"Email: {payload.get('email', 'N/A')}\n"
                send_telegram_log("🟢 CC_USAGE_WEB RECOVERY", recovery_msg)
                log("Recovery alert sent to Telegram", args.verbose)

            save_state("ok", None)

            log_status = log_to_db(payload, args.verbose)
            if log_status != 0:
                return log_status
            return 0

        if status == "not_logged_in" and not login_attempted:
            login_attempted = True
            snapshot_html = result.get("snapshot_html")
            snapshot_png = result.get("snapshot_png")
            message = f"Not logged in. Snapshot: {snapshot_html or 'n/a'}"
            if snapshot_png:
                message = f"{message} {snapshot_png}"
            print(message, file=sys.stderr)
            run_visible_login(
                profile_dir=profile_dir,
                email_url=args.email_url,
                email_label=args.email_label,
                timeout_s=args.timeout,
                verbose=args.verbose,
            )
            time.sleep(1)
            continue

        # Only log actual errors to Telegram (not logout scenarios)
        if status == "not_logged_in":
            # Not logged in - return empty JSON
            print("{}")
        else:
            # Real error - send to Telegram
            logger.error(
                f"Scraping failed with status: {status or 'unknown_error'}, logfile: {result.get('logfile', 'n/a')}"
            )
            print("{}")
        return 1

    # Failed to login after 2 attempts - return empty JSON
    print("{}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

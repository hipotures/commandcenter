#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, WebDriverException
from selenium.webdriver.common.by import By

DEFAULT_CDP_ENDPOINT = "http://localhost:9222"
DEFAULT_EMAIL_URL = "https://claude.ai/settings/general"
DEFAULT_USAGE_URL = "https://claude.ai/settings/usage"
DEFAULT_EMAIL_LABEL = "What should Claude call you?"
DEFAULT_OUTDIR = "/tmp/claude-stats"
DEFAULT_CHROME_PROFILE = os.path.expanduser("~/DEV/ms-playwright/claude")


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
        "session_resets": session_resets,
        "weekly_used": weekly_used,
        "weekly_resets": weekly_resets,
    }


def print_error(error, logfile, extra=None):
    payload = {"error": error, "logfile": logfile}
    if extra:
        payload.update(extra)
    print(json.dumps(payload, ensure_ascii=True))


def build_driver(profile_dir, headless):
    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={profile_dir}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    if headless:
        options.add_argument("--headless=new")
    options.page_load_strategy = "eager"
    return webdriver.Chrome(options=options)


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
            return {
                "status": "not_logged_in",
                "logfile": str(snapshot_html),
                "snapshot_html": str(snapshot_html),
                "snapshot_png": str(snapshot_png) if snapshot_png else None,
            }

        email_value = (email_input.get_attribute("value") or "").strip()
        if not email_value:
            return {"status": "failed_to_parse_email", "logfile": logfile}

        log(f"Headless: {usage_url}", verbose)
        driver.get(usage_url)
        main = wait_for_text_in_main(driver, "Plan usage limits", timeout_s)
        if not main:
            return {"status": "failed_to_load_usage", "logfile": logfile}

        main_text = main.text
        Path(logfile).write_text(main_text, encoding="utf-8")

        parsed = parse_usage_text(main_text)
        if not parsed["session_used"] or not parsed["weekly_used"]:
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
    script_dir = Path(__file__).resolve().parent
    script_path = script_dir / "cc_usage_playwright.js"
    if not script_path.exists():
        print(
            f"Missing script for CDP mode: {script_path}",
            file=sys.stderr,
        )
        return 1

    env = os.environ.copy()
    env["CDP_ENDPOINT"] = args.cdp_endpoint
    env["TARGET_URL"] = args.usage_url
    env["EMAIL_URL"] = args.email_url
    env["EMAIL_LABEL"] = args.email_label
    env["OUTDIR"] = args.outdir
    env["TIMEOUT_MS"] = str(int(args.timeout * 1000))
    if args.verbose:
        env["VERBOSE"] = "1"

    return subprocess.run(
        ["node", str(script_path)],
        env=env,
    ).returncode


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

        print_error(status or "unknown_error", result.get("logfile", ""))
        return 1

    print_error("failed_to_login", "")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

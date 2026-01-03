#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let playwright;
try {
  playwright = require('playwright');
} catch (err) {
  try {
    playwright = require('playwright-core');
  } catch (coreErr) {
    console.error(
      'Playwright is not installed. Install playwright or playwright-core to use this script.',
    );
    process.exit(1);
  }
}

const { chromium } = playwright;

const SCRIPT_DIR = __dirname;

const OUTDIR = process.env.OUTDIR || '/tmp/claude-stats';
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://localhost:9222';
const TARGET_URL = process.env.TARGET_URL || 'https://claude.ai/settings/usage';
const EMAIL_URL = process.env.EMAIL_URL || 'https://claude.ai/settings/general';
const EMAIL_LABEL =
  process.env.EMAIL_LABEL || 'What should Claude call you?';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || '45000');
const VERBOSE = process.env.VERBOSE === '1';

const CC_USAGE_LOG_DB = process.env.CC_USAGE_LOG_DB !== '0';
const CC_USAGE_DB_PATH =
  process.env.CC_USAGE_DB_PATH ||
  path.join(process.env.HOME || '', '.claude', 'db', 'cc_usage.db');
const CC_USAGE_LOGGER =
  process.env.CC_USAGE_LOGGER || path.join(SCRIPT_DIR, 'cc_usage_logger.py');

function usage() {
  console.log(`Usage: node scripts/cc_usage_playwright.js

Env vars:
  CDP_ENDPOINT       CDP endpoint (default: http://localhost:9222)
  TARGET_URL         URL to open (default: https://claude.ai/settings/usage)
  EMAIL_URL          URL for profile email (default: https://claude.ai/settings/general)
  EMAIL_LABEL        Label for email field (default: What should Claude call you?)
  TIMEOUT_MS         Timeout in ms (default: 45000)
  OUTDIR             Where to save usage text (default: /tmp/claude-stats)
  VERBOSE            Set to 1 for verbose logs
  CC_USAGE_LOG_DB    Set to 0 to disable sqlite logging
  CC_USAGE_DB_PATH   Override sqlite db path
  CC_USAGE_LOGGER    Override logger path
`);
}

function log(message) {
  if (!VERBOSE) return;
  const now = new Date();
  const stamp = now.toTimeString().split(' ')[0];
  console.error(`[${stamp}] ${message}`);
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function parseUsageText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let section = null;
  let weeklyAllModels = false;

  let sessionUsed = '';
  let sessionResets = '';
  let weeklyUsed = '';
  let weeklyResets = '';

  for (const line of lines) {
    if (line === 'Current session') {
      section = 'session';
      continue;
    }
    if (line === 'Weekly limits') {
      section = 'weekly';
      weeklyAllModels = false;
      continue;
    }
    if (line.startsWith('Current week')) {
      section = 'weekly';
      weeklyAllModels = true;
      continue;
    }
    if (section === 'weekly' && line === 'All models') {
      weeklyAllModels = true;
      continue;
    }

    if (section === 'session') {
      if (!sessionResets && line.startsWith('Resets ')) {
        sessionResets = line.replace(/^Resets\s+/, '');
        continue;
      }
      if (!sessionUsed) {
        const match = line.match(/\b\d{1,3}%\s*used\b/);
        if (match) {
          sessionUsed = match[0].replace(/\s+/g, ' ');
          continue;
        }
      }
    }

    if (section === 'weekly' && weeklyAllModels) {
      if (!weeklyResets && line.startsWith('Resets ')) {
        weeklyResets = line.replace(/^Resets\s+/, '');
        continue;
      }
      if (!weeklyUsed) {
        const match = line.match(/\b\d{1,3}%\s*used\b/);
        if (match) {
          weeklyUsed = match[0].replace(/\s+/g, ' ');
          continue;
        }
      }
    }
  }

  return {
    sessionUsed,
    sessionResets,
    weeklyUsed,
    weeklyResets,
  };
}

function printError(error, logfile) {
  const payload = {
    error,
    logfile,
  };
  console.log(JSON.stringify(payload));
}

async function disconnectBrowser(browser) {
  if (!browser) return;
  if (typeof browser.disconnect === 'function') {
    await browser.disconnect();
  } else if (typeof browser.close === 'function') {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  fs.mkdirSync(OUTDIR, { recursive: true });
  const ts = formatTimestamp(new Date());
  const logfile = path.join(OUTDIR, `usage-web-${ts}.txt`);

  log(`Connecting to CDP: ${CDP_ENDPOINT}`);
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const context = browser.contexts()[0];
  if (!context) {
    await disconnectBrowser(browser);
    printError('no_browser_context', logfile);
    process.exit(1);
  }

  const page = await context.newPage();

  try {
    log(`Navigating to ${EMAIL_URL}`);
    await page.goto(EMAIL_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    const emailInput = page.getByLabel(EMAIL_LABEL);
    await emailInput.waitFor({ timeout: TIMEOUT_MS });
    const email = (await emailInput.inputValue()).trim();
    if (!email) {
      printError('failed_to_parse_email', logfile);
      process.exit(1);
    }

    log(`Navigating to ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

    log('Waiting for usage content');
    await page.getByText('Plan usage limits').waitFor({ timeout: TIMEOUT_MS });
    await page.getByText('Current session').waitFor({ timeout: TIMEOUT_MS });

    const mainText = await page.locator('main').innerText();
    fs.writeFileSync(logfile, mainText, 'utf8');

    const parsed = parseUsageText(mainText);
    if (!parsed.sessionUsed || !parsed.weeklyUsed) {
      printError('failed_to_parse_usage', logfile);
      process.exit(1);
    }

    const payload = {
      current_session: {
        used: parsed.sessionUsed,
        resets: parsed.sessionResets,
      },
      current_week_all_models: {
        used: parsed.weeklyUsed,
        resets: parsed.weeklyResets,
      },
      email,
      logfile,
    };

    const jsonOutput = JSON.stringify(payload);
    console.log(jsonOutput);

    if (CC_USAGE_LOG_DB) {
      log(`Logging to sqlite: ${CC_USAGE_DB_PATH}`);
      const result = spawnSync(
        'python3',
        [CC_USAGE_LOGGER, '--db', CC_USAGE_DB_PATH],
        {
          input: jsonOutput,
          encoding: 'utf8',
          stdio: VERBOSE ? 'inherit' : ['pipe', 'inherit', 'inherit'],
        },
      );
      if (result.status !== 0) {
        process.exit(result.status || 1);
      }
    }
  } catch (err) {
    printError('navigation_or_parse_failed', logfile);
    if (VERBOSE) {
      console.error(err);
    }
    process.exit(1);
  } finally {
    try {
      await page.close();
    } catch (err) {
      if (VERBOSE) {
        console.error('Failed to close page:', err);
      }
    }
    await disconnectBrowser(browser);
  }
}

main().catch((err) => {
  printError('unexpected_error', '');
  if (VERBOSE) {
    console.error(err);
  }
  process.exit(1);
});

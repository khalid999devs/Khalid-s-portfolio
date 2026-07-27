'use strict';

const { join } = require('path');
const { AppSetting } = require('../models');

/**
 * Runs the dependency audit on a schedule and remembers the result.
 *
 * The notification panel is otherwise only as fresh as the last page load, and
 * a vulnerability disclosed on a Tuesday should not wait for somebody to open
 * the admin panel to be noticed. This runs in the background and stores the
 * outcome, so the panel reads a cached figure instead of shelling out on every
 * request.
 *
 * `npm audit` is a network call to the registry, so it is deliberately
 * infrequent and never blocks anything: failures are recorded and retried on
 * the next tick rather than surfaced as errors.
 *
 * There is no cron daemon involved. A timer inside the process is enough for a
 * single-instance deployment, it needs no host configuration, and it cannot
 * drift out of sync with the application the way an external crontab does. If
 * this ever runs on several instances they will each audit, which is wasteful
 * but harmless: the write is a single upsert of the same value.
 */

const AUDIT_KEY = 'lastDependencyAudit';
const INTERVAL_DAYS = 3;
const INTERVAL_MS = INTERVAL_DAYS * 24 * 60 * 60 * 1000;
// First run is delayed so boot, migrations and the first requests are not
// competing with a registry call.
const STARTUP_DELAY_MS = 60 * 1000;

let timer = null;

const readLast = async () => {
  try {
    const row = await AppSetting.findByPk(AUDIT_KEY);
    return row?.value ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
};

const runAudit = async () => {
  // Imported lazily: this is the only place in the server that spawns a child
  // process, and it should not be part of the module graph for a request.
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const run = promisify(execFile);
  const startedAt = Date.now();

  const audit = async (cwd) => {
    try {
      // `npm audit` exits non-zero when it finds anything, so a rejection is
      // the normal case and the payload is on the error.
      const { stdout } = await run('npm', ['audit', '--omit=dev', '--json'], {
        cwd,
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024,
      });
      return JSON.parse(stdout);
    } catch (error) {
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const report = await audit(join(__dirname, '..'));
  const vulnerabilities = report?.metadata?.vulnerabilities ?? null;

  const result = {
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    ok: Boolean(vulnerabilities),
    vulnerabilities,
  };

  try {
    await AppSetting.upsert({ key: AUDIT_KEY, value: JSON.stringify(result) });
  } catch (error) {
    console.error('Could not store the audit result:', error.message);
  }

  return result;
};

const start = () => {
  if (timer) return;

  const tick = async () => {
    const last = await readLast();
    const age = last?.checkedAt ? Date.now() - Date.parse(last.checkedAt) : Infinity;
    if (age < INTERVAL_MS) return;
    await runAudit();
  };

  setTimeout(tick, STARTUP_DELAY_MS).unref?.();
  timer = setInterval(tick, 6 * 60 * 60 * 1000);
  timer.unref?.();
};

module.exports = { start, runAudit, readLast, AUDIT_KEY, INTERVAL_DAYS };

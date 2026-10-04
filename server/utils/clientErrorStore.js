'use strict';

const { lstatSync, mkdirSync, readFileSync } = require('fs');
const { rename, writeFile } = require('fs/promises');
const { tmpdir } = require('os');
const { dirname, join } = require('path');

// Browser error reports, held in memory and mirrored to one private file.
// One entry per distinct error; a repeat bumps `count`. No IP address, no cookie data.

const MAXIMUM_ENTRIES = 100;

// Outside the application folder, which the web server serves as static files.
const DEFAULT_FILE = join(tmpdir(), 'portfolio-api', 'client-errors.json');

// A directory someone else owns or can write to is not used.
const isPrivateDirectory = (directory) => {
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stats = lstatSync(directory);
    if (!stats.isDirectory()) return false;
    if (typeof process.getuid !== 'function') return true;
    return stats.uid === process.getuid() && (stats.mode & 0o022) === 0;
  } catch {
    return false;
  }
};

const isEntry = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.fingerprint === 'string' &&
  typeof value.message === 'string' &&
  Number.isInteger(value.count) &&
  typeof value.lastSeenAt === 'string';

const createStore = (file = DEFAULT_FILE) => {
  const entries = new Map();
  let ready = false;
  let persistent = false;
  let writing = null;
  let stale = false;

  const open = () => {
    if (ready) return;
    ready = true;
    persistent = isPrivateDirectory(dirname(file));
    if (!persistent) return;

    try {
      const stored = JSON.parse(readFileSync(file, 'utf8'));
      if (!Array.isArray(stored)) return;
      for (const entry of stored.filter(isEntry).slice(-MAXIMUM_ENTRIES)) {
        entries.set(entry.fingerprint, entry);
      }
    } catch {
      // No file yet, or one that is not ours to trust.
    }
  };

  const write = async () => {
    // Whole file to a sibling, then renamed, so a reader never sees half of it.
    const temporary = `${file}.${process.pid}.tmp`;
    do {
      stale = false;
      try {
        await writeFile(temporary, JSON.stringify([...entries.values()]), { mode: 0o600 });
        await rename(temporary, file);
      } catch (error) {
        console.error('Could not save client errors:', error.message);
      }
    } while (stale);
    writing = null;
  };

  /** Resolves once the file matches memory. One write at a time; later changes ride along. */
  const save = () => {
    if (!persistent) return Promise.resolve();
    stale = true;
    writing ??= write();
    return writing;
  };

  const oldest = () => {
    let found = null;
    for (const entry of entries.values()) {
      if (!found || entry.lastSeenAt < found.lastSeenAt) found = entry;
    }
    return found;
  };

  /** Stores a normalised report, or counts it against the entry it repeats. */
  const record = (report, now = new Date()) => {
    open();
    const seenAt = now.toISOString();
    const known = entries.get(report.fingerprint);

    if (known) {
      // A repeat refreshes what describes the latest report and nothing else.
      known.count += 1;
      known.lastSeenAt = seenAt;
      known.userAgent = report.userAgent;
      known.path = report.path;
      known.viewport = report.viewport;
      known.build = report.build;
    } else {
      entries.set(report.fingerprint, {
        ...report,
        count: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
      while (entries.size > MAXIMUM_ENTRIES) entries.delete(oldest().fingerprint);
    }

    return save();
  };

  /** Newest first. */
  const list = (limit = MAXIMUM_ENTRIES) => {
    open();
    return [...entries.values()]
      .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1))
      .slice(0, limit);
  };

  /** Returns how many entries were removed. */
  const clear = () => {
    open();
    const removed = entries.size;
    entries.clear();
    save();
    return removed;
  };

  /** What the notification bell needs about errors seen since `since` (ms). */
  const summary = (since) => {
    open();
    let distinct = 0;
    let reports = 0;
    let worst = null;

    for (const entry of entries.values()) {
      if (Date.parse(entry.lastSeenAt) < since) continue;
      distinct += 1;
      reports += entry.count;
      const more = worst && entry.count === worst.count
        ? entry.lastSeenAt > worst.lastSeenAt
        : !worst || entry.count > worst.count;
      if (more) worst = entry;
    }

    return { distinct, reports, worst };
  };

  return { record, list, clear, summary };
};

module.exports = createStore();
module.exports.createStore = createStore;
module.exports.MAXIMUM_ENTRIES = MAXIMUM_ENTRIES;

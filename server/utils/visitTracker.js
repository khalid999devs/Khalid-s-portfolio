'use strict';

const { createHash, randomBytes } = require('crypto');
const { Op } = require('sequelize');
const { Visit, AppSetting } = require('../models');

/**
 * Records page views without making the visitor wait for it.
 *
 * Two rules shape this file:
 *
 * 1. It must never block or fail a request. A visitor should never see an error
 *    or a slower page because analytics had a bad day, so writes are queued and
 *    flushed on a timer, and every failure is swallowed after being logged.
 * 2. It must not identify anyone. There is no IP, no user agent string, no
 *    cookie. The visitor hash exists only to distinguish a refresh from a new
 *    arrival, and its salt is regenerated daily and never persisted, so the
 *    hashes cannot be correlated across days or linked to a person even by
 *    someone holding the database.
 */

const RETENTION_KEY = 'visitRetentionDays';
const DEFAULT_RETENTION_DAYS = 90;
const MINIMUM_RETENTION_DAYS = 1;
const MAXIMUM_RETENTION_DAYS = 730;

const FLUSH_INTERVAL_MS = 5000;
const MAXIMUM_QUEUE = 500;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

let queue = [];
let flushTimer = null;
let purgeTimer = null;

/** Rotates daily. Held in memory only, so a restart also rotates it. */
let salt = randomBytes(32);
let saltDay = new Date().toISOString().slice(0, 10);

const currentSalt = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== saltDay) {
    salt = randomBytes(32);
    saltDay = today;
  }
  return salt;
};

const hashVisitor = (ip, userAgent) => {
  if (!ip && !userAgent) return null;
  return createHash('sha256')
    .update(currentSalt())
    .update(String(ip ?? ''))
    .update(String(userAgent ?? ''))
    .digest('hex')
    .slice(0, 64);
};

/** Three buckets, from the client hint. Nothing finer is useful here. */
const normaliseDevice = (value) =>
  ['desktop', 'tablet', 'mobile'].includes(value) ? value : null;

/** Host only. A full referrer carries query strings and private URLs. */
const referrerHostOf = (referrer) => {
  if (typeof referrer !== 'string' || referrer === '') return null;
  try {
    return new URL(referrer).host.slice(0, 128) || null;
  } catch {
    return null;
  }
};

const flush = async () => {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await Visit.bulkCreate(batch);
  } catch (error) {
    // Dropped rather than retried. A retry queue that grows during an outage is
    // a memory leak, and these are page views, not orders.
    console.error(`Dropped ${batch.length} visit record(s):`, error.message);
  }
};

const getRetentionDays = async () => {
  try {
    const row = await AppSetting.findByPk(RETENTION_KEY);
    const parsed = Number(row?.value);
    if (!Number.isFinite(parsed)) return DEFAULT_RETENTION_DAYS;
    return Math.min(MAXIMUM_RETENTION_DAYS, Math.max(MINIMUM_RETENTION_DAYS, Math.round(parsed)));
  } catch {
    return DEFAULT_RETENTION_DAYS;
  }
};

const setRetentionDays = async (days) => {
  const clamped = Math.min(
    MAXIMUM_RETENTION_DAYS,
    Math.max(MINIMUM_RETENTION_DAYS, Math.round(Number(days)))
  );
  await AppSetting.upsert({ key: RETENTION_KEY, value: String(clamped) });
  return clamped;
};

/** Deletes anything past the retention window. Safe to call repeatedly. */
const purgeOldVisits = async () => {
  try {
    const days = await getRetentionDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const removed = await Visit.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
    if (removed > 0) {
      console.log(`Purged ${removed} visit record(s) older than ${days} days.`);
    }
    return removed;
  } catch (error) {
    console.error('Visit purge failed:', error.message);
    return 0;
  }
};

const recordVisit = ({ path, device, referrer, ip, userAgent }) => {
  if (typeof path !== 'string' || path === '') return;

  // Bounded. If the flush is failing or traffic spikes, drop new records rather
  // than grow the queue without limit.
  if (queue.length >= MAXIMUM_QUEUE) return;

  queue.push({
    path: path.slice(0, 255),
    device: normaliseDevice(device),
    referrerHost: referrerHostOf(referrer),
    visitorHash: hashVisitor(ip, userAgent),
  });
};

const start = () => {
  if (!flushTimer) {
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    // Does not hold the process open at shutdown.
    flushTimer.unref?.();
  }
  if (!purgeTimer) {
    purgeTimer = setInterval(purgeOldVisits, PURGE_INTERVAL_MS);
    purgeTimer.unref?.();
    // Once at boot too, so a server that is restarted more often than hourly
    // still prunes.
    purgeOldVisits();
  }
};

module.exports = {
  recordVisit,
  flush,
  start,
  purgeOldVisits,
  getRetentionDays,
  setRetentionDays,
  RETENTION_KEY,
  DEFAULT_RETENTION_DAYS,
  MINIMUM_RETENTION_DAYS,
  MAXIMUM_RETENTION_DAYS,
};

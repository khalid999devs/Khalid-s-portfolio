'use strict';

const { fn, col, literal, Op } = require('sequelize');
const { Visit } = require('../models');
const { BadRequestError } = require('../errors');
const {
  recordVisit,
  getRetentionDays,
  setRetentionDays,
  purgeOldVisits,
  MINIMUM_RETENTION_DAYS,
  MAXIMUM_RETENTION_DAYS,
} = require('../utils/visitTracker');

/**
 * Public write path.
 *
 * Answers 202 immediately and queues the row. The client fires this and forgets
 * it, so any work done here would be latency a visitor pays for no benefit of
 * their own.
 */
const trackVisit = (req, res) => {
  recordVisit({
    path: req.body?.path,
    device: req.body?.device,
    referrer: req.body?.referrer,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // 202 Accepted, with no body: recorded is not the same as durable, and it
  // would be dishonest to claim otherwise before the flush.
  res.status(202).end();
};

const DAYS = 30;

const startOfDayUTC = (offsetDays = 0) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
};

/** Admin read: the series and breakdowns the dashboard draws. */
const getVisitStats = async (req, res) => {
  const since = startOfDayUTC(DAYS - 1);

  const [byDay, byPath, byDevice, totals, retentionDays] = await Promise.all([
    Visit.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'day'],
        [fn('COUNT', col('id')), 'views'],
        [fn('COUNT', fn('DISTINCT', col('visitorHash'))), 'visitors'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [literal('DATE(createdAt)')],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    }),

    Visit.findAll({
      attributes: ['path', [fn('COUNT', col('id')), 'views']],
      where: { createdAt: { [Op.gte]: since } },
      group: ['path'],
      order: [[literal('COUNT(id)'), 'DESC']],
      limit: 8,
      raw: true,
    }),

    Visit.findAll({
      attributes: ['device', [fn('COUNT', col('id')), 'views']],
      where: { createdAt: { [Op.gte]: since } },
      group: ['device'],
      raw: true,
    }),

    Visit.count(),
    getRetentionDays(),
  ]);

  // Dense series, so quiet days are visible as zeroes rather than compressed
  // out of the chart.
  const series = [];
  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const day = startOfDayUTC(offset).toISOString().slice(0, 10);
    const row = byDay.find((r) => String(r.day).slice(0, 10) === day);
    series.push({
      day,
      views: Number(row?.views || 0),
      visitors: Number(row?.visitors || 0),
    });
  }

  res.json({
    succeed: true,
    result: {
      series,
      topPaths: byPath.map((r) => ({ path: r.path, views: Number(r.views) })),
      devices: byDevice.map((r) => ({
        device: r.device || 'unknown',
        views: Number(r.views),
      })),
      total: totals,
      retentionDays,
    },
    msg: 'Successfully fetched visit stats!',
  });
};

const updateRetention = async (req, res) => {
  const days = Number(req.body?.days);
  if (!Number.isFinite(days)) {
    throw new BadRequestError('A number of days is required.');
  }
  if (days < MINIMUM_RETENTION_DAYS || days > MAXIMUM_RETENTION_DAYS) {
    throw new BadRequestError(
      `Retention must be between ${MINIMUM_RETENTION_DAYS} and ${MAXIMUM_RETENTION_DAYS} days.`
    );
  }

  const applied = await setRetentionDays(days);
  // Applied immediately rather than at the next hourly sweep, so shortening the
  // window visibly does what it says.
  const removed = await purgeOldVisits();

  res.json({
    succeed: true,
    msg: `Keeping ${applied} days of visits.${removed ? ` Removed ${removed} older record(s).` : ''}`,
    result: { retentionDays: applied, removed },
  });
};

module.exports = { trackVisit, getVisitStats, updateRetention };

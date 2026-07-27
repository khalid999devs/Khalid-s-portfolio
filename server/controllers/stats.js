'use strict';

const { fn, col, literal, Op } = require('sequelize');
const { projects, DeliveryLog, AboutEntry, Admin } = require('../models');

/**
 * Numbers for the admin dashboard.
 *
 * One endpoint rather than five, because the dashboard renders them together
 * and five round trips to count five tables is silly. Everything here is a
 * COUNT or a GROUP BY on an indexed column.
 */

const DAYS_OF_HISTORY = 30;

const startOfDayUTC = (offsetDays = 0) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
};

const getStats = async (req, res) => {
  const since = startOfDayUTC(DAYS_OF_HISTORY - 1);

  const [
    projectCount,
    adminCount,
    aboutBySection,
    deliveryByStatus,
    deliveryByDay,
    mediaTotals,
  ] = await Promise.all([
    projects.count(),
    Admin.count(),

    AboutEntry.findAll({
      attributes: ['section', [fn('COUNT', col('id')), 'count']],
      group: ['section'],
      raw: true,
    }),

    DeliveryLog.findAll({
      attributes: ['channel', 'status', [fn('COUNT', col('id')), 'count']],
      group: ['channel', 'status'],
      raw: true,
    }),

    // Grouped in SQL rather than pulled into memory: this table is the one that
    // grows without bound.
    DeliveryLog.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'day'],
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: since } },
      group: [literal('DATE(createdAt)'), 'status'],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    }),


    // Media lives inside a JSON text column, so it is counted in JavaScript.
    // Three rows; a JSON_TABLE query would be harder to read for no gain.
    projects.findAll({
      attributes: ['thumbnailContents', 'sliderContents', 'videos'],
      raw: true,
    }),
  ]);

  const countJson = (value) => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const media = mediaTotals.reduce(
    (acc, row) => ({
      thumbnails: acc.thumbnails + countJson(row.thumbnailContents),
      slides: acc.slides + countJson(row.sliderContents),
      videos: acc.videos + countJson(row.videos),
    }),
    { thumbnails: 0, slides: 0, videos: 0 }
  );

  // A dense series: every day in the window appears, including the quiet ones,
  // so a chart does not silently compress gaps and imply activity that was not
  // there.
  const series = [];
  for (let offset = DAYS_OF_HISTORY - 1; offset >= 0; offset--) {
    const day = startOfDayUTC(offset).toISOString().slice(0, 10);
    const rows = deliveryByDay.filter((r) => String(r.day).slice(0, 10) === day);
    series.push({
      day,
      succeeded: Number(rows.find((r) => r.status === 'succeeded')?.count || 0),
      failed: Number(rows.find((r) => r.status === 'failed')?.count || 0),
    });
  }

  const delivery = { email: { succeeded: 0, failed: 0 }, sms: { succeeded: 0, failed: 0 } };
  for (const row of deliveryByStatus) {
    if (delivery[row.channel]) delivery[row.channel][row.status] = Number(row.count);
  }

  res.json({
    succeed: true,
    result: {
      counts: {
        projects: projectCount,
        admins: adminCount,
        about: aboutBySection.reduce(
          (acc, row) => ({ ...acc, [row.section]: Number(row.count) }),
          { experience: 0, education: 0, achievement: 0 }
        ),
        media,
      },
      delivery,
      series,
    },
    msg: 'Successfully fetched dashboard stats!',
  });
};

module.exports = { getStats };

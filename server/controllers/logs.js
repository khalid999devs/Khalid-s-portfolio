'use strict';

const { Op } = require('sequelize');
const { DeliveryLog } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');

const MAXIMUM_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const CHANNELS = Object.freeze(['email', 'sms']);
const STATUSES = Object.freeze(['succeeded', 'failed', 'partial']);
const KINDS = Object.freeze(['single', 'bulk']);

/** Escapes LIKE wildcards so "%" searches for a percent sign. */
const escapeLike = (term) => term.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Shared by listing and deletion so "clear matching" removes what you see. */
const buildFilter = ({ q, channel, status, kind }) => {
  const where = {};

  if (channel) {
    if (!CHANNELS.includes(channel)) {
      throw new BadRequestError(`Channel must be one of: ${CHANNELS.join(', ')}.`);
    }
    where.channel = channel;
  }

  if (status) {
    if (!STATUSES.includes(status)) {
      throw new BadRequestError(`Status must be one of: ${STATUSES.join(', ')}.`);
    }
    where.status = status;
  }

  if (kind) {
    if (!KINDS.includes(kind)) {
      throw new BadRequestError(`Kind must be one of: ${KINDS.join(', ')}.`);
    }
    where.kind = kind;
  }

  if (typeof q === 'string' && q.trim() !== '') {
    const term = `%${escapeLike(q.trim())}%`;
    where[Op.or] = [
      { recipient: { [Op.like]: term } },
      { subject: { [Op.like]: term } },
      { mode: { [Op.like]: term } },
      { detail: { [Op.like]: term } },
      { providerCode: { [Op.like]: term } },
    ];
  }

  return where;
};

const listLogs = async (req, res) => {
  const { page: rawPage, pageSize: rawPageSize } = req.query ?? {};

  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = Math.min(
    MAXIMUM_PAGE_SIZE,
    Math.max(1, Number(rawPageSize) || DEFAULT_PAGE_SIZE)
  );

  const where = buildFilter(req.query ?? {});

  const { rows, count } = await DeliveryLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Unfiltered, for the "3 failed of 412" header. Partial counts as failed:
  // the number means "needs looking at".
  const [total, failed] = await Promise.all([
    DeliveryLog.count(),
    DeliveryLog.count({ where: { status: { [Op.in]: ['failed', 'partial'] } } }),
  ]);

  res.json({
    succeed: true,
    result: rows,
    pagination: {
      page,
      pageSize,
      matched: count,
      pages: Math.max(1, Math.ceil(count / pageSize)),
    },
    totals: { all: total, failed },
    msg: 'Successfully fetched delivery logs!',
  });
};

/**
 * Deletes listed ids, or everything matching the filter.
 * `all: true` also requires a filter, so a bare request cannot empty the table.
 */
const deleteLogs = async (req, res) => {
  const { ids, all } = req.body ?? {};

  if (all === true) {
    const where = buildFilter(req.body ?? {});

    if (Object.keys(where).length === 0 && !where[Op.or]) {
      throw new BadRequestError(
        'Refusing to delete every log. Narrow it with a channel, a status or a search first.'
      );
    }

    const removed = await DeliveryLog.destroy({ where });
    res.json({ succeed: true, msg: `Removed ${removed} log entr${removed === 1 ? 'y' : 'ies'}.`, removed });
    return;
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BadRequestError('Select at least one entry to delete.');
  }

  const numeric = ids.map(Number);
  if (numeric.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new BadRequestError('Every id must be a positive integer.');
  }

  const removed = await DeliveryLog.destroy({ where: { id: { [Op.in]: numeric } } });
  if (removed === 0) throw new NotFoundError('None of those entries exist.');

  res.json({ succeed: true, msg: `Removed ${removed} log entr${removed === 1 ? 'y' : 'ies'}.`, removed });
};

module.exports = { listLogs, deleteLogs };

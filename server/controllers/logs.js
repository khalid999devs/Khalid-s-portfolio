'use strict';

const { Op } = require('sequelize');
const { DeliveryLog } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');

const MAXIMUM_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const CHANNELS = Object.freeze(['email', 'sms']);
const STATUSES = Object.freeze(['succeeded', 'failed']);

/**
 * Escapes the wildcards MySQL's LIKE treats specially.
 *
 * Without this, a search for "%" matches every row and a search for "_" matches
 * anything. Not a security hole here because the value is still parameterised,
 * but it makes the search behave the way someone typing into a box expects.
 */
const escapeLike = (term) => term.replace(/[\\%_]/g, (char) => `\\${char}`);

const listLogs = async (req, res) => {
  const {
    q,
    channel,
    status,
    page: rawPage,
    pageSize: rawPageSize,
  } = req.query ?? {};

  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = Math.min(
    MAXIMUM_PAGE_SIZE,
    Math.max(1, Number(rawPageSize) || DEFAULT_PAGE_SIZE)
  );

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

  const { rows, count } = await DeliveryLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Counted separately from the filtered query so the panel can show "3 failed
  // of 412" without a second round trip.
  const [total, failed] = await Promise.all([
    DeliveryLog.count(),
    DeliveryLog.count({ where: { status: 'failed' } }),
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
 * Deletes specific rows, or everything matching the current filter.
 *
 * Two modes rather than one, because "clear these five" and "clear the 4,000
 * failed SMS from last month" are different jobs and sending four thousand ids
 * over the wire to do the second is silly.
 *
 * `all: true` is deliberately awkward to trigger by accident: it requires the
 * flag AND at least one filter, so a bare request cannot empty the table.
 */
const deleteLogs = async (req, res) => {
  const { ids, all, channel, status, q } = req.body ?? {};

  if (all === true) {
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

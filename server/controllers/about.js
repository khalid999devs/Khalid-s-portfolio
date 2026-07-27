'use strict';

const { Op } = require('sequelize');
const { AboutEntry } = require('../models');
const { BadRequestError, NotFoundError } = require('../errors');

const SECTIONS = Object.freeze(['experience', 'education', 'achievement']);

/**
 * Only these fields are writable, and `section` is not among them on edit.
 *
 * Moving an entry between sections through a general edit would let a bad
 * payload silently relocate content; changing section is a delete and a create.
 */
const EDITABLE_FIELDS = Object.freeze(['title', 'subtitle', 'period', 'link']);

const pick = (body) => {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body ?? {}, key)) {
      const value = body[key];
      out[key] = value === '' ? null : value;
    }
  }
  return out;
};

const assertSection = (section) => {
  if (!SECTIONS.includes(section)) {
    throw new BadRequestError(
      `Section must be one of: ${SECTIONS.join(', ')}.`
    );
  }
};

const assertTitle = (title) => {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new BadRequestError('A title is required.');
  }
  if (title.length > 255) {
    throw new BadRequestError('Title must be at most 255 characters.');
  }
};

/**
 * Public read. Returns every entry grouped by section and already ordered, so
 * the client renders without sorting or filtering anything itself.
 */
const getAboutEntries = async (req, res) => {
  const entries = await AboutEntry.findAll({
    order: [
      ['section', 'ASC'],
      ['displayOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const grouped = { experience: [], education: [], achievement: [] };
  for (const entry of entries) grouped[entry.section]?.push(entry);

  res.json({
    succeed: true,
    result: grouped,
    msg: 'Successfully fetched about entries!',
  });
};

const createAboutEntry = async (req, res) => {
  const { section, title } = req.body ?? {};
  assertSection(section);
  assertTitle(title);

  /**
   * Inserted at the top of its own section, not the bottom.
   *
   * These lists are reverse chronological: the newest job goes first, and an
   * entry appended to the end means scrolling to find the thing you just
   * created and then dragging it all the way back up.
   *
   * Done in a transaction because it is two writes: push everything in the
   * section down one, then insert at zero. A failure between them would leave
   * two entries sharing a position.
   */
  const created = await AboutEntry.sequelize.transaction(async (transaction) => {
    await AboutEntry.increment('displayOrder', {
      by: 1,
      where: { section },
      transaction,
    });

    return AboutEntry.create(
      {
        section,
        displayOrder: 0,
        ...pick(req.body),
        title: title.trim(),
      },
      { transaction }
    );
  });

  res.status(201).json({
    succeed: true,
    msg: 'Successfully added the entry',
    result: created,
  });
};

const editAboutEntry = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new BadRequestError('A valid entry id is required.');
  }

  const entry = await AboutEntry.findByPk(id);
  if (!entry) throw new NotFoundError('That entry does not exist.');

  const changes = pick(req.body);
  if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
    assertTitle(changes.title);
    changes.title = changes.title.trim();
  }
  if (Object.keys(changes).length === 0) {
    throw new BadRequestError('Nothing to update.');
  }

  await entry.update(changes);

  res.json({ succeed: true, msg: 'Successfully updated the entry', result: entry });
};

const deleteAboutEntry = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new BadRequestError('A valid entry id is required.');
  }

  const entry = await AboutEntry.findByPk(id);
  if (!entry) throw new NotFoundError('That entry does not exist.');

  await entry.destroy();
  res.json({ succeed: true, msg: 'Successfully removed the entry' });
};

/**
 * Reorders one section in a single transaction.
 *
 * All or nothing: a partial write would leave the list in an order the admin
 * never chose, which is worse than the request failing.
 */
const reorderAboutEntries = async (req, res) => {
  const { section, order } = req.body ?? {};
  assertSection(section);

  if (!Array.isArray(order) || order.length === 0) {
    throw new BadRequestError('An ordered array of entry ids is required.');
  }

  const ids = order.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new BadRequestError('Every id in the order must be a positive integer.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestError('The order contains duplicate ids.');
  }

  const existing = await AboutEntry.findAll({
    where: { section, id: { [Op.in]: ids } },
    attributes: ['id'],
  });
  if (existing.length !== ids.length) {
    throw new BadRequestError('The order refers to entries outside this section.');
  }

  await AboutEntry.sequelize.transaction(async (transaction) => {
    await Promise.all(
      ids.map((id, index) =>
        AboutEntry.update({ displayOrder: index }, { where: { id }, transaction })
      )
    );
  });

  res.json({ succeed: true, msg: 'Successfully reordered' });
};

module.exports = {
  SECTIONS,
  getAboutEntries,
  createAboutEntry,
  editAboutEntry,
  deleteAboutEntry,
  reorderAboutEntries,
};

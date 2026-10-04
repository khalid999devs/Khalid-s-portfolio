'use strict';

const store = require('../utils/clientErrorStore');
const { normaliseReport } = require('../utils/clientErrorReport');

const LIST_LIMIT = 100;

/**
 * Public write path. Answers exactly as the visits endpoint does, before any
 * work, so the reply says nothing about whether the report was kept.
 */
const reportClientError = (req, res) => {
  res.status(202).end();

  try {
    const report = normaliseReport(req.body, req.get('user-agent'));
    if (report) store.record(report);
  } catch (error) {
    console.error('Could not store client error:', error.message);
  }
};

const listClientErrors = (req, res) => {
  res.json({
    succeed: true,
    result: store.list(LIST_LIMIT),
    msg: 'Successfully fetched client errors!',
  });
};

const clearClientErrors = (req, res) => {
  const removed = store.clear();

  res.json({
    succeed: true,
    msg: `Removed ${removed} client error${removed === 1 ? '' : 's'}.`,
    removed,
  });
};

module.exports = { reportClientError, listClientErrors, clearClientErrors };

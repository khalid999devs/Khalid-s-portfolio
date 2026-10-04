'use strict';

const { createHash } = require('crypto');

// Turns a browser error report into a storable entry. Pure: no storage, no request.

const KINDS = Object.freeze(['error', 'unhandledrejection', 'react', 'chunk', 'boot']);

// The longest value kept for each field.
const LIMITS = Object.freeze({
  message: 500,
  stack: 4000,
  source: 300,
  path: 300,
  userAgent: 300,
  viewport: 20,
  build: 40,
});

const MAXIMUM_INT = 2147483647;

// Line breaks and tabs become a space; every other control character goes.
const oneLine = (value, max) =>
  typeof value === 'string'
    ? value
        .replace(/[\t\n\v\f\r]+/g, ' ')
        .replace(/\p{Cc}/gu, '')
        .trim()
        .slice(0, max)
    : '';

// A stack keeps its line breaks and tabs and loses every other control character.
const multiLine = (value, max) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        .replace(/\p{Cc}/gu, (char) => (char === '\n' || char === '\t' ? char : ''))
        .trim()
        .slice(0, max)
    : '';

const position = (value) =>
  Number.isInteger(value) && value >= 0 && value <= MAXIMUM_INT ? value : null;

/** What makes two reports the same error. A null part hashes as empty. */
const fingerprintOf = ({ kind, message, source, line }) =>
  createHash('sha256').update([kind, message, source, line].join('\n')).digest('hex');

/**
 * Returns the entry to store, or null when the report should be dropped.
 * The user agent is the request header's, never a field of the body.
 */
const normaliseReport = (body, userAgent) => {
  if (!body || typeof body !== 'object' || !KINDS.includes(body.kind)) return null;

  const message = oneLine(body.message, LIMITS.message);
  if (message === '') return null;

  const report = {
    kind: body.kind,
    message,
    stack: multiLine(body.stack, LIMITS.stack),
    source: oneLine(body.source, LIMITS.source) || null,
    line: position(body.line),
    col: position(body.col),
    path: oneLine(body.path, LIMITS.path),
    userAgent: oneLine(userAgent, LIMITS.userAgent),
    viewport: oneLine(body.viewport, LIMITS.viewport) || null,
    build: oneLine(body.build, LIMITS.build) || null,
  };

  return { fingerprint: fingerprintOf(report), ...report };
};

module.exports = { KINDS, LIMITS, fingerprintOf, normaliseReport };

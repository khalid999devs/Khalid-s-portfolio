'use strict';

// Parses a pasted recipient list. Invalid entries are returned, not dropped.

/** Commas, semicolons, whitespace, in any combination. */
const SEPARATORS = /[\s,;]+/;

/** Catches the real mistakes, not RFC 5322. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MAXIMUM_RECIPIENTS = 200;

const split = (raw) =>
  String(raw ?? '')
    .split(SEPARATORS)
    .map((entry) => entry.trim())
    .filter(Boolean);

/** @returns {{valid: string[], invalid: string[], duplicates: number}} */
const parseEmails = (raw) => {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;

  for (const entry of split(raw)) {
    // A trailing period is an address pasted from prose.
    const address = entry.replace(/\.$/, '');

    if (!EMAIL.test(address)) {
      invalid.push(entry);
      continue;
    }

    const key = address.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }

    seen.add(key);
    valid.push(address);
  }

  return { valid, invalid, duplicates };
};

/** Split only. The gateway client owns what a valid number is. */
const parseNumbers = (raw) => split(raw);

module.exports = { parseEmails, parseNumbers, MAXIMUM_RECIPIENTS };

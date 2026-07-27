'use strict';

const { DeliveryLog } = require('../models');

/**
 * Records one outbound delivery attempt.
 *
 * Never throws. A logging failure must not turn a delivered email into a failed
 * request, and it must not mask the original provider error either, so problems
 * here go to stderr and the caller carries on.
 *
 * Values are truncated to their column widths rather than left to the database
 * to reject: a provider that returns a long error message should still produce
 * a log row.
 */
const clip = (value, max) => {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

const recordDelivery = async (entry) => {
  try {
    await DeliveryLog.create({
      channel: entry.channel,
      mode: clip(entry.mode, 64),
      recipient: clip(entry.recipient, 255),
      subject: clip(entry.subject, 255),
      status: entry.status,
      providerCode: clip(entry.providerCode, 32),
      detail: clip(entry.detail, 512),
      durationMs: Number.isFinite(entry.durationMs) ? Math.round(entry.durationMs) : null,
    });
  } catch (error) {
    console.error('Could not write delivery log:', error.message);
  }
};

module.exports = { recordDelivery };

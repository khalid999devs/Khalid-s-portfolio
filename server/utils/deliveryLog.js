'use strict';

const { DeliveryLog } = require('../models');

// Records one outbound attempt. Never throws: a logging failure must not turn
// a delivered email into a failed request. Values are clipped to column width
// so a long provider error still produces a row.
const clip = (value, max) => {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};

const count = (value) => (Number.isFinite(value) ? Math.round(value) : null);

const recordDelivery = async (entry) => {
  try {
    await DeliveryLog.create({
      channel: entry.channel,
      kind: entry.kind === 'bulk' ? 'bulk' : 'single',
      mode: clip(entry.mode, 64),
      recipient: clip(entry.recipient, 255),
      subject: clip(entry.subject, 255),
      status: entry.status,
      providerCode: clip(entry.providerCode, 32),
      detail: clip(entry.detail, 512),
      recipientCount: count(entry.recipientCount),
      succeededCount: count(entry.succeededCount),
      failedCount: count(entry.failedCount),
      durationMs: count(entry.durationMs),
    });
  } catch (error) {
    console.error('Could not write delivery log:', error.message);
  }
};

module.exports = { recordDelivery };

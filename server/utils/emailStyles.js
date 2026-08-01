'use strict';

// Shared by the layout (emailTemplate.js) and the content inliner
// (emailHtml.js), so the message body and the chrome around it agree.

const INK = '#161616';
const MUTED = '#6B6B6C';
const RULE = '#E5E5E4';
const PAGE = '#F4F4F3';
const CARD = '#FFFFFF';

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Courier New',monospace";

module.exports = { INK, MUTED, RULE, PAGE, CARD, SANS, MONO };

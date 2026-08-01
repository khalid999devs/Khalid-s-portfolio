'use strict';

// Email layout. Tables and inline styles only: Outlook renders neither flexbox
// nor grid, and most clients strip <style> from the head.

const { INK, MUTED, RULE, PAGE, CARD, SANS, MONO } = require('./emailStyles');

const SITE = 'https://khalidahammed.com';
const LINKS = [
  ['GitHub', 'https://github.com/khalid999devs'],
  ['LinkedIn', 'https://www.linkedin.com/in/khalid-ahammed'],
  ['X', 'https://x.com/khalid999devs'],
];

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Only http(s), so a pasted `javascript:` cannot become a link. */
const safeUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const button = (cta) => {
  const href = safeUrl(cta?.url);
  const label = String(cta?.label ?? '').trim();
  if (!href || !label) return '';

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 6px;">
    <tr>
      <td align="center" bgcolor="${INK}" class="btn" style="border-radius:6px;">
        <a href="${escapeHtml(href)}" class="btn-a" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escapeHtml(
          label
        )}</a>
      </td>
    </tr>
  </table>`;
};

/**
 * @param {object}  options
 * @param {string}  options.greeting   e.g. "Dear Sara"
 * @param {string}  options.bodyHtml   sanitised, style-inlined message body
 * @param {object=} options.cta        { label, url }
 * @param {string}  options.preheader  inbox preview line
 */
const renderHtml = ({ greeting, bodyHtml, cta, preheader }) => `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(preheader || 'Khalid Ahammed')}</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
  @media (prefers-color-scheme: dark) {
    .page { background:#0F0F0F !important; }
    .card { background:#1A1A1A !important; border-color:#2A2A2A !important; }
    .ink, .ink p, .ink a { color:#F2F2F2 !important; }
    .muted, .muted a { color:#9A9A9A !important; }
    .rule { border-color:#2A2A2A !important; }
    /* Inverted, or the dark button vanishes into the dark card. Two classes,
       to outrank the .ink a rule above which also sets a colour. */
    .btn { background:#F2F2F2 !important; }
    .btn a.btn-a { color:#0F0F0F !important; }
  }
  @media only screen and (max-width:620px) {
    .pad { padding-left:24px !important; padding-right:24px !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(
  preheader || ''
)}</div>
<!-- Pushes the preview text off the preheader line so no markup leaks into it. -->
<div style="display:none;max-height:0;overflow:hidden;">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${PAGE};">
  <tr>
    <td align="center" style="padding:40px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <tr>
          <td class="card" style="background:${CARD};border:1px solid ${RULE};border-radius:10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

              <tr>
                <td class="pad ink" style="padding:40px 40px 0;">
                  <p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};">${escapeHtml(
                    greeting
                  )},</p>
                  ${bodyHtml}
                  ${button(cta)}
                </td>
              </tr>

              <tr>
                <td class="pad" style="padding:14px 40px 38px;">
                  <hr class="rule" style="border:0;border-top:1px solid ${RULE};margin:12px 0 22px;" />
                  <p class="ink" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};">Best regards,</p>
                  <p class="ink" style="margin:2px 0 0;font-family:${SANS};font-size:15px;font-weight:600;line-height:1.6;color:${INK};">Khalid Ahammed</p>
                  <p class="muted" style="margin:2px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};"><a href="${SITE}" style="color:${MUTED};text-decoration:underline;">khalidahammed.com</a></p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <tr>
          <td class="pad" align="center" style="padding:22px 8px 0;">
            <p class="muted" style="margin:0 0 8px;font-family:${SANS};font-size:13px;color:${MUTED};">
              ${LINKS.map(
                ([label, href]) =>
                  `<a href="${href}" style="color:${MUTED};text-decoration:none;padding:0 8px;">${label}</a>`
              ).join('<span style="color:#C9C9C8;">&middot;</span>')}
            </p>
            <p class="muted" style="margin:0;font-family:${MONO};font-size:11px;letter-spacing:0.4px;color:${MUTED};">&copy; ${new Date().getFullYear()} Khalid Ahammed</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;

/**
 * Raw mode: the message exactly as written, with no branding, greeting or
 * signature. Still a complete document rather than a bare fragment, because a
 * fragment inherits whatever defaults the client feels like applying.
 */
const renderRaw = ({ bodyHtml, cta, preheader }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<title>${escapeHtml(preheader || '')}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
  preheader || ''
)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td style="font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};">
            ${bodyHtml}
            ${button(cta)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

/**
 * The plain-text alternative. This used to be a full HTML document assigned to
 * nodemailer's `text` field, so text-only clients showed raw markup and spam
 * filters saw two HTML parts.
 *
 * `bodyText` is derived from the same HTML that is sent, so the two parts
 * cannot drift apart.
 */
const renderText = ({ greeting, bodyText, cta, branded = true }) => {
  const lines = [];

  if (branded) lines.push(`${greeting},`, '');
  lines.push(String(bodyText ?? '').trim());

  const href = safeUrl(cta?.url);
  const label = String(cta?.label ?? '').trim();
  if (href && label) lines.push('', `${label}: ${href}`);

  if (branded) {
    lines.push(
      '',
      'Best regards,',
      'Khalid Ahammed',
      'khalidahammed.com',
      '',
      LINKS.map(([name, url]) => `${name}: ${url}`).join('\n')
    );
  }

  return lines.join('\n');
};

module.exports = { renderHtml, renderRaw, renderText, escapeHtml };

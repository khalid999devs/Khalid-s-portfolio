'use strict';

const sanitizeHtml = require('sanitize-html');
const { SANS, MONO, INK, MUTED, RULE } = require('./emailStyles');

// Editor HTML to email HTML.
//
// Two jobs. Strip anything an email client should not receive, and inline every
// style: Gmail drops <style> in forwarded mail and Outlook ignores most of it,
// so a stylesheet-styled <p> arrives with the client's default margins instead
// of the ones seen while writing.
//
// BLOCK_STYLES is the contract with the editor. client/src/components/Admin/
// RichTextEditor.jsx renders its content area with the same values so what is
// typed matches what is delivered; change one, change both.

const BLOCK_STYLES = {
  p: `margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};`,
  h1: `margin:28px 0 14px;font-family:${SANS};font-size:30px;line-height:1.25;font-weight:700;color:${INK};`,
  h2: `margin:26px 0 12px;font-family:${SANS};font-size:24px;line-height:1.3;font-weight:700;color:${INK};`,
  h3: `margin:22px 0 10px;font-family:${SANS};font-size:19px;line-height:1.4;font-weight:700;color:${INK};`,
  ul: `margin:0 0 18px;padding-left:22px;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};`,
  ol: `margin:0 0 18px;padding-left:22px;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK};`,
  li: 'margin:0 0 6px;',
  blockquote: `margin:0 0 18px;padding:2px 0 2px 16px;border-left:3px solid ${RULE};font-family:${SANS};font-size:16px;line-height:1.65;color:${MUTED};font-style:italic;`,
  pre: `margin:0 0 18px;padding:14px 16px;background:#F6F6F5;border:1px solid ${RULE};border-radius:6px;font-family:${MONO};font-size:13px;line-height:1.55;color:${INK};white-space:pre-wrap;`,
  code: `font-family:${MONO};font-size:14px;background:#F1F1F0;padding:2px 5px;border-radius:4px;color:${INK};`,
  a: `color:${INK};text-decoration:underline;`,
  strong: 'font-weight:600;',
  b: 'font-weight:600;',
  hr: `border:0;border-top:1px solid ${RULE};margin:24px 0;`,
};

/** Only these reach an inbox. Anything else is unwrapped or dropped. */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr',
];

/** Rebuilds attributes rather than filtering them, so nothing rides along. */
const styleTag = (tagName, attribs) => {
  const style = BLOCK_STYLES[tagName];
  const next = style ? { style } : {};

  if (tagName === 'a') {
    if (attribs.href) next.href = attribs.href;
    // A client's mail window is not a place to navigate away in.
    next.target = '_blank';
    next.rel = 'noopener noreferrer';
  }

  // `code` inside `pre` would double the background and border radius.
  if (tagName === 'code' && attribs['data-in-pre']) delete next.style;

  return { tagName, attribs: next };
};

const transformTags = Object.fromEntries(
  ALLOWED_TAGS.map((tag) => [tag, (tagName, attribs) => styleTag(tagName, attribs)])
);

/**
 * Two artefacts the editor leaves behind, both of which show up as extra space.
 *
 * It wraps every list item's content in a paragraph, which would inherit the
 * 18px paragraph margin and put a gap after each bullet. And it keeps a trailing
 * empty paragraph holding the cursor, which would arrive as a blank line.
 */
const tidy = (html) =>
  html
    .replace(/<li([^>]*)><p[^>]*>/gi, '<li$1>')
    .replace(/<\/p><\/li>/gi, '</li>')
    .replace(/<p[^>]*>(\s|<br\s*\/?>|&nbsp;)*<\/p>\s*$/i, '')
    .trim();

const sanitiseToEmailHtml = (html) =>
  tidy(
    sanitizeHtml(String(html ?? ''), {
    allowedTags: ALLOWED_TAGS,
    // `style` must be listed or the styles injected above are filtered back out.
    // Incoming ones never survive, because transformTags builds attribs fresh.
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['style'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      // A disallowed tag loses its markup but keeps its words.
      nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
      transformTags,
    })
  );

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&middot;': '·',
};

/**
 * The plain-text alternative, built from the same HTML so the two parts say the
 * same thing. Structure is preserved as far as text allows: list items keep a
 * bullet, and a link keeps its URL rather than becoming an unclickable word.
 */
const htmlToPlainText = (html) => {
  let text = String(html ?? '');

  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // `li` is absent on purpose: its opening tag already broke the line, and
  // closing it too would put a blank line between every bullet. Lists close
  // with two, so the next paragraph is not flush against the last bullet.
  text = text.replace(/<\/(ul|ol)>/gi, '\n\n');
  text = text.replace(/<\/(p|h1|h2|h3|blockquote|pre)>/gi, '\n');
  text = text.replace(/<hr[^>]*>/gi, '\n---\n');

  // Keep the destination; "click here" with no URL is useless in text.
  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
    (match, href, label) => {
      const clean = label.replace(/<[^>]+>/g, '').trim();
      return !clean || clean === href ? href : `${clean} (${href})`;
    }
  );

  text = text.replace(/<[^>]+>/g, '');

  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(char);
  }
  text = text.replace(/&#(\d+);/g, (m, code) => String.fromCharCode(Number(code)));

  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** Plain textarea input to paragraphs, for anything not written in the editor. */
const plainTextToHtml = (body) =>
  String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const escaped = block
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />');
      return `<p style="${BLOCK_STYLES.p}">${escaped}</p>`;
    })
    .join('');

module.exports = {
  BLOCK_STYLES,
  sanitiseToEmailHtml,
  htmlToPlainText,
  plainTextToHtml,
};

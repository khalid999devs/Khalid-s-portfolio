// Live preview for the bulk send boxes. The server parses again and its answer
// wins; this only catches typos before a round trip that may already have sent.
// Rules must match server/utils/recipients.js and normaliseNumber in sendSMS.js.

const SEPARATORS = /[\s,;]+/;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const split = (raw) =>
  String(raw ?? '')
    .split(SEPARATORS)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const parseEmails = (raw) => {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;

  for (const entry of split(raw)) {
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

/** 88 + an 013–019 mobile number, or null. */
export const normaliseNumber = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');

  let national;
  if (digits.length === 13 && digits.startsWith('880')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('01')) national = digits;
  else if (digits.length === 10 && digits.startsWith('1')) national = `0${digits}`;
  else return null;

  if (!/^01[3-9]\d{8}$/.test(national)) return null;

  return `88${national}`;
};

export const parseNumbers = (raw) => {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;

  for (const entry of split(raw)) {
    const number = normaliseNumber(entry);

    if (!number) {
      invalid.push(entry);
      continue;
    }

    if (seen.has(number)) {
      duplicates += 1;
      continue;
    }

    seen.add(number);
    valid.push(number);
  }

  return { valid, invalid, duplicates };
};

/** 160 chars per part, 70 if anything is non-ASCII. Parts are billed. */
export const smsSegments = (message) => {
  const text = String(message ?? '');
  if (text.length === 0) return { unicode: false, perSegment: 160, segments: 0 };

  const unicode = [...text].some((char) => char.codePointAt(0) > 127);
  const perSegment = unicode ? 70 : 160;
  // Concatenated parts carry a header.
  const multipartSize = unicode ? 67 : 153;

  const segments = text.length <= perSegment ? 1 : Math.ceil(text.length / multipartSize);

  return { unicode, perSegment, segments };
};

'use strict';

const { openSync, readSync, closeSync } = require('fs');

/**
 * Content-sniffing for uploaded media.
 *
 * The upload filter used to test only `file.mimetype`, which the client sends
 * and can set to anything. For the video fields the saved extension came from
 * `file.originalname`, also client-controlled. So `video/mp4` plus a file named
 * `payload.html` wrote attacker HTML under /uploads, which is served statically
 * -- stored XSS on the API origin.
 *
 * Types are now decided by the bytes on disk, and the extension is looked up
 * from the detected type rather than taken from anything the client said.
 */

const SIGNATURES = [
  {
    type: 'image/png',
    extension: 'png',
    kind: 'image',
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    type: 'image/jpeg',
    extension: 'jpeg',
    kind: 'image',
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/webp',
    extension: 'webp',
    kind: 'image',
    test: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    type: 'video/mp4',
    extension: 'mp4',
    kind: 'video',
    // ISO base media: a box length, then 'ftyp'. The brand that follows
    // distinguishes mp4 from other ISO-BMFF flavours; all are accepted here.
    test: (b) => b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp',
  },
  {
    type: 'video/x-matroska',
    extension: 'mkv',
    kind: 'video',
    // EBML header, shared by Matroska and WebM.
    test: (b) =>
      b.length >= 4 &&
      b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  {
    type: 'audio/wav',
    extension: 'wav',
    kind: 'audio',
    test: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WAVE',
  },
  {
    type: 'application/pdf',
    extension: 'pdf',
    kind: 'document',
    // Every PDF begins with "%PDF-" followed by its version. Checked as bytes
    // for the same reason as everything else here: a file claiming
    // application/pdf while containing HTML would otherwise be stored under
    // /uploads and served from the API origin.
    test: (b) => b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-',
  },
];

/**
 * Which detected kinds each upload field is allowed to receive.
 *
 * `resume` is deliberately not in UPLOAD_FIELDS: project media is written into
 * projects/<id>/ and requires a numeric route parameter, while the resume is a
 * single site-wide document under assets/. They use separate multer instances,
 * so keeping the field lists separate stops a resume upload from being routed
 * through the project storage path (and vice versa).
 */
const PROJECT_FIELD_RULES = Object.freeze({
  bannerImg: Object.freeze(['image']),
  thumbnailContents: Object.freeze(['image']),
  sliderContents: Object.freeze(['image']),
  videos: Object.freeze(['video', 'audio']),
});

const FIELD_RULES = Object.freeze({
  ...PROJECT_FIELD_RULES,
  resume: Object.freeze(['document']),
});

const UPLOAD_FIELDS = Object.freeze(Object.keys(PROJECT_FIELD_RULES));

const RESUME_FIELD = 'resume';

const HEADER_BYTES = 32;

/** Reads the leading bytes of a file without loading it into memory. */
const readHeader = (absolutePath) => {
  const handle = openSync(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const read = readSync(handle, buffer, 0, HEADER_BYTES, 0);
    return buffer.subarray(0, read);
  } finally {
    closeSync(handle);
  }
};

/** Returns the signature descriptor for a file on disk, or null. */
const detectFileType = (absolutePath) => {
  const header = readHeader(absolutePath);
  return SIGNATURES.find((signature) => signature.test(header)) || null;
};

const isTypeAllowedForField = (fieldname, detected) => {
  const allowed = FIELD_RULES[fieldname];
  return Boolean(allowed && detected && allowed.includes(detected.kind));
};

module.exports = {
  SIGNATURES,
  FIELD_RULES,
  PROJECT_FIELD_RULES,
  UPLOAD_FIELDS,
  RESUME_FIELD,
  detectFileType,
  isTypeAllowedForField,
};

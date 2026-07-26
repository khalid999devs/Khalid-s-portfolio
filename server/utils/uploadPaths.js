'use strict';

const { resolve, isAbsolute, sep, normalize } = require('path');

/**
 * Single source of truth for where uploaded media lives on disk.
 *
 * Stored database values are relative and URL-style ("uploads/projects/x/y.png")
 * so a database dump restores onto any host without rewriting rows. Nothing else
 * in the codebase should resolve one of those strings by hand.
 *
 * UPLOADS_DIR lets the root point at a mounted volume. Without it the root sits
 * inside the application directory, where any deploy that replaces the directory
 * destroys every uploaded file.
 */
const UPLOADS_ROOT = resolve(
  process.env.UPLOADS_DIR || resolve(__dirname, '..', 'uploads')
);

/**
 * Resolves a stored path to an absolute path inside the uploads root, or null
 * if it does not belong there.
 *
 * This is the containment boundary. `deleteFile` previously did
 * `resolve(__dirname, '../', path)` with no check at all, so any stored value
 * an attacker could influence -- and until the write allowlists landed, they
 * could set these columns freely -- resolved wherever it liked and was passed
 * straight to `unlinkSync`.
 */
const resolveStoredUploadPath = (storedPath) => {
  if (typeof storedPath !== 'string') return null;

  const trimmed = storedPath.trim();
  if (trimmed === '') return null;

  // A NUL byte truncates the path at the syscall boundary on some platforms.
  if (trimmed.includes('\0')) return null;

  // Stored values are URL-style. A backslash means either a Windows path or an
  // attempt to sidestep separator checks; neither is a value we wrote.
  if (trimmed.includes('\\')) return null;

  if (isAbsolute(trimmed)) return null;

  // Values are stored with the "uploads/" prefix, but the root may have been
  // relocated via UPLOADS_DIR, so join on the remainder rather than assuming
  // the root's own directory name.
  const withoutPrefix = trimmed.replace(/^uploads\//, '');
  const candidate = resolve(UPLOADS_ROOT, normalize(withoutPrefix));

  if (candidate !== UPLOADS_ROOT && !candidate.startsWith(UPLOADS_ROOT + sep)) {
    return null;
  }

  return candidate;
};

module.exports = { UPLOADS_ROOT, resolveStoredUploadPath };

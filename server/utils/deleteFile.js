'use strict';

const { lstatSync, unlinkSync } = require('fs');
const { resolveStoredUploadPath } = require('./uploadPaths');

/**
 * Deletes a stored media file, and only a stored media file.
 *
 * Previously this resolved any caller-supplied string against the server
 * directory and unlinked whatever came out, with no confinement:
 *
 *   const destName = resolve(__dirname, '../', path);
 *   if (existsSync(destName)) unlinkSync(destName);
 *
 * Combined with the unrestricted `projects.update({ ...req.body })` on the write
 * routes, that let a caller store an arbitrary path in a media column and have
 * the server delete that file on the next content-delete or project-delete.
 *
 * Returns whether a file was removed, so callers can log a miss instead of
 * assuming success.
 */
const deleteFile = (storedPath) => {
  const target = resolveStoredUploadPath(storedPath);
  if (!target) return false;

  try {
    // lstat, not stat: a symlink inside the uploads root must not be followed
    // out of it. Unlinking the link itself is fine; following it is not.
    const stats = lstatSync(target);
    if (!stats.isFile()) return false;

    unlinkSync(target);
    return true;
  } catch (error) {
    // A file that is already gone is the desired end state, not a failure.
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

module.exports = deleteFile;

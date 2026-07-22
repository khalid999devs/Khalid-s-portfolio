const { existsSync, unlinkSync } = require('fs');
const {
  assertExistingPathIsContained,
  resolveStoredUploadPath,
} = require('./uploadPaths');

/**
 * Delete a file referenced by the public, database-safe `uploads/...` path.
 *
 * Deliberately does not accept absolute filesystem paths. This keeps callers
 * from turning a database field or request body into an arbitrary unlink.
 */
const deleteFile = (storedPath) => {
  const resolvedPath = resolveStoredUploadPath(storedPath);

  if (!existsSync(resolvedPath)) {
    return false;
  }

  // Lexical containment is not enough if an intermediate directory is a
  // symlink. Verify the existing target's real path before unlinking it.
  assertExistingPathIsContained(resolvedPath);
  unlinkSync(resolvedPath);
  return true;
};

module.exports = deleteFile;

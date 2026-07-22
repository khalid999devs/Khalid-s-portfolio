const { unlink } = require('fs/promises');
const {
  assertExistingPathIsContainedAsync,
  resolveStoredUploadPath,
} = require('./uploadPaths');

/**
 * Delete a file referenced by the public, database-safe `uploads/...` path.
 *
 * Deliberately does not accept absolute filesystem paths. This keeps callers
 * from turning a database field or request body into an arbitrary unlink.
 */
const deleteFile = async (storedPath) => {
  const resolvedPath = resolveStoredUploadPath(storedPath);

  try {
    // Lexical containment is not enough if an intermediate directory is a
    // symlink. Verify the existing target's real path before unlinking it.
    await assertExistingPathIsContainedAsync(resolvedPath);
    await unlink(resolvedPath);
    return true;
  } catch (error) {
    // Treat a file that disappeared before or during deletion as already
    // cleaned up. Other errors, especially containment failures, stay loud.
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
};

module.exports = deleteFile;

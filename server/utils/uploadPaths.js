const { realpathSync } = require('fs');
const { realpath } = require('fs/promises');
const { isAbsolute, relative, resolve, sep } = require('path');

const SERVER_ROOT = resolve(__dirname, '..');

// Stored database paths stay relative ("uploads/projects/12/..."), so they are
// host-independent and survive a database dump moving between machines. Only
// the physical location of the bytes is configurable: point UPLOADS_DIR at a
// mounted volume or attached disk and the same rows keep resolving. Leaving it
// unset keeps media beside the application, which is fine for a single box but
// is lost on any deploy that replaces the directory.
const resolveUploadsRoot = (environment = process.env) => {
  const configured = environment.UPLOADS_DIR?.trim();
  if (!configured) return resolve(SERVER_ROOT, 'uploads');

  if (!isAbsolute(configured)) {
    throw new Error('UPLOADS_DIR must be an absolute path');
  }

  return resolve(configured);
};

const UPLOADS_ROOT = resolveUploadsRoot();

const isOutsideRoot = (root, candidate) => {
  const relativePath = relative(root, candidate);

  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  );
};

const assertStoredUploadPath = (storedPath) => {
  if (typeof storedPath !== 'string' || storedPath.length === 0) {
    throw new TypeError('Upload path must be a non-empty string');
  }

  if (
    storedPath !== storedPath.trim() ||
    storedPath.includes('\0') ||
    storedPath.includes('?') ||
    storedPath.includes('#')
  ) {
    throw new Error('Upload path contains invalid characters');
  }

  // Stored paths are URL-style paths. Reject backslashes explicitly so that a
  // path cannot change meaning when the application is moved to Windows.
  if (storedPath.includes('\\') || isAbsolute(storedPath)) {
    throw new Error('Absolute and platform-specific upload paths are not allowed');
  }

  const pathSegments = storedPath.split('/');
  if (
    pathSegments[0] !== 'uploads' ||
    pathSegments.length < 2 ||
    pathSegments.some((segment) => segment === '' || segment === '..' || segment === '.')
  ) {
    throw new Error('Upload path must stay inside the uploads directory');
  }
};

const resolveStoredUploadPath = (storedPath) => {
  assertStoredUploadPath(storedPath);

  // The validator guarantees the first segment is "uploads". Resolve the rest
  // against the configured root rather than the server directory, so a stored
  // path keeps pointing at the bytes when media lives on a mounted volume.
  const resolvedPath = resolve(
    UPLOADS_ROOT,
    ...storedPath.split('/').slice(1)
  );
  if (isOutsideRoot(UPLOADS_ROOT, resolvedPath)) {
    throw new Error('Upload path resolves outside the uploads directory');
  }

  return resolvedPath;
};

const assertExistingPathIsContained = (resolvedPath) => {
  const realUploadsRoot = realpathSync(UPLOADS_ROOT);
  const realResolvedPath = realpathSync(resolvedPath);

  if (isOutsideRoot(realUploadsRoot, realResolvedPath)) {
    throw new Error('Upload path escapes the uploads directory through a symlink');
  }
};

const assertExistingPathIsContainedAsync = async (resolvedPath) => {
  const [realUploadsRoot, realResolvedPath] = await Promise.all([
    realpath(UPLOADS_ROOT),
    realpath(resolvedPath),
  ]);

  if (isOutsideRoot(realUploadsRoot, realResolvedPath)) {
    throw new Error('Upload path escapes the uploads directory through a symlink');
  }
};

const toStoredUploadPath = (filePath) => {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('Uploaded file path must be a non-empty string');
  }

  if (!isAbsolute(filePath)) {
    // Multer used to return the same relative `uploads/...` value that was
    // persisted in the database. Keep that legacy shape compatible, but pass
    // it through the same strict validator before returning it.
    resolveStoredUploadPath(filePath);
    return filePath;
  }

  const resolvedPath = resolve(filePath);
  if (isOutsideRoot(UPLOADS_ROOT, resolvedPath)) {
    throw new Error('Uploaded file is outside the uploads directory');
  }

  const relativePath = relative(UPLOADS_ROOT, resolvedPath);
  if (!relativePath || relativePath === '.') {
    throw new Error('Uploaded file path must identify a file');
  }

  const storedPath = `uploads/${relativePath.split(sep).join('/')}`;
  assertStoredUploadPath(storedPath);
  return storedPath;
};

module.exports = {
  UPLOADS_ROOT,
  assertExistingPathIsContained,
  assertExistingPathIsContainedAsync,
  resolveStoredUploadPath,
  resolveUploadsRoot,
  toStoredUploadPath,
};

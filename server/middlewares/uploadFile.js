const { randomBytes } = require('crypto');
const { constants, existsSync, mkdirSync } = require('fs');
const { open } = require('fs/promises');
const { resolve } = require('path');
const multer = require('multer');
const { BadRequestError } = require('../errors');
const {
  UPLOADS_ROOT,
  assertExistingPathIsContained,
  toStoredUploadPath,
} = require('../utils/uploadPaths');
const deleteFile = require('../utils/deleteFile');

const FILE_POLICIES = Object.freeze({
  bannerImg: Object.freeze({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }),
  thumbnailContents: Object.freeze({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }),
  sliderContents: Object.freeze({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }),
  videos: Object.freeze({
    'video/mp4': '.mp4',
    'video/x-matroska': '.mkv',
    'video/mkv': '.mkv',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/wave': '.wav',
  }),
});

const getProjectUploadKey = (req) => {
  const projectId = String(req.params?.id || '');

  if (!/^[1-9]\d*$/.test(projectId)) {
    throw new BadRequestError('A valid project id is required for uploads');
  }

  return projectId;
};

const getFileExtension = (file) => {
  const policy = FILE_POLICIES[file.fieldname];
  return policy?.[String(file.mimetype || '').toLowerCase()];
};

const startsWithBytes = (buffer, bytes) =>
  bytes.every((byte, index) => buffer[index] === byte);

const FILE_SIGNATURE_VALIDATORS = Object.freeze({
  'image/jpeg': (buffer) => startsWithBytes(buffer, [0xff, 0xd8, 0xff]),
  'image/jpg': (buffer) => startsWithBytes(buffer, [0xff, 0xd8, 0xff]),
  'image/png': (buffer) =>
    startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'video/mp4': (buffer) =>
    buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp',
  'video/x-matroska': (buffer) =>
    startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]),
  'video/mkv': (buffer) =>
    startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3]),
  'audio/wav': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE',
  'audio/x-wav': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE',
  'audio/wave': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE',
});

const getUploadedFiles = (req) =>
  Object.values(req.files || {})
    .flat()
    .filter(Boolean);

const validateFileSignature = async (file) => {
  const validator =
    FILE_SIGNATURE_VALIDATORS[String(file?.mimetype || '').toLowerCase()];
  if (!validator || !file?.path) return false;

  // O_NOFOLLOW prevents a local symlink swap from redirecting this validation
  // to a different file between Multer's write and our read.
  const handle = await open(
    file.path,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0)
  );

  try {
    const signature = Buffer.alloc(16);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    return validator(signature.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};

const cleanupRequestUploads = async (req) => {
  await Promise.all(
    getUploadedFiles(req).map(async (file) => {
      try {
        await deleteFile(toStoredUploadPath(file.path));
      } catch (error) {
        console.error('Unable to clean up an invalid upload safely', error);
      }
    })
  );
};

const validateUploadedFiles = async (req, _res, next) => {
  const files = getUploadedFiles(req);

  try {
    const validationResults = await Promise.all(
      files.map(validateFileSignature)
    );

    if (validationResults.some((isValid) => !isValid)) {
      throw new BadRequestError(
        'An uploaded file does not match its declared media type'
      );
    }

    next();
  } catch (error) {
    await cleanupRequestUploads(req);
    throw error;
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!FILE_POLICIES[file.fieldname]) {
        throw new BadRequestError('Unexpected upload field');
      }

      const projectId = getProjectUploadKey(req);
      const destination = resolve(
        UPLOADS_ROOT,
        'projects',
        projectId,
        file.fieldname
      );

      if (!existsSync(destination)) {
        mkdirSync(destination, { recursive: true });
      }
      assertExistingPathIsContained(destination);

      cb(null, destination);
    } catch (error) {
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const extension = getFileExtension(file);
    if (!extension) {
      return cb(new BadRequestError('Unsupported file type'));
    }

    // Never retain the user-controlled original extension/name. A fixed
    // extension plus random suffix prevents active-content and collision-prone
    // filenames from being written to the public uploads tree.
    const suffix = randomBytes(12).toString('hex');
    return cb(null, `${file.fieldname}-${Date.now()}-${suffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fieldNameSize: 64,
    fieldSize: 64 * 1024,
    fields: 10,
    fileSize: 25 * 1024 * 1024,
    files: 12,
    parts: 22,
  },
  fileFilter: (req, file, cb) => {
    if (!FILE_POLICIES[file.fieldname]) {
      return cb(new BadRequestError('Unexpected upload field'));
    }

    if (!getFileExtension(file)) {
      return cb(
        new BadRequestError(
          `Unsupported file type for ${file.fieldname}`
        )
      );
    }

    return cb(null, true);
  },
});

// Expose immutable policy data for focused tests without coupling tests to
// Multer's private internals.
upload.FILE_POLICIES = FILE_POLICIES;
upload.getProjectUploadKey = getProjectUploadKey;
upload.validateFileSignature = validateFileSignature;
upload.validateUploadedFiles = validateUploadedFiles;

module.exports = upload;

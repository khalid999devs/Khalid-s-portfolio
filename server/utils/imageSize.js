'use strict';

const { open, stat } = require('fs/promises');
const { resolveStoredUploadPath } = require('./uploadPaths');

// Width and height from an image's header bytes, without decoding the image.

const text = (bytes, start, end) => bytes.toString('latin1', start, end);

const png = (b) => {
  if (b.length < 24 || text(b, 0, 8) !== '\x89PNG\r\n\x1a\n') return null;
  if (text(b, 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
};

const gif = (b) => {
  if (b.length < 10 || !/^GIF8[79]a$/.test(text(b, 0, 6))) return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
};

const webp = (b) => {
  if (b.length < 16 || text(b, 0, 4) !== 'RIFF' || text(b, 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = text(b, 12, 16);

  if (chunk === 'VP8X' && b.length >= 30) {
    return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  // Lossy: a start code, then two 14-bit sizes with scaling bits above them.
  if (
    chunk === 'VP8 ' && b.length >= 30 &&
    b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a
  ) {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
};

// SOF0 to SOF15, minus DHT, JPG and DAC, which share the range.
const isFrameHeader = (marker) =>
  marker >= 0xc0 && marker <= 0xcf &&
  marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

// The EXIF orientation (1 to 8) held by an APP1 segment, or 0 if it has none.
const exifOrientation = (segment) => {
  try {
    if (text(segment, 0, 6) !== 'Exif\0\0') return 0;
    const tiff = segment.subarray(6);
    const order = text(tiff, 0, 2);
    if (order !== 'II' && order !== 'MM') return 0;
    const u16 = (at) => (order === 'II' ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
    const u32 = (at) => (order === 'II' ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
    if (u16(2) !== 42) return 0;

    const directory = u32(4);
    const end = directory + 2 + u16(directory) * 12;
    for (let entry = directory + 2; entry < end; entry += 12) {
      if (u16(entry) === 0x0112) return u16(entry + 8);
    }
    return 0;
  } catch {
    return 0;
  }
};

const jpeg = (b) => {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let orientation = 0;
  let offset = 2;
  while (offset + 4 <= b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1];

    if (marker === 0xff) {
      // A fill byte ahead of the real marker.
      offset += 1;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Standalone markers carry no length.
      offset += 2;
    } else if (marker === 0xda || marker === 0xd9) {
      // Scan data or end of image, with no frame header before it.
      return null;
    } else {
      const length = b.readUInt16BE(offset + 2);
      if (length < 2) return null;

      if (isFrameHeader(marker)) {
        if (offset + 9 > b.length) return null;
        const height = b.readUInt16BE(offset + 5);
        const width = b.readUInt16BE(offset + 7);
        // Orientations 5 to 8 are quarter turns, and browsers display them turned.
        return orientation >= 5 && orientation <= 8
          ? { width: height, height: width }
          : { width, height };
      }
      if (marker === 0xe1 && orientation === 0) {
        orientation = exifOrientation(b.subarray(offset + 4, offset + 2 + length));
      }
      offset += 2 + length;
    }
  }
  return null;
};

const PARSERS = [png, jpeg, webp, gif];

/** `{ width, height }` for PNG, JPEG, WebP or GIF header bytes, else null. */
const parseImageSize = (bytes) => {
  try {
    for (const parse of PARSERS) {
      const size = parse(bytes);
      if (size) return size.width > 0 && size.height > 0 ? size : null;
    }
  } catch {
    // A malformed header that claimed more bytes than it had.
  }
  return null;
};

// One block covers PNG, GIF, WebP and most JPEGs. Only a JPEG reads further.
const READ_STEPS = [4096, 64 * 1024, 512 * 1024];

const isJpeg = (b) => b.length > 1 && b[0] === 0xff && b[1] === 0xd8;

const readImageSize = async (absolutePath) => {
  const file = await open(absolutePath, 'r');
  try {
    for (const length of READ_STEPS) {
      const { bytesRead, buffer } = await file.read(Buffer.allocUnsafe(length), 0, length, 0);
      const head = buffer.subarray(0, bytesRead);
      const size = parseImageSize(head);
      // Its frame header can sit behind EXIF and colour profile segments.
      if (size || bytesRead < length || !isJpeg(head)) return size;
    }
    return null;
  } finally {
    await file.close();
  }
};

const MAXIMUM_CACHED = 2000;
let reading = Promise.resolve();

const sizeOfFile = async (absolutePath, readSize, cache) => {
  const stats = await stat(absolutePath);
  if (!stats.isFile()) return null;

  // A replaced file has a new mtime or size, so it misses and is read again.
  const key = `${absolutePath}:${stats.mtimeMs}:${stats.size}`;
  if (cache.has(key)) return cache.get(key);

  // One uncached read at a time, so a cold burst cannot exhaust descriptors.
  const read = async () => {
    if (!cache.has(key)) {
      const size = await readSize(absolutePath);
      if (cache.size >= MAXIMUM_CACHED) cache.delete(cache.keys().next().value);
      cache.set(key, size && Object.freeze(size));
    }
    return cache.get(key);
  };
  reading = reading.then(read, read);
  return reading;
};

/**
 * A lookup for stored uploads ("uploads/projects/3/x.png") built on `readSize`,
 * with its own cache. Never throws: a missing, unreadable or unrecognised file
 * has no known size.
 */
const storedSizeWith = (readSize) => {
  const cache = new Map();

  return async (storedPath) => {
    try {
      const absolutePath = resolveStoredUploadPath(storedPath);
      return absolutePath ? await sizeOfFile(absolutePath, readSize, cache) : null;
    } catch {
      return null;
    }
  };
};

const storedImageSize = storedSizeWith(readImageSize);

module.exports = { parseImageSize, storedImageSize, storedSizeWith };

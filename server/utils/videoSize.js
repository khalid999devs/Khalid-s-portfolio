'use strict';

const { open } = require('fs/promises');
const { storedSizeWith } = require('./imageSize');

// Display width and height of an MP4 or MOV, from its track header. Nothing is decoded.

const MAXIMUM_TOP_LEVEL_BOXES = 64;
const MAXIMUM_MOOV_BYTES = 16 * 1024 * 1024;

// `size` counts the header; 1 means a 64-bit size follows, 0 means "to the end".
const boxAt = (bytes, offset, available) => {
  if (offset + 8 > bytes.length) return null;
  let size = bytes.readUInt32BE(offset);
  let header = 8;

  if (size === 1) {
    if (offset + 16 > bytes.length) return null;
    size = Number(bytes.readBigUInt64BE(offset + 8));
    header = 16;
  } else if (size === 0) {
    size = available;
  }
  if (size < header || size > available) return null;

  return { type: bytes.toString('latin1', offset + 4, offset + 8), size, header };
};

function* childBoxes(bytes) {
  let offset = 0;
  for (;;) {
    const box = boxAt(bytes, offset, bytes.length - offset);
    if (!box) return;
    yield [box.type, bytes.subarray(offset + box.header, offset + box.size)];
    offset += box.size;
  }
}

const trackSize = (header) => {
  // Version 1 widens three fields to 64 bits, which moves everything after them.
  const matrix = header[0] === 1 ? 52 : 40;
  if (header.length < matrix + 44) return null;

  const width = Math.round(header.readUInt32BE(matrix + 36) / 65536);
  const height = Math.round(header.readUInt32BE(matrix + 40) / 65536);
  if (width <= 0 || height <= 0) return null;

  // A quarter turn has zeros on the matrix diagonal, and players show it turned.
  const turned = header.readInt32BE(matrix) === 0 && header.readInt32BE(matrix + 16) === 0;
  return turned ? { width: height, height: width } : { width, height };
};

/** `{ width, height }` of the first video track in a `moov` box's contents, else null. */
const parseMovieSize = (moov) => {
  try {
    for (const [type, track] of childBoxes(moov)) {
      if (type !== 'trak') continue;
      for (const [inner, header] of childBoxes(track)) {
        const size = inner === 'tkhd' ? trackSize(header) : null;
        if (size) return size;
      }
    }
  } catch {
    // A box that claimed more bytes than it had.
  }
  return null;
};

const readAt = async (file, position, length) => {
  const { bytesRead, buffer } = await file.read(Buffer.allocUnsafe(length), 0, length, position);
  return buffer.subarray(0, bytesRead);
};

// `moov` can sit after the media data, so the top-level boxes are walked, not scanned.
const readVideoSize = async (absolutePath) => {
  const file = await open(absolutePath, 'r');
  try {
    const { size: fileSize } = await file.stat();
    let offset = 0;

    for (let count = 0; count < MAXIMUM_TOP_LEVEL_BOXES; count += 1) {
      const box = boxAt(await readAt(file, offset, 16), 0, fileSize - offset);
      if (!box) return null;

      if (box.type === 'moov') {
        const length = box.size - box.header;
        if (length > MAXIMUM_MOOV_BYTES) return null;
        return parseMovieSize(await readAt(file, offset + box.header, length));
      }
      offset += box.size;
    }
    return null;
  } finally {
    await file.close();
  }
};

const storedVideoSize = storedSizeWith(readVideoSize);

module.exports = { parseMovieSize, storedVideoSize };

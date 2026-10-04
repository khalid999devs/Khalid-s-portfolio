'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  utimesSync,
  rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

// The uploads root is fixed when uploadPaths loads, so it is set first.
const scratch = mkdtempSync(join(tmpdir(), 'image-size-'));
const uploads = join(scratch, 'uploads');
mkdirSync(uploads);
process.env.UPLOADS_DIR = uploads;

const { parseImageSize, storedImageSize } = require('../utils/imageSize');

test.after(() => rmSync(scratch, { recursive: true, force: true }));

// --- the smallest headers that carry a size, built byte by byte -------------

const u16le = (n) => Buffer.from([n & 0xff, n >> 8]);
const u16be = (n) => Buffer.from([n >> 8, n & 0xff]);

const png = (width, height) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR', 'ascii'),
    ihdr,
  ]);
};

const gif = (width, height, version = 'GIF89a') =>
  Buffer.concat([Buffer.from(version, 'ascii'), u16le(width), u16le(height)]);

const riff = (chunk, payload) => {
  const sizes = Buffer.alloc(8);
  sizes.writeUInt32LE(payload.length + 12, 0);
  sizes.writeUInt32LE(payload.length, 4);
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    sizes.subarray(0, 4),
    Buffer.from(`WEBP${chunk}`, 'ascii'),
    sizes.subarray(4),
    payload,
  ]);
};

const webpLossy = (width, height) => {
  const payload = Buffer.alloc(10);
  payload.set([0x9d, 0x01, 0x2a], 3);
  payload.writeUInt16LE(width, 6);
  payload.writeUInt16LE(height, 8);
  return riff('VP8 ', payload);
};

const webpLossless = (width, height) => {
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1);
  return riff('VP8L', payload);
};

const webpExtended = (width, height) => {
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return riff('VP8X', payload);
};

const segment = (marker, payload) =>
  Buffer.concat([Buffer.from([0xff, marker]), u16be(payload.length + 2), payload]);

const frame = (width, height, marker = 0xc0) =>
  segment(marker, Buffer.concat([Buffer.from([8]), u16be(height), u16be(width), Buffer.from([3])]));

const jpeg = (...segments) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments]);

const APP0 = segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'));
const DQT = segment(0xdb, Buffer.alloc(65));

// An APP1 segment holding a TIFF directory with just the orientation tag.
const exif = (orientation, order = 'II') => {
  const tiff = Buffer.alloc(26);
  const w16 = (n, at) => (order === 'II' ? tiff.writeUInt16LE(n, at) : tiff.writeUInt16BE(n, at));
  const w32 = (n, at) => (order === 'II' ? tiff.writeUInt32LE(n, at) : tiff.writeUInt32BE(n, at));
  tiff.write(order, 0, 'ascii');
  w16(42, 2);
  w32(8, 4);
  w16(1, 8);
  w16(0x0112, 10);
  w16(3, 12);
  w32(1, 14);
  w16(orientation, 18);
  return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]));
};

// --- the parser -------------------------------------------------------------

test('reads the size from each supported format', () => {
  const cases = [
    ['png', png(1920, 1080), 1920, 1080],
    ['gif 89a', gif(320, 240), 320, 240],
    ['gif 87a', gif(1, 2, 'GIF87a'), 1, 2],
    ['webp lossy', webpLossy(800, 600), 800, 600],
    ['webp lossless', webpLossless(4000, 3000), 4000, 3000],
    ['webp extended', webpExtended(70000, 12), 70000, 12],
    ['jpeg', jpeg(APP0, DQT, frame(1280, 720)), 1280, 720],
  ];

  for (const [name, bytes, width, height] of cases) {
    assert.deepEqual(parseImageSize(bytes), { width, height }, name);
  }
});

test('a PNG larger than 16 bits and a 1x1 image both read correctly', () => {
  assert.deepEqual(parseImageSize(png(70000, 90000)), { width: 70000, height: 90000 });
  assert.deepEqual(parseImageSize(webpLossless(1, 1)), { width: 1, height: 1 });
  assert.deepEqual(parseImageSize(webpLossless(16384, 16384)), { width: 16384, height: 16384 });
});

test('lossy WebP ignores the scaling bits above each 14-bit size', () => {
  const bytes = webpLossy(800, 600);
  bytes.writeUInt16LE(800 | 0xc000, 26);
  bytes.writeUInt16LE(600 | 0x4000, 28);
  assert.deepEqual(parseImageSize(bytes), { width: 800, height: 600 });
});

test('every JPEG frame marker is accepted', () => {
  for (const marker of [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
    assert.deepEqual(
      parseImageSize(jpeg(APP0, frame(640, 480, marker))),
      { width: 640, height: 480 },
      `SOF marker 0x${marker.toString(16)}`
    );
  }
});

test('DHT, JPG and DAC sit in the frame range and are not frames', () => {
  // Each decoy is laid out like a frame header and would read as 9x9.
  for (const marker of [0xc4, 0xc8, 0xcc]) {
    assert.deepEqual(
      parseImageSize(jpeg(APP0, frame(9, 9, marker), frame(640, 480))),
      { width: 640, height: 480 },
      `marker 0x${marker.toString(16)}`
    );
  }
});

test('JPEG segments, fill bytes and standalone markers are skipped', () => {
  const bulky = segment(0xe2, Buffer.alloc(20000, 0xc0));
  const fill = Buffer.from([0xff, 0xff, 0xff]);
  const restart = Buffer.from([0xff, 0xd0]);

  assert.deepEqual(
    parseImageSize(jpeg(APP0, bulky, fill, DQT, restart, frame(300, 200, 0xc2))),
    { width: 300, height: 200 }
  );
});

test('a quarter-turn EXIF orientation swaps width and height', () => {
  for (const order of ['II', 'MM']) {
    for (const orientation of [5, 6, 7, 8]) {
      assert.deepEqual(
        parseImageSize(jpeg(exif(orientation, order), DQT, frame(4000, 3000))),
        { width: 3000, height: 4000 },
        `orientation ${orientation} ${order}`
      );
    }
    for (const orientation of [1, 2, 3, 4]) {
      assert.deepEqual(
        parseImageSize(jpeg(exif(orientation, order), DQT, frame(4000, 3000))),
        { width: 4000, height: 3000 },
        `orientation ${orientation} ${order}`
      );
    }
  }
});

test('with two EXIF segments the first orientation decides', () => {
  assert.deepEqual(
    parseImageSize(jpeg(exif(6), exif(1), frame(4000, 3000))),
    { width: 3000, height: 4000 }
  );
  assert.deepEqual(
    parseImageSize(jpeg(exif(1), exif(6), frame(4000, 3000))),
    { width: 4000, height: 3000 }
  );
});

test('damaged EXIF is ignored rather than failing the image', () => {
  const cut = segment(0xe1, Buffer.from('Exif\0\0II*\0\x08\0\0\0\x05\0', 'latin1'));
  const wild = segment(0xe1, Buffer.from('Exif\0\0MM\0*\xff\xff\xff\xff', 'latin1'));
  const notExif = segment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>', 'latin1'));

  for (const app1 of [cut, wild, notExif]) {
    assert.deepEqual(parseImageSize(jpeg(app1, frame(50, 60))), { width: 50, height: 60 });
  }
});

test('a JPEG with no frame header before its scan data has no size', () => {
  const scan = segment(0xda, Buffer.alloc(10));
  assert.equal(parseImageSize(jpeg(APP0, DQT, scan, frame(10, 10))), null);
  assert.equal(parseImageSize(jpeg(APP0, Buffer.from([0xff, 0xd9]), frame(10, 10))), null);
});

test('truncated, damaged and foreign bytes give null and never throw', () => {
  const lossyWithoutStartCode = webpLossy(10, 10);
  lossyWithoutStartCode[23] = 0;
  const pngWithoutIhdr = png(10, 10);
  pngWithoutIhdr.write('IDAT', 12, 'ascii');
  const wav = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVEfmt ', 'latin1'), Buffer.alloc(20)]);

  const useless = [
    Buffer.alloc(0),
    Buffer.from([0x89, 0x50]),
    png(10, 10).subarray(0, 20),
    pngWithoutIhdr,
    png(0, 10),
    gif(0, 0),
    Buffer.from('GIF89a', 'ascii'),
    Buffer.from('GIF90a\x10\0\x10\0', 'latin1'),
    wav,
    riff('ALPH', Buffer.alloc(20)),
    lossyWithoutStartCode,
    webpLossy(10, 10).subarray(0, 28),
    webpExtended(10, 10).subarray(0, 29),
    jpeg(APP0),
    jpeg(APP0, DQT, frame(10, 10).subarray(0, 7)),
    jpeg(Buffer.from([0xff, 0xe0, 0x00, 0x01])),
    jpeg(Buffer.from([0x00, 0x11, 0x22, 0x33])),
    jpeg(frame(0, 480)),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    Buffer.from('%PDF-1.7\n'.padEnd(64)),
    null,
    undefined,
    'uploads/a.png',
  ];

  for (const bytes of useless) {
    assert.equal(parseImageSize(bytes), null);
  }
});

// --- stored paths -----------------------------------------------------------

const store = (name, bytes) => {
  const path = join(uploads, name);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
  return path;
};

test('resolves a stored path against the uploads root', async () => {
  store('projects/16/thumbnailContents/t.png', png(1440, 900));
  store('projects/16/bannerImg/b.webp', webpExtended(2000, 1000));

  assert.deepEqual(
    await storedImageSize('uploads/projects/16/thumbnailContents/t.png'),
    { width: 1440, height: 900 }
  );
  assert.deepEqual(
    await storedImageSize('uploads/projects/16/bannerImg/b.webp'),
    { width: 2000, height: 1000 }
  );
});

test('a path outside the uploads root is never opened', async () => {
  writeFileSync(join(scratch, 'outside.png'), png(11, 22));

  const escapes = [
    '../outside.png',
    'uploads/../outside.png',
    'uploads/projects/../../outside.png',
    join(scratch, 'outside.png'),
    'uploads\\..\\outside.png',
    'uploads/a.png\0.txt',
  ];
  for (const stored of escapes) {
    assert.equal(await storedImageSize(stored), null, `should refuse ${stored}`);
  }
});

test('anything without a readable size resolves to null instead of throwing', async () => {
  store('notes.png', Buffer.from('not an image at all'.padEnd(64)));
  store('empty.png', Buffer.alloc(0));
  mkdirSync(join(uploads, 'folder.png'));

  const unusable = [
    'uploads/missing.png',
    'uploads/notes.png',
    'uploads/empty.png',
    'uploads/folder.png',
    'uploads/',
    '',
    null,
    undefined,
    42,
    {},
    ['uploads/notes.png'],
  ];
  for (const stored of unusable) {
    assert.equal(await storedImageSize(stored), null, `should be null for ${String(stored)}`);
  }
});

test('a JPEG frame header behind large segments is still found', async () => {
  const padding = (bytes) => segment(0xe2, Buffer.alloc(bytes));

  // Past the first 4 KB read, then past the 64 KB one.
  store('deep-a.jpg', jpeg(APP0, padding(6000), frame(111, 222)));
  store('deep-b.jpg', jpeg(APP0, padding(65000), padding(65000), frame(333, 444)));

  assert.deepEqual(await storedImageSize('uploads/deep-a.jpg'), { width: 111, height: 222 });
  assert.deepEqual(await storedImageSize('uploads/deep-b.jpg'), { width: 333, height: 444 });
});

test('the JPEG scan stops at 512 KB', async () => {
  const padding = Array.from({ length: 9 }, () => segment(0xe2, Buffer.alloc(65000)));
  const path = store('too-deep.jpg', jpeg(APP0, ...padding, frame(555, 666)));

  // Sanity: the whole file does carry a size; it is only out of reach.
  assert.deepEqual(parseImageSize(readFileSync(path)), { width: 555, height: 666 });
  assert.equal(await storedImageSize('uploads/too-deep.jpg'), null);
});

test('a result is cached until the file changes its mtime or size', async () => {
  const path = store('cached.png', png(10, 20));
  const stamp = new Date(1_700_000_000_000);
  utimesSync(path, stamp, stamp);
  assert.deepEqual(await storedImageSize('uploads/cached.png'), { width: 10, height: 20 });

  // Same length and the same mtime: indistinguishable, so the cache answers.
  writeFileSync(path, png(30, 40));
  utimesSync(path, stamp, stamp);
  assert.deepEqual(await storedImageSize('uploads/cached.png'), { width: 10, height: 20 });

  const later = new Date(1_700_000_005_000);
  utimesSync(path, later, later);
  assert.deepEqual(await storedImageSize('uploads/cached.png'), { width: 30, height: 40 });

  // A different length alone is enough too.
  writeFileSync(path, Buffer.concat([png(50, 60), Buffer.alloc(8)]));
  utimesSync(path, later, later);
  assert.deepEqual(await storedImageSize('uploads/cached.png'), { width: 50, height: 60 });
});

test('many lookups at once all resolve', async () => {
  const names = Array.from({ length: 40 }, (_, index) => `burst-${index}.png`);
  names.forEach((name, index) => store(name, png(index + 1, 100)));

  const sizes = await Promise.all(names.map((name) => storedImageSize(`uploads/${name}`)));
  sizes.forEach((size, index) => assert.deepEqual(size, { width: index + 1, height: 100 }));
});

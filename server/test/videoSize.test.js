'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  openSync,
  ftruncateSync,
  closeSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, dirname } = require('path');
const { box, track, movie, mp4, FTYP, QUARTER_TURN } = require('./support/mp4');

// The uploads root is fixed when uploadPaths loads, so it is set first.
const scratch = mkdtempSync(join(tmpdir(), 'video-size-'));
process.env.UPLOADS_DIR = join(scratch, 'uploads');

const { parseMovieSize, storedVideoSize } = require('../utils/videoSize');
const { storedImageSize } = require('../utils/imageSize');

test.after(() => rmSync(scratch, { recursive: true, force: true }));

const store = (name, bytes) => {
  const path = join(scratch, 'uploads', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return path;
};

/** The contents of a `moov` box, which is what the parser is handed. */
const contents = (moov) => moov.subarray(8);

test('reads the display size from the track header', () => {
  assert.deepEqual(parseMovieSize(contents(movie({ width: 1280, height: 720 }))), {
    width: 1280,
    height: 720,
  });
});

test('a version 1 header keeps its size 12 bytes further in', () => {
  const moov = movie({ width: 1920, height: 1080, version: 1 });
  assert.deepEqual(parseMovieSize(contents(moov)), { width: 1920, height: 1080 });
});

test('an audio track ahead of the video is passed over', () => {
  const moov = movie({ width: 0, height: 0 }, { width: 1272, height: 720 });
  assert.deepEqual(parseMovieSize(contents(moov)), { width: 1272, height: 720 });
});

test('a movie with only audio has no size', () => {
  assert.equal(parseMovieSize(contents(movie({ width: 0, height: 0 }))), null);
});

test('a quarter turn swaps width and height, as players display it', () => {
  const moov = movie({ width: 1920, height: 1080, matrix: QUARTER_TURN });
  assert.deepEqual(parseMovieSize(contents(moov)), { width: 1080, height: 1920 });
});

test('the 16.16 fixed-point size is rounded to whole pixels', () => {
  const moov = movie({ width: 853.33, height: 480 });
  assert.deepEqual(parseMovieSize(contents(moov)), { width: 853, height: 480 });
});

test('damaged and foreign bytes give null and never throw', () => {
  const whole = contents(movie({ width: 640, height: 360 }));
  const overrun = Buffer.from(whole);
  // The first child now claims more bytes than the box holds.
  overrun.writeUInt32BE(0x7fffffff, 0);
  const shortHeader = contents(box('moov', box('trak', box('tkhd', Buffer.alloc(20)))));

  const unusable = [
    Buffer.alloc(0),
    Buffer.alloc(7),
    Buffer.from('not a movie at all, just some text'),
    whole.subarray(0, whole.length - 30),
    overrun,
    shortHeader,
    contents(box('moov', box('trak', box('mdia', Buffer.alloc(64))))),
  ];
  for (const bytes of unusable) assert.equal(parseMovieSize(bytes), null);
});

test('finds the movie box before and after the media data', async () => {
  const media = box('mdat', Buffer.alloc(300 * 1024, 1));
  store('front.mp4', mp4(movie({ width: 1280, height: 720 }), media));
  store('back.mp4', mp4(box('free', Buffer.alloc(8)), media, movie({ width: 640, height: 360 })));

  assert.deepEqual(await storedVideoSize('uploads/front.mp4'), { width: 1280, height: 720 });
  assert.deepEqual(await storedVideoSize('uploads/back.mp4'), { width: 640, height: 360 });
});

test('a box with a 64-bit size is stepped over', async () => {
  const payload = Buffer.alloc(64, 1);
  const wide = Buffer.alloc(16);
  wide.writeUInt32BE(1, 0);
  wide.write('mdat', 4, 'latin1');
  wide.writeBigUInt64BE(BigInt(16 + payload.length), 8);

  store('wide.mp4', mp4(wide, payload, movie({ width: 800, height: 600 })));
  assert.deepEqual(await storedVideoSize('uploads/wide.mp4'), { width: 800, height: 600 });
});

test('a movie box above 16 MB is not read', async () => {
  const sized = (name, claimed) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(claimed, 0);
    header.write('moov', 4, 'latin1');
    const path = store(name, Buffer.concat([FTYP, header, track({ width: 640, height: 360 })]));

    // Sparse, so the claim is honest about the file's length without writing 16 MB.
    const file = openSync(path, 'r+');
    ftruncateSync(file, FTYP.length + claimed);
    closeSync(file);
  };
  sized('at-limit.mp4', 16 * 1024 * 1024 + 8);
  sized('over-limit.mp4', 16 * 1024 * 1024 + 9);

  assert.deepEqual(await storedVideoSize('uploads/at-limit.mp4'), { width: 640, height: 360 });
  assert.equal(await storedVideoSize('uploads/over-limit.mp4'), null);
});

test('anything without a readable size resolves to null instead of throwing', async () => {
  store('no-movie.mp4', mp4(box('mdat', Buffer.alloc(64))));
  store('open-ended.mp4', mp4(box('mdat', Buffer.alloc(64)).fill(0, 0, 4), movie({ width: 1, height: 1 })));
  store('cut.mp4', mp4(movie({ width: 640, height: 360 })).subarray(0, FTYP.length + 40));
  store('notes.mp4', Buffer.from('not a video'.padEnd(64)));
  store('empty.mp4', Buffer.alloc(0));
  mkdirSync(join(scratch, 'uploads', 'folder.mp4'));
  writeFileSync(join(scratch, 'outside.mp4'), mp4(movie({ width: 640, height: 360 })));

  const unusable = [
    'uploads/no-movie.mp4',
    'uploads/open-ended.mp4',
    'uploads/cut.mp4',
    'uploads/notes.mp4',
    'uploads/empty.mp4',
    'uploads/folder.mp4',
    'uploads/missing.mp4',
    '../outside.mp4',
    'uploads/../../outside.mp4',
    '',
    null,
    undefined,
    42,
  ];
  for (const stored of unusable) {
    assert.equal(await storedVideoSize(stored), null, `should be null for ${String(stored)}`);
  }
});

test('the image and video lookups never answer for each other', async () => {
  store('clip.mp4', mp4(movie({ width: 1280, height: 720 })));

  assert.deepEqual(await storedVideoSize('uploads/clip.mp4'), { width: 1280, height: 720 });
  assert.equal(await storedImageSize('uploads/clip.mp4'), null);
  // And again, now that both have cached their answer.
  assert.deepEqual(await storedVideoSize('uploads/clip.mp4'), { width: 1280, height: 720 });
  assert.equal(await storedImageSize('uploads/clip.mp4'), null);
});

test('a track with a later usable header is still found', () => {
  const moov = box(
    'moov',
    box('trak', box('edts', Buffer.alloc(12)), track({ width: 0, height: 0 }).subarray(8)),
    track({ width: 320, height: 240 })
  );
  assert.deepEqual(parseMovieSize(contents(moov)), { width: 320, height: 240 });
});

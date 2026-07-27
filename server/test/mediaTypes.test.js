'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const { detectFileType, isTypeAllowedForField } = require('../utils/mediaTypes');

const scratch = mkdtempSync(join(tmpdir(), 'media-types-'));

const fileWith = (name, bytes) => {
  const path = join(scratch, name);
  writeFileSync(path, bytes);
  return path;
};

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32),
]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypisom', 'ascii'),
  Buffer.alloc(32),
]);
const MKV = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]);
const WAV = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.alloc(4),
  Buffer.from('WAVE', 'ascii'),
  Buffer.alloc(32),
]);

test('detects each supported type from its bytes', () => {
  const cases = [
    [PNG, 'image/png', 'png'],
    [JPEG, 'image/jpeg', 'jpeg'],
    [WEBP, 'image/webp', 'webp'],
    [MP4, 'video/mp4', 'mp4'],
    [MKV, 'video/x-matroska', 'mkv'],
    [WAV, 'audio/wav', 'wav'],
  ];

  for (const [bytes, type, extension] of cases) {
    const detected = detectFileType(fileWith(`${extension}-sample`, bytes));
    assert.equal(detected?.type, type);
    assert.equal(detected?.extension, extension);
  }
});

/**
 * The bypass the old filter allowed: the client claimed video/mp4 and named the
 * file .html, and the server believed both. The bytes are what decide now.
 */
test('HTML is not identified as media whatever it is named or claimed to be', () => {
  const html = Buffer.from('<script>alert(document.domain)</script>'.padEnd(64));
  assert.equal(detectFileType(fileWith('payload.html', html)), null);
  assert.equal(detectFileType(fileWith('payload.mp4', html)), null);
  assert.equal(detectFileType(fileWith('payload.png', html)), null);
});

test('other executable-ish content is not identified as media', () => {
  assert.equal(detectFileType(fileWith('a.svg', Buffer.from('<svg onload=alert(1)>'.padEnd(64)))), null);
  assert.equal(detectFileType(fileWith('a.php', Buffer.from('<?php system($_GET[0]); ?>'.padEnd(64)))), null);
  assert.equal(detectFileType(fileWith('a.sh', Buffer.from('#!/bin/sh\nrm -rf /'.padEnd(64)))), null);
  assert.equal(detectFileType(fileWith('a.empty', Buffer.alloc(0))), null);
});

test('WEBP and WAV are distinguished despite sharing a RIFF header', () => {
  assert.equal(detectFileType(fileWith('r1', WEBP)).kind, 'image');
  assert.equal(detectFileType(fileWith('r2', WAV)).kind, 'audio');
});

test('a truncated header is not force-matched', () => {
  assert.equal(detectFileType(fileWith('short', Buffer.from([0x89, 0x50]))), null);
  assert.equal(detectFileType(fileWith('riff-only', Buffer.from('RIFF', 'ascii'))), null);
});

test('each field accepts only the kinds it is meant to hold', () => {
  const png = detectFileType(fileWith('f1', PNG));
  const mp4 = detectFileType(fileWith('f2', MP4));

  assert.ok(isTypeAllowedForField('bannerImg', png));
  assert.ok(isTypeAllowedForField('sliderContents', png));
  assert.ok(isTypeAllowedForField('thumbnailContents', png));
  assert.ok(isTypeAllowedForField('videos', mp4));

  assert.ok(!isTypeAllowedForField('bannerImg', mp4));
  assert.ok(!isTypeAllowedForField('videos', png));
  assert.ok(!isTypeAllowedForField('notAField', png));
  assert.ok(!isTypeAllowedForField('bannerImg', null));
});

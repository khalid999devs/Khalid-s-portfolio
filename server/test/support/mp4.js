'use strict';

// Builds just enough of an MP4 for its track header to be read.

const box = (type, ...parts) => {
  const payload = Buffer.concat(parts);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
};

const IDENTITY = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
const QUARTER_TURN = [0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000];

const trackHeader = ({ width, height, version = 0, matrix = IDENTITY }) => {
  const lead = version === 1 ? 52 : 40;
  const bytes = Buffer.alloc(lead + 44);
  bytes[0] = version;
  matrix.forEach((value, index) => bytes.writeInt32BE(value, lead + index * 4));
  bytes.writeUInt32BE(Math.round(width * 65536), lead + 36);
  bytes.writeUInt32BE(Math.round(height * 65536), lead + 40);
  return box('tkhd', bytes);
};

const track = (options) => box('trak', trackHeader(options), box('mdia', Buffer.alloc(32)));

const movie = (...tracks) => box('moov', box('mvhd', Buffer.alloc(100)), ...tracks.map(track));

const FTYP = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'latin1'));

const mp4 = (...boxes) => Buffer.concat([FTYP, ...boxes]);

module.exports = { box, track, trackHeader, movie, mp4, FTYP, QUARTER_TURN };

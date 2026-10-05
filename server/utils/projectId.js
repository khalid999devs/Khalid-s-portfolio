'use strict';

// A project id as a route carries it: plain digits, from 1 up. Number() alone
// also takes '7e0', '0x7' and ' 7 ', and MySQL reads '7abc' as 7.
const parseProjectId = (value) => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

module.exports = parseProjectId;

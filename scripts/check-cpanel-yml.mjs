#!/usr/bin/env node
// Fails when a task in .cpanel.yml would not reach cPanel as a plain string.
//
// cPanel parses the file with Perl's YAML and writes each task into a bash
// script. A task that parses as anything other than a string is stringified
// instead -- the deploy ran `HASH(0x29a43c0)` and died with a bash syntax
// error, which reads as "cPanel is broken" rather than "that line has a colon
// in it". This is deliberately dependency-free: it runs on a clean checkout.
//
// The rule for an unquoted YAML scalar: no ": ", no trailing ":", no " #", and
// it may not open with an indicator character. Quote the task and none of it
// applies.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, '.cpanel.yml');

const INDICATORS = ['{', '[', '&', '*', '!', '|', '>', '%', '@', '`', '#'];

const lines = readFileSync(FILE, 'utf8').split('\n');
const problems = [];
let inTasks = false;

lines.forEach((line, index) => {
  if (/^\s*tasks:\s*$/.test(line)) {
    inTasks = true;
    return;
  }
  if (!inTasks) return;

  const item = line.match(/^\s+- (.*)$/);
  if (!item) {
    // A non-comment, non-blank line at a shallower level ends the list.
    if (line.trim() && !line.trim().startsWith('#')) inTasks = false;
    return;
  }

  const task = item[1].trim();
  const at = `.cpanel.yml:${index + 1}`;

  // A quoted scalar carries anything; nothing below can apply to it.
  const quoted =
    (task.startsWith("'") && task.endsWith("'")) ||
    (task.startsWith('"') && task.endsWith('"'));
  if (quoted) return;

  if (task.includes(': ')) {
    problems.push(`${at}  contains ": " -- YAML reads this as a mapping. Quote it.`);
  }
  if (task.endsWith(':')) {
    problems.push(`${at}  ends with ":" -- YAML reads this as a mapping. Quote it.`);
  }
  if (task.includes(' #')) {
    problems.push(`${at}  contains " #" -- the rest of the line becomes a comment. Quote it.`);
  }
  if (INDICATORS.includes(task[0])) {
    problems.push(`${at}  starts with "${task[0]}", a YAML indicator. Quote it.`);
  }
});

if (problems.length > 0) {
  console.error('.cpanel.yml has tasks that will not reach cPanel as strings:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nA task that is not a string is written into the deploy script as');
  console.error('HASH(0x...) and the deploy dies with a bash syntax error.');
  process.exit(1);
}

console.log('.cpanel.yml: every task parses as a plain string.');

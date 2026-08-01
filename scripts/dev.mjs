#!/usr/bin/env node
// Runs the API and the client together, with their output interleaved and
// labelled. Stopping one stops the other, so Ctrl-C never leaves a stray dev
// server holding port 8000 or 5173.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Built at runtime so no escape byte is stored in this file: a control
// character in source survives right up until an editor or formatter eats it.
// Dropped when the output is not a terminal, so piping to a log does not
// embed colour codes in it.
const ESC = String.fromCharCode(27);
const colour = (code) => (process.stdout.isTTY ? ESC + '[' + code + 'm' : '');
const RESET = colour(0);

const TARGETS = [
  { name: 'server', cwd: resolve(ROOT, 'server'), tint: colour(35) },
  { name: 'client', cwd: resolve(ROOT, 'client'), tint: colour(36) },
];

const children = [];
let stopping = false;

// Each child is its own process group, so this reaches vite and node --watch
// rather than only the npm wrapper that spawned them.
const stopAll = (code) => {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;

  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
};

for (const { name, cwd, tint } of TARGETS) {
  const label = `${tint}${name.padEnd(6)}${RESET} | `;
  const child = spawn(NPM, ['run', 'dev'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  children.push(child);

  // Buffered to the newline. Writing each chunk as it arrives puts the label
  // in the middle of a line whenever a message is delivered in pieces, which
  // vite's startup banner does every time.
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) process.stdout.write(label + line + '\n');
    });
  }

  child.on('error', (error) => {
    process.stdout.write(`${label}failed to start: ${error.message}\n`);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    process.stdout.write(`${label}exited (${signal || code})\n`);
    stopAll(code ?? 1);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));

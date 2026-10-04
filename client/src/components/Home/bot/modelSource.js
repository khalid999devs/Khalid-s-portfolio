// Downloads the bot model once, with byte progress, and hands the loader a blob URL.
const MODEL_URL = '/scene.glb';
const RETRY_DELAY_MS = 1500;

let pending = null;
let progress = 0;
const listeners = new Set();

const setProgress = (value) => {
  const next = Math.round(value * 10) / 10;
  if (next === progress) return;
  progress = next;
  listeners.forEach((listener) => listener());
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const download = async () => {
  // Low priority: the bot's code shares the connection and is needed first.
  const response = await fetch(MODEL_URL, { priority: 'low' });
  if (!response.ok) {
    throw new Error(`Could not load ${MODEL_URL}: ${response.status}`);
  }

  const total = Number(response.headers.get('content-length'));
  if (!response.body || !total) {
    const blob = await response.blob();
    setProgress(100);
    return URL.createObjectURL(blob);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    // Capped below 100: a compressed transfer yields more bytes than its header states.
    setProgress(Math.min(99.9, (loaded / total) * 100));
  }
  setProgress(100);
  return URL.createObjectURL(new Blob(chunks, { type: 'model/gltf-binary' }));
};

// One retry. A failure is kept, not retried on the next call: React's `use`
// needs the same promise back to see the rejection, and a fresh attempt on
// every render would download the file in a loop.
export const loadModel = () => {
  if (!pending) {
    pending = download().catch(() => wait(RETRY_DELAY_MS).then(download));
  }
  return pending;
};

export const subscribeProgress = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getProgress = () => progress;

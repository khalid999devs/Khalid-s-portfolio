import { reqs } from '../axios/requests';
import { HttpError, request } from './http';

const PREFETCH_TTL_MS = 30000;

const postProjects = (body, options) =>
  request(reqs.GET_PROJECT, { ...options, method: 'POST', body });

// GET first. A server from before the GET routes answers "Route does not
// exist", and the POST it does have still works; this fallback can go once
// every deployment has them.
const readProjects = (path, body, options) =>
  request(path, options).catch((error) => {
    // A missing project is a 404 too, but it says so; that one is final.
    const routeMissing =
      error instanceof HttpError &&
      error.status === 404 &&
      (!error.data || /route does not exist/i.test(error.data.msg || ''));
    const unsupported =
      routeMissing || (error instanceof HttpError && error.status === 405);
    if (!unsupported) throw error;
    return postProjects(body, options);
  });

export const fetchSettings = (options) => request(reqs.GET_SETTINGS, options);

export const fetchProjects = (options) =>
  readProjects(reqs.GET_PROJECT, { mode: 'all' }, options);

// The GET route takes a numeric id. Anything else goes to the POST, which
// answers a malformed id the way it always has.
const fetchProject = (id) => {
  const body = { mode: 'single', projectId: id };
  return /^\d+$/.test(id)
    ? readProjects(`${reqs.GET_PROJECT}/${id}`, body)
    : postProjects(body);
};

const fetchAbout = () => request(reqs.GET_ABOUT);

// A prefetch is used once and only while fresh, so a page never shows data
// older than the visit that opened it.
const prefetched = new Map();

// Resolves when the request has settled, whichever way; the outcome itself
// belongs to whoever takes it.
const prefetch = (key, load) => {
  const entry = prefetched.get(key);
  if (entry && Date.now() - entry.at < PREFETCH_TTL_MS) return entry.settled;

  const pending = load();
  const settled = pending.then(
    () => {},
    () => {}
  );
  prefetched.set(key, { at: Date.now(), pending, settled });
  return settled;
};

const take = (key, load) => {
  const entry = prefetched.get(key);
  prefetched.delete(key);
  return entry && Date.now() - entry.at < PREFETCH_TTL_MS ? entry.pending : load();
};

export const prefetchProject = (id) =>
  prefetch(`project:${id}`, () => fetchProject(String(id)));

// Hover is a mouse signal only: a touch that starts a scroll also "enters".
export const prefetchProjectOnHover = (id) => (event) => {
  if (event.pointerType === 'mouse') prefetchProject(id);
};

export const takeProject = (id) =>
  take(`project:${id}`, () => fetchProject(String(id)));

export const prefetchAbout = () => prefetch('about', fetchAbout);

export const takeAbout = () => take('about', fetchAbout);

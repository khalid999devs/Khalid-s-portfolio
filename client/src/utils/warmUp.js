import { prefetchAbout, prefetchProject } from '../api/public';

let warmed = false;

// Requests the data of the page behind the intro while the intro plays.
// Data only: larger downloads during the intro cost 15 Lighthouse points.
export const warmUp = (pathname) => {
  if (warmed) return;
  warmed = true;

  const project = /^\/singleProject\/([^/]+)/i.exec(pathname);
  if (project) {
    try {
      prefetchProject(decodeURIComponent(project[1]).split('@').pop());
    } catch {
      // A malformed URL is the page's to report.
    }
  }
  if (/^\/about-me\/?$/i.test(pathname)) prefetchAbout();
};

import { projectPlaceholder } from '../assets';

// Uploaded media and database rows live in two places, so a restore, a server
// move, or a purge can leave a row pointing at bytes that are no longer there.
// Without this the browser paints its broken-image glyph and the alt text,
// which reads as a bug in the site rather than one absent file.
export const handleImageFallback = (event) => {
  const image = event.currentTarget;

  // The placeholder is bundled with the app, but guard anyway: if it ever
  // failed to load, reassigning src on its own error would loop forever.
  if (image.dataset.fallbackApplied === 'true') return;

  image.dataset.fallbackApplied = 'true';
  image.src = projectPlaceholder;
};

export default handleImageFallback;

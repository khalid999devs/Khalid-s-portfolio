import { useEffect } from 'react';
import PropTypes from 'prop-types';

const SITE_NAME = 'Khalid Ahammed';
const SITE_ORIGIN = 'https://khalidahammed.com';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-banner.jpg`;
const DEFAULT_TITLE = 'Khalid Ahammed — Full-Stack Web & Mobile Developer';
const DEFAULT_DESCRIPTION =
  'Khalid Ahammed is a full-stack developer building scalable, high-performance web and mobile products with modern JavaScript, React, Node.js, and related technologies.';
const INDEXABLE_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const PRIVATE_ROBOTS = 'noindex, nofollow';
const PAGE_SCHEMA_ID = 'page-schema';

const normalizeMetaText = (value, fallback, maximumLength) => {
  if (typeof value !== 'string') return fallback;

  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized ? normalized.slice(0, maximumLength) : fallback;
};

const getCanonicalUrl = () => {
  const pathname =
    typeof window === 'undefined' ? '/' : window.location.pathname;
  return new URL(pathname, SITE_ORIGIN).href;
};

const getMetaImage = (image) => {
  if (typeof image !== 'string' || !image.trim()) return DEFAULT_IMAGE;

  try {
    const parsedImage = new URL(image.trim(), SITE_ORIGIN);
    if (
      !['http:', 'https:'].includes(parsedImage.protocol) ||
      parsedImage.username ||
      parsedImage.password
    ) {
      return DEFAULT_IMAGE;
    }
    return parsedImage.href;
  } catch {
    return DEFAULT_IMAGE;
  }
};

// Upsert rather than append. index.html ships a complete default set so that
// crawlers which never execute JavaScript still receive valid metadata; every
// update here rewrites those same elements in place. Appending instead would
// leave a page serving two titles and two conflicting canonicals, which search
// engines resolve by discarding both.
const upsertElement = (selector, createElement) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = createElement();
    document.head.appendChild(element);
  }

  return element;
};

const setMeta = (keyName, keyValue, content) => {
  const element = upsertElement(
    `meta[${keyName}="${keyValue}"]`,
    () => {
      const created = document.createElement('meta');
      created.setAttribute(keyName, keyValue);
      return created;
    }
  );

  element.setAttribute('content', content);
};

const setCanonical = (href) => {
  const existing = document.head.querySelector('link[rel="canonical"]');

  // A non-indexable page must not advertise a canonical URL; that would invite
  // indexing of the very URL the robots directive excludes.
  if (!href) {
    existing?.remove();
    return;
  }

  const element =
    existing ||
    upsertElement('link[rel="canonical"]', () => {
      const created = document.createElement('link');
      created.setAttribute('rel', 'canonical');
      return created;
    });

  element.setAttribute('href', href);
};

const setPageSchema = (structuredData) => {
  const existing = document.head.querySelector(
    `script[data-schema="${PAGE_SCHEMA_ID}"]`
  );

  if (!structuredData) {
    existing?.remove();
    return;
  }

  const element =
    existing ||
    (() => {
      const created = document.createElement('script');
      created.setAttribute('type', 'application/ld+json');
      created.setAttribute('data-schema', PAGE_SCHEMA_ID);
      document.head.appendChild(created);
      return created;
    })();

  element.textContent = JSON.stringify(structuredData);
};

function MetaCard({
  title,
  description,
  image,
  noIndex = false,
  type = 'website',
  structuredData = null,
}) {
  const normalizedTitle = normalizeMetaText(title, '', 120);
  const pageTitle = normalizedTitle
    ? `${normalizedTitle} | ${SITE_NAME}`
    : DEFAULT_TITLE;
  const normalizedDescription = normalizeMetaText(
    description,
    DEFAULT_DESCRIPTION,
    300
  );
  const metaImage = getMetaImage(image);
  const previewAlt = `${normalizedTitle || SITE_NAME} preview`;
  const serializedSchema = structuredData
    ? JSON.stringify(structuredData)
    : null;

  useEffect(() => {
    const canonicalUrl = getCanonicalUrl();

    document.title = pageTitle;
    setCanonical(noIndex ? null : canonicalUrl);
    setMeta('name', 'robots', noIndex ? PRIVATE_ROBOTS : INDEXABLE_ROBOTS);
    setMeta('name', 'description', normalizedDescription);
    setMeta('property', 'og:title', pageTitle);
    setMeta('property', 'og:description', normalizedDescription);
    setMeta('property', 'og:image', metaImage);
    setMeta('property', 'og:image:alt', previewAlt);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:locale', 'en_US');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', pageTitle);
    setMeta('name', 'twitter:description', normalizedDescription);
    setMeta('name', 'twitter:image', metaImage);
    setMeta('name', 'twitter:image:alt', previewAlt);
    setPageSchema(serializedSchema ? JSON.parse(serializedSchema) : null);
  }, [
    metaImage,
    noIndex,
    normalizedDescription,
    pageTitle,
    previewAlt,
    serializedSchema,
    type,
  ]);

  return null;
}

MetaCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
  noIndex: PropTypes.bool,
  type: PropTypes.string,
  structuredData: PropTypes.object,
};

export { SITE_NAME, SITE_ORIGIN };
export default MetaCard;

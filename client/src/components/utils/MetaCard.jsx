import PropTypes from 'prop-types';

/**
 * Renders document metadata directly. React 19 hoists <title> and <meta> into
 * <head> from anywhere in the tree, so no library is involved.
 *
 * This used to be wrapped in react-helmet-async's <Helmet>. On React 19 that
 * package detects the version, stops managing <head>, and renders the same
 * elements for React to hoist -- its own documentation says a project that
 * needs no htmlAttributes, bodyAttributes, SSR context, onChangeClientState,
 * prioritizeSeoTags or titleTemplate may not need it at all. This one needs
 * none of them, and it was the source of two regressions in this upgrade, so
 * it is gone.
 *
 * Two things the hoisting requires, both learned the hard way:
 *
 *   - <title> must have exactly ONE text child. A stray space before the
 *     closing tag makes two, and React silently skips the tag; Helmet 2 used
 *     to trim it, which is why every page title came back empty here.
 *   - Nothing de-duplicates. Helmet merged multiple instances into one set of
 *     tags with the deepest value winning, so rendering a site-wide default
 *     plus a per-page override was safe. It is not any more -- each route must
 *     render exactly one MetaCard, or its tags are emitted twice.
 */
function MetaCard({ title, description, image }) {
  return (
    <>
      <title>{title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'}</title>
      <meta
        name='description'
        content={
          description ||
          'Khalid Ahammed is a software engineer working remotely with a team in Montreal. He builds web and mobile products in TypeScript, Swift, React and Node.'
        }
      />

      {/* Open Graph Meta Tags (Facebook, LinkedIn) */}
      <meta
        property='og:title'
        content={title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'}
      />
      <meta
        property='og:description'
        content={
          description ||
          'Khalid Ahammed is a software engineer working remotely with a team in Montreal. He builds web and mobile products in TypeScript, Swift, React and Node.'
        }
      />
      <meta
        property='og:image'
        content={image || 'https://khalidahammed.com/og-banner.jpg'}
      />
      <meta property='og:url' content={window.location.href} />
      <meta property='og:type' content='website' />

      {/* Twitter Card Meta Tags */}
      <meta name='twitter:card' content='summary_large_image' />
      <meta
        name='twitter:title'
        content={title ? `${title} | Khalid Ahammed` : 'Khalid Ahammed'}
      />
      <meta
        name='twitter:description'
        content={
          description ||
          'Khalid Ahammed is a software engineer working remotely with a team in Montreal. He builds web and mobile products in TypeScript, Swift, React and Node.'
        }
      />
      <meta
        name='twitter:image'
        content={image || 'https://khalidahammed.com/og-banner.jpg'}
      />
    </>
  );
}


MetaCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
};

export default MetaCard;

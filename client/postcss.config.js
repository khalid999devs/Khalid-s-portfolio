export default {
  plugins: {
    // Tailwind 4 ships its PostCSS plugin as a separate package. Autoprefixer is
    // gone with it: v4 handles vendor prefixing itself, and running autoprefixer
    // over already-prefixed output is at best redundant.
    '@tailwindcss/postcss': {},
  },
};

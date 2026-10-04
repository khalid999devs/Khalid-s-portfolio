import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { publicRoutes } from './src/Constants/routes.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const bootFile = (name) => readFileSync(`${HERE}boot/${name}`, 'utf8').trim();

// Comment lines and indentation are for the source file, not for every visitor.
const compact = (code) =>
  code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//') && !line.startsWith('/*'))
    .join('\n');

// '/singleProject/:value' becomes '/singleProject/[^/]+'; a trailing slash is allowed.
const publicPathPattern = () =>
  `^(?:${publicRoutes
    .map(({ path }) => (path === '/' ? '/' : `${path.replace(/:[^/]+/g, '[^/]+')}/?`))
    .join('|')})$`;

/**
 * Puts the intro loader into index.html, so it paints as soon as the HTML
 * arrives. From client/boot/: its markup inside #root, its rules inline, and a
 * script that recovers when the bundles fail. The full stylesheet then loads
 * without blocking; src/main.jsx waits for it before mounting.
 */
const bootShell = (apiOrigin) => ({
  name: 'boot-shell',
  transformIndexHtml: {
    order: 'post',
    handler(html, { bundle }) {
      const entry = Object.values(bundle || {}).find(
        (file) => file.type === 'chunk' && file.isEntry
      );

      // Function replacers throughout: a `$` in a replacement string is a
      // substitution pattern, and the route pattern ends in one.
      const script = compact(bootFile('boot.js'))
        .replace('__API_ORIGIN__', () => apiOrigin)
        .replace('__PUBLIC_PATHS__', () => publicPathPattern())
        .replace(
          '__BUILD__',
          () => /index-([\w-]+)\.js$/.exec(entry?.fileName || '')?.[1] || 'dev'
        );

      // Credentialed, to match the requests src/api/http.js makes.
      const preconnect = apiOrigin
        ? `<link rel="preconnect" href="${apiOrigin}" crossorigin="use-credentials" />\n    `
        : '';

      return html
        .replace(
          /<link rel="stylesheet"([^>]*)>/,
          (tag, attributes) =>
            // Still fetched first: the app cannot mount without it.
            `<link rel="stylesheet"${attributes} media="print" fetchpriority="high" ` +
            `data-app-css onload="this.media='all'" onerror="this.media='all'">` +
            `<noscript>${tag}</noscript>`
        )
        .replace(
          '<title>',
          () =>
            `${preconnect}<style>${bootFile('shell.css')}</style>\n` +
            `    <script>${script}</script>\n    <title>`
        )
        .replace(
          '<div id="root"></div>',
          () => `<div id="root">${bootFile('shell.html')}</div>`
        );
    },
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, HERE, 'VITE_');
  // Empty while developing: the boot script then reports nothing and adds no preconnect.
  const apiOrigin = command === 'build' ? (env.VITE_API_URL || '').replace(/\/+$/, '') : '';

  return {
    plugins: [react(), bootShell(apiOrigin)],
    build: {
      rollupOptions: {
        output: {
          /**
           * Without this the whole application is one chunk. A clean build
           * produced a single 1,510 KB / 439 KiB gzip file containing React,
           * Router, GSAP, Lenis, Framer Motion, the entire three.js stack, every
           * icon set and every public page -- all of it blocking first render,
           * and all of it re-downloaded whenever one line of app code changed.
           *
           * Splitting vendors by library stops a content change invalidating the
           * parts that did not change, and lets the 3D stack leave the critical
           * path entirely now that `Scene` is lazily imported.
           */
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;

            // three.js, fiber and drei are deliberately NOT named here. Naming a
            // chunk makes it a static dependency of whatever references it, and
            // Vite then emits a modulepreload link for it in index.html -- which
            // put all 213 KiB of the 3D stack back on the critical path despite
            // `Scene` being lazily imported. Left unnamed, Rollup places them in
            // the async Scene chunk, which is the whole point.

            if (id.includes('/gsap/') || id.includes('/lenis/')) return 'animation';
            if (id.includes('/framer-motion/') || id.includes('/motion-')) {
              return 'framer-motion';
            }
            if (id.includes('/react-icons/')) return 'icons';

            // @dnd-kit is not named, for the same reason three.js is not: it is
            // reached only from the lazily-imported admin panel, and naming a
            // chunk makes it a static dependency with a modulepreload link. Under
            // Rollup that cost 16 KiB of critical path; under rolldown, which
            // hoists a named chunk's shared dependencies into it too, the same
            // line cost 58 KiB. Unnamed, it lands in the async admin chunk where
            // a public visitor never downloads it.

            // Anchored to node_modules/ on purpose. `/react/` alone also matches
            // `@tiptap/react`, which dragged TipTap and the whole ProseMirror
            // stack into this eager chunk: 88 KiB gzip became 171 and the
            // critical path went over budget, for an editor only the admin loads.
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react-router') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react';
            }

            // No catch-all. A `return 'vendor'` here swept three.js into the same
            // chunk as dependencies the entry needs, and a chunk is critical if
            // *any* of its modules are -- so the entire 3D stack came back onto
            // the critical path. Returning undefined lets Rollup place each
            // remaining module by how it is actually reached, which puts the
            // lazily-imported ones in the async chunk where they belong.
            return undefined;
          },
        },
      },
      // The single-chunk build tripped this on every run. With splitting in place
      // the warning means something again rather than being constant noise.
      chunkSizeWarningLimit: 700,
    },
  };
});

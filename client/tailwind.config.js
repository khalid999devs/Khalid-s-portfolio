/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          main: '#FFFFFF',
          dark: '#2F2E31',
        },
        onPrimary: {
          main: '#D5D5D5',
          dark: '#BCBCBC',
        },
        secondary: {
          main: '#6B6B6C',
          light: '#919191',
          dark: '#8E8E8E',
        },
        body: {
          main: '#161616',
        },
      },
    },
    /*
      Every breakpoint is declared here, in px, including the four that used to
      come from Tailwind's defaults. That is deliberate and it is not stylistic.

      Tailwind 4 defines its default breakpoints in rem and emits breakpoint
      media queries grouped by unit -- every px-valued breakpoint first, then
      every rem-valued one -- rather than in ascending order of actual size. Add
      px breakpoints to a rem scale and the emitted order becomes:

        770px 860px 1380px 1520px | 640px 768px 1024px 1280px

      Utilities have equal specificity and live in the same cascade layer, so
      order alone decides the winner: `lg:` (64rem) came after `2xl:` (1380px)
      and beat it at every viewport. Every custom breakpoint was silently dead
      -- h1 rendered at 75px instead of 100px, h2 at 58px instead of 75px, and
      the projects grid images at 350px instead of 300px, all while looking
      perfectly reasonable.

      One unit throughout fixes the ordering. px rather than rem because these
      are the values Tailwind 3 used, and rem breakpoints additionally respond
      to the reader's browser font-size setting, which px ones do not -- that
      would be a real behavioural change, not just a different notation.
    */
    /*
      Tailwind 3's absolute line-heights, restored.

      v4 changed the font-size scale to carry unitless line-height ratios --
      `--text-xs--line-height: calc(1 / .75)`, i.e. 1.333 -- where v3 shipped
      absolute lengths like `1rem`. The difference only shows when one utility
      sets the font size and a different one supplies the line height, which is
      exactly what `sm:text-[11px] text-xs` does here: v3 held the line box at
      16px, v4 rescaled it to 1.333 x 11px = 14.66px.

      Ratios are the better default and this is not a criticism of them, but
      they are a behaviour change, so the v3 values are pinned instead. Listed
      in full because `fontSize` replaces the scale rather than extending it.
    */
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }],
      '7xl': ['4.5rem', { lineHeight: '1' }],
      '8xl': ['6rem', { lineHeight: '1' }],
      '9xl': ['8rem', { lineHeight: '1' }],
    },
    screens: {
      sm: '640px',
      md: '768px',
      mds: '770px',
      mdl: '860px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1380px',
      '3xl': '1520px',
    },
  },
  plugins: [],
};

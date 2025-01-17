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
      screens: {
        mds: '770px',
        mdl: '860px',
        '2xl': '1380px',
        '3xl': '1520px',
      },
    },
  },
  plugins: [],
};

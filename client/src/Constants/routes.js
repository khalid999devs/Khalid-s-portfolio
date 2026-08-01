// Public routes in one place: main.jsx renders them, scripts/generate-sitemap.mjs
// reads them. Adding a page here is the only edit a new page needs.
//
// No imports on purpose -- the sitemap generator is plain Node and loads this
// file directly, so anything pulled in here would have to run there too.
//
// `sitemap: false` is a deliberate exclusion. Every route states its intent,
// so a page is never left out of search by forgetting a second file.
export const publicRoutes = [
  {
    id: 'home',
    path: '/',
    sitemap: { changefreq: 'monthly', priority: '1.0' },
  },
  {
    id: 'projects',
    path: '/projects',
    sitemap: { changefreq: 'weekly', priority: '0.9' },
  },
  {
    id: 'about',
    path: '/about-me',
    sitemap: { changefreq: 'monthly', priority: '0.8' },
  },
  {
    // The generator emits one entry per project from the live catalogue, so a
    // static entry for the pattern itself would be a URL nothing serves.
    id: 'singleProject',
    path: '/singleProject/:value',
    sitemap: false,
  },
  {
    // A stub with no navigation link. Index it once it is a real page.
    id: 'codingLab',
    path: '/coding-lab',
    sitemap: false,
  },
];

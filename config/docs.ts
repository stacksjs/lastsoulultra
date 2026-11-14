import type { BunPressOptions } from '@stacksjs/bunpress'
import styleGuide from '../docs/style-guide/generated/sidebar.json'
import { siteStyleToken } from './style-guide'

const red = siteStyleToken('--lsu-red')
const docsTheme = {
  logo: '/docs/style-guide/lsu-logo.svg',
  socialLinks: [],
  editLink: { pattern: '' },
  footer: { message: 'Last Soul Ultra private preview', copyright: 'Last Soul Ultra' },
  colors: {
    // The action fill stays LSU red. Links are lifted for readable small text
    // on black and panel surfaces, including their hover and focus states.
    primary: `color-mix(in srgb, ${red}, white 28%)`,
    secondary: `color-mix(in srgb, ${red}, white 45%)`,
    accent: red,
    background: siteStyleToken('--lsu-black'),
    surface: siteStyleToken('--lsu-card'),
    text: siteStyleToken('--lsu-white'),
    muted: '#b6b6bd',
  },
  fonts: {
    heading: siteStyleToken('--lsu-display'),
    body: siteStyleToken('--lsu-body'),
    mono: siteStyleToken('--lsu-mono'),
  },
  cssVars: {
    'bp-c-bg-elv': siteStyleToken('--lsu-card-alt'),
    'bp-c-divider': '#333338',
    'bp-c-text-3': '#b6b6bd',
    'bp-c-brand-soft': `color-mix(in srgb, ${red}, transparent 85%)`,
    'bp-button-brand-hover-text': siteStyleToken('--lsu-black'),
    'bp-button-brand-active-text': siteStyleToken('--lsu-black'),
    'bp-nav-logo-height': '28px',
  },
  css: `
    :root { color-scheme: dark; }
    .bp-doc { font-size: 18px; line-height: 1.7; }
    .bp-doc h1, .bp-doc h2, .bp-doc h3 { font-weight: 400; letter-spacing: .02em; text-transform: uppercase; overflow-wrap: anywhere; }
    .bp-doc h1 { font-size: clamp(2.4rem, 5vw, 3.6rem); line-height: 1.15; }
    .bp-doc h2 { font-size: 1.9rem; line-height: 1.25; }
    .BPNavBarTitle-logo { height: 28px; width: auto; }
    .BPNavBarTitle-text { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
    .BPNavBarMenu a { font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    .BPNavBarSearch, .BPSearch-panel, .BPSearch-cancel { border-radius: 2px; }
    html[data-theme-mode="dark"] .theme-toggle { display: none; }
    html[data-theme-mode="dark"] .BPSocialLinks:has(> .theme-toggle:only-child) { display: none; }
    :root :is(a, button, input, select, textarea, summary):focus-visible { outline: 2px solid var(--bp-c-brand-1); outline-offset: 3px; }
    @media (max-width: 600px) { .BPNavBarTitle-logo { height: 24px; } .bp-doc { font-size: 17px; } }
  `,
} satisfies NonNullable<BunPressOptions['themeConfig']>

/** Shared by Buddy's docs server and the production BunPress build. */
export default {
  title: 'Last Soul Ultra guide',
  description: 'Race information, training, coaching and administration for Last Soul Ultra.',
  lang: 'en',
  darkMode: 'dark',
  docsDir: './docs',
  outDir: './dist/docs',
  basePath: '/docs',
  url: 'https://lsu.stacksjs.com/docs',
  head: [
    ['link', { rel: 'icon', href: '/docs/favicon.png', type: 'image/png' }],
    ['link', { rel: 'apple-touch-icon', href: '/docs/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: siteStyleToken('--lsu-black') }],
    ['link', { rel: 'stylesheet', href: '/docs/style-guide/fonts.css' }],
    ['link', { rel: 'stylesheet', href: '/docs/style-guide/tokens.css' }],
    ['link', { rel: 'stylesheet', href: '/docs/style-guide/style-guide.css' }],
    ['link', { rel: 'stylesheet', href: '/docs/guide.css' }],
  ],
  themeConfig: docsTheme,
  nav: [
    { text: 'Guide', link: '/' },
    { text: 'Demo walkthrough', link: '/demo' },
    { text: 'Style Guide', link: '/style-guide/' },
    { text: 'Open LSU', link: 'https://lsu.stacksjs.com' },
  ],
  markdown: {
    title: 'Last Soul Ultra guide',
    meta: {
      'og:image': 'https://lsu.stacksjs.com/docs/style-guide/lsu-social-card.png',
      'og:image:width': '1024',
      'og:image:height': '1024',
      'og:image:type': 'image/png',
      'og:image:alt': 'Last Soul Ultra white logo on black',
    },
    toc: { enabled: true, minDepth: 2, maxDepth: 3 },
    sidebar: {
      '/': [
        { text: 'Start here', items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Visual guide', link: '/visual-guide' },
          { text: 'Race information', link: '/races' },
          { text: 'Your account', link: '/my-account' },
          { text: 'Roles and plan access', link: '/roles' },
        ] },
        { text: 'Your training', items: [
          { text: 'Plans and subscriptions', link: '/training/plans' },
          { text: 'Workouts', link: '/training/workouts' },
          { text: 'Exercise library', link: '/training/exercise-library' },
          { text: 'Feedback', link: '/training/feedback' },
          { text: 'Progress and library', link: '/training/progress' },
          { text: 'Health', link: '/training/health' },
          { text: 'Messages', link: '/training/messages' },
        ] },
        { text: 'Style Guide', items: [
          { text: 'Overview', link: '/style-guide/' },
          { text: 'Typography', link: '/style-guide/typography' },
          { text: 'Colors and interface', link: '/style-guide/colors-and-interface' },
          { text: 'Workout illustrations', link: '/style-guide/illustrations' },
          { text: 'Generated component reference', collapsed: true, items: styleGuide },
        ] },
        { text: 'Manage and review', items: [
          { text: 'Coach guide', link: '/coaches' },
          { text: 'Administration', link: '/administration' },
          { text: 'Privacy', link: '/privacy' },
          { text: 'Data model and ERD', link: '/erd' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Demo walkthrough', link: '/demo' },
        ] },
      ],
    },
    themeConfig: docsTheme,
  },
  sitemap: { enabled: false },
  robots: { enabled: true, rules: [{ userAgent: '*', disallow: ['/'] }] },
} satisfies BunPressOptions

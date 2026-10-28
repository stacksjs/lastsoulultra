import type { BunPressOptions } from '@stacksjs/bunpress'

/** Shared by Buddy's docs server and the production BunPress build. */
export default {
  title: 'Last Soul Ultra guide',
  description: 'Race information, training, coaching and administration for Last Soul Ultra.',
  lang: 'en',
  docsDir: './docs',
  outDir: './dist/docs',
  basePath: '/docs',
  url: 'https://lsu.stacksjs.com/docs',
  themeConfig: {
    siteTitle: 'Last Soul Ultra',
    socialLinks: [],
    editLink: { pattern: '' },
    footer: { message: 'Last Soul Ultra private preview', copyright: 'Last Soul Ultra' },
  },
  nav: [
    { text: 'Guide', link: '/' },
    { text: 'Demo walkthrough', link: '/demo' },
    { text: 'Open LSU', link: 'https://lsu.stacksjs.com' },
  ],
  markdown: {
    title: 'Last Soul Ultra guide',
    toc: { enabled: true, minDepth: 2, maxDepth: 3 },
    sidebar: {
      '/': [
        { text: 'Start here', items: [
          { text: 'Overview', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Race information', link: '/races' },
          { text: 'Your account', link: '/my-account' },
        ] },
        { text: 'Your training', items: [
          { text: 'Plans and subscriptions', link: '/training/plans' },
          { text: 'Workouts', link: '/training/workouts' },
          { text: 'Feedback', link: '/training/feedback' },
          { text: 'Progress and library', link: '/training/progress' },
          { text: 'Health', link: '/training/health' },
          { text: 'Messages', link: '/training/messages' },
        ] },
        { text: 'Manage and review', items: [
          { text: 'Coach guide', link: '/coaches' },
          { text: 'Administration', link: '/administration' },
          { text: 'Privacy', link: '/privacy' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Demo walkthrough', link: '/demo' },
        ] },
      ],
    },
    themeConfig: {
      socialLinks: [],
      editLink: { pattern: '' },
      footer: { message: 'Last Soul Ultra private preview', copyright: 'Last Soul Ultra' },
    },
  },
  sitemap: { enabled: false },
  robots: { enabled: true, rules: [{ userAgent: '*', disallow: ['/'] }] },
} satisfies BunPressOptions

/** The HQ tenant is configurable; no coach IDs, prices, keys or billing state live in this app. */
export default {
  origin: process.env.HQ_ORIGIN || 'https://hq.training',
  brand: process.env.HQ_BRAND_SLUG || 'last-soul-ultra',
}

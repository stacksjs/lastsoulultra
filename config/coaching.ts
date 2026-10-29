/** Coaching uses the independent LSU backend; credentials and billing state stay server-side. */
export default {
  origin: process.env.HQ_ORIGIN || 'https://training.lsu.stacksjs.com',
  brand: process.env.HQ_BRAND_SLUG || 'last-soul-ultra',
}

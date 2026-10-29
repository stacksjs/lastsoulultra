/**
 * Crosswind (utility CSS) — content globs for STX views.
 * @see https://github.com/cwcss/crosswind
 */
export default {
  content: [
    './resources/views/**/*.{stx,html}',
    './resources/**/*.{stx,html}',
    './storage/framework/defaults/resources/views/**/*.{stx,html}',
    './storage/framework/defaults/resources/components/**/*.{stx,html}',
    './storage/framework/core/error-handling/src/views/**/*.{stx,html}',
  ],
  // Navigation classes come from the published module list at render time.
  safelist: [
    'i-hugeicons-store-01',
    'i-hugeicons-calendar-03',
    'i-hugeicons-bubble-chat',
    'i-hugeicons-chart-line-data-01',
    'i-hugeicons-books-01',
    'i-hugeicons-heart-pulse',
    'i-hugeicons-message-01',
    'i-hugeicons-user-circle',
  ],
  minify: false,
}

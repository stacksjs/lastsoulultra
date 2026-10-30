/** Keep browser and home-screen icons sourced from the official LSU artwork. */
import { copyFileSync } from 'node:fs'

if (import.meta.main) {
  for (const [source, destination] of [
    ['public/assets/lsu/images/favicon.png', 'public/favicon-32.png'],
    ['public/assets/lsu/images/apple-touch-icon.png', 'public/apple-touch-icon.png'],
    ['public/assets/lsu/images/lsu-logo.svg', 'public/favicon.svg'],
  ]) {
    copyFileSync(source, destination)
    console.log(`Copied LSU artwork to ${destination}`)
  }
}

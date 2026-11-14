# Website images

This directory can hold website images served at `/images/<filename>`. LSU's captured production photography and brand images primarily live under `public/assets/lsu/`; consult that existing collection before introducing a duplicate.

Use useful alternative text for informative images and an empty `alt` for decoration. Preserve source provenance and use the existing asset pipeline for generated variants. After changing a referenced image, run the relevant rendered-page tests and verify the built asset path.

Workout figures in the user guide are source-derived training assets. Regenerate them with `bun scripts/sync-workout-art.ts` rather than editing the generated catalog or sampled-pose sheets by hand. See [the style guide](../../docs/style-guide/index.md).

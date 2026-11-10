# LSU native apps

LSU builds the complete HQ training app for iOS and Android. All screens,
components, native services, account handling, offline queues and navigation
come from the immutable HQ commit in `hq-source.json`. There is no second
implementation of those features in this repository.

`product.json` owns LSU's name, store identity, version, colors, fonts and legal
links. The public LSU wordmark is rasterized from the existing website asset and embedded in the screen bundle so it works offline.
The launch splash is not a hand-made file: `assets.splash` names the wordmark,
and `native:prepare` draws it with ts-images' splash preset (the accent's glow
on LSU's black, iOS @1x/@2x/@3x and Android 12's splash icon per density) into
ignored `storage/native/splash`. Native builds
materialize HQ under ignored `storage/native/hq/<commit>`, install its frozen
`bun.lock`, and supply `HQ_NATIVE_PRODUCT` to HQ's build. Only the declared branding and deployment inputs are overlaid; other source
changes stop the build.
The same pinned application source runs LSU's own training backend. Native
requests go only to `training.lsu.stacksjs.com`; its database, encryption key,
private uploads, sessions and jobs are separate from HQ. A cached HQ API address
cannot change the packaged origin. Race accounts remain a separate service.

Use the exact Bun version in `pantry.json`:

```sh
bun run native:prepare
bun run native:ios
bun run native:verify-ios
bun run native:android
```

Use these commands instead of building the website's `config/mobile.ts`
directly. Both targets compile HQ's complete route map and shared app entry.
Each output includes `lsu-source.json` with HQ's revision, dependency-lock hash,
LSU's revision and the product-input hash. Swift remains generated Craft output.
The generated Xcode Cloud post-clone hook restores the shell from that same HQ
lockfile; it does not restore a different Craft version from LSU's website.

The app uses `com.lastsoulultra.app`, team `3JJRNQW6B7`, and the
`lastsoulultra://` scheme. The Live Activity extension uses
`com.lastsoulultra.app.liveactivity`. iOS notifications register with LSU's own
backend as `last-soul-ultra`. That backend knows only its own packaged product:
the slug and scheme in `native-product.json` and, from its manifest
(`HQ_NATIVE_PRODUCT`), the bundle ID and APNs topic. HQ's own server knows no LSU app.
Android push stays disabled until this package has its own Firebase client.
HQ's Firebase file and app-link ownership are never inherited by a new app.

## Releasing

One command releases the app to TestFlight, as `bun run release:build` does in HQ:

```sh
bun run release:build              # the next build of the current version
bun run release:build --dry-run    # the tag and the tester notes, changing nothing
bun run release:minor              # 1.0.0 -> 1.1.0 (bumpx), still the next build number
bun run release:build --notes "Try the new calendar header"
```

It runs from a clean `main` and does the rest: takes the next build number (one
more than the highest in `product.json` and the release tags; Apple never takes a
number twice), writes What to Test from the conventional commits since the
previous release (logsmith's grouping, so a `feat:` or `fix:` subject is what
testers read and `chore:` is not), commits `chore(release): v1.0.0-build.N` with
the notes in `native/TestFlight/`, tags it and pushes both. CI runs on the push,
Deploy follows CI, and the TestFlight workflow follows Deploy for a release
commit, so nothing waits on a laptop. The command stays to watch that run and
reports how it ended; `--no-wait` leaves once the push is out. The tag's GitHub
release is created by the Release workflow.

It stops before anything is committed when the backend is not yet running the
pinned kit, because the workflow would refuse that build forty minutes later.
`--notes`, `--notes-file`, `RELEASE_NOTES` or `release.notes` in `product.json`
replace the generated notes; `release.locales` names the TestFlight languages
(default `en-US` and `de-DE`).

To adopt an HQ update, name the kit and let it say the rest about itself:

```sh
bun run native:pin 1.0.4122
bun run native:ios && bun run native:verify-ios
```

`native:pin` installs the kit and writes `pantry.json`, `pantry.lock`,
`hq-source.json` (the HQ commit and Bun version the kit declares) and the Craft
override in `package.json` (the version the kit locks). Commit that saying what
people will notice, push, and release once Deploy has finished. Without a
registry grant on this machine, the Platform pin workflow resolves the lock on
GitHub instead.

## Uploading by hand

The TestFlight workflow is the release path. To archive and upload from a Mac
instead, install Xcode and HQ's Pantry-pinned iOS tools, and install the App Store
provisioning profiles and Apple Distribution identity in your local keychain.
No signing keys or profiles belong in Git.

```sh
export APP_STORE_CONNECT_KEY_ID=<existing-key-id>
export APP_STORE_CONNECT_ISSUER_ID=<existing-issuer-id>
export APP_STORE_CONNECT_PRIVATE_KEY_PATH=<private-p8-path>
bun run native:testflight
```

The release first verifies the live enterprise installation, source revision and
residency contract. It builds from the pin, archives and exports with App Store profiles,
checks the bundle/version and distribution entitlements, and uploads the IPA.
`IOS_APP_PROFILE` and `IOS_ACTIVITY_PROFILE` can select alternative installed
profile names. Evidence is kept under ignored `storage/native/release/`.
Upload success is not TestFlight availability: `bun scripts/verify-native-testflight.ts`
waits for Apple's processing, assigns the build to the internal groups and sets
What to Test from the notes the release commit carries.

After `native:ios` has already generated this release, `native:testflight --prepared`
can reuse it. The release checks its receipt, product and frozen-lock hashes,
and rejects native input changes since generation; it still verifies the live
backend and bundled screen before archiving and uploading.

The pin makes each release reproducible; it deliberately does not float with HQ
main. After moving it, build both targets, run lint, type checks and tests, and
review the native screens.

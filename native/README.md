# LSU native apps

LSU builds the complete HQ training app for iOS and Android. All screens,
components, native services, account handling, offline queues and navigation
come from the immutable HQ commit in `hq-source.json`. There is no second
implementation of those features in this repository.

`product.json` owns LSU's name, store identity, version, colors, fonts and legal
links. The public LSU wordmark is rasterized from the existing website asset and embedded in the screen bundle so it works offline. Native builds
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
backend as `last-soul-ultra`, which resolves its allowlisted bundle ID and APNs topic.
Android push stays disabled until this package has its own Firebase client.
HQ's Firebase file and app-link ownership are never inherited by a new app.

## TestFlight

The first release keeps marketing version `1.0.0`. Increase `build` in
`product.json` for every subsequent upload; commit and push the inputs first.
Install Xcode and HQ's Pantry-pinned iOS tools, and install the App Store
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
Upload success is not TestFlight availability: verify Apple's processing state
and assign the processed build to an internal testing group in App Store Connect.

To adopt an HQ update, change the full commit SHA in `hq-source.json`, build
both targets, run lint/type checks/tests and review the native screens. The pin
makes each release reproducible; it deliberately does not float with HQ main.

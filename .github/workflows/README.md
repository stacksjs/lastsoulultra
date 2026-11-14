# GitHub Actions

| Workflow | Trigger | Result |
| --- | --- | --- |
| [CI](ci.yml) | Push or pull request to `main`, or manual dispatch | Lint, generated asset/reference checks, docs build and audit, type checks and tests |
| [Deploy](deploy.yml) | Successful CI on `main`, or manual dispatch | Deploys the exact CI-tested commit automatically, or the manually selected ref |
| [TestFlight](testflight.yml) | Successful Deploy for an eligible release commit, or manual dispatch | Builds and checks the native app; uploads only when requested; can recheck an earlier upload |
| [Native acceptance](native-acceptance.yml) | After successful Deploy on `main`, with a check for relevant native-input changes | Starts TestFlight with upload disabled for acceptance verification |
| [Platform pin](platform-pin.yml) | Manual dispatch with a kit version and source revision | Resolves the private platform package and uploads updated pin/lock artifacts for review and commit |
| [Release](release.yml) | A `v*` tag | Publishes the GitHub release using the release's changelog section |
| [Labeler](labeler.yml) | Pull request events | Applies path-based labels from `.github/labeler.yml` |

Automatic deployment is gated by CI; manual Deploy dispatch is an explicit operator action and can bypass that trigger prerequisite. Read the Deploy steps to distinguish an activated release from a run that skipped deployment because credentials were absent.

The deployment installs `@hq/platform` using `PANTRY_REGISTRY_TOKEN`. Native generation runs before signing secrets become available. TestFlight signing credentials are scoped to the `ios-testflight` environment. See [deployment](../../enterprise/README.md) and [native releases](../../native/README.md) for setup, source provenance and the release sequence.

Use `bun run release:build --dry-run` to preview a native release. A normal release command commits, tags and pushes, then follows CI, Deploy and TestFlight. A documentation push runs CI and can deploy the website and training services; it does not by itself publish a new native build.

`docs-screenshots.yml` is a manual review tool. Choose the training or website inventory and optional comma-separated ids. It uses synthetic review-account secrets, saves an encrypted manifest-and-screenshot bundle for seven days, and retains failed captures in the artifact. Only the encrypted bundle is uploaded because this repository is public. It does not publish plaintext captured images. Review the artifact before copying selected images into the guide. Configuration and source changes need a new capture directory; `--check` validates saved artifacts, not a live deployment.

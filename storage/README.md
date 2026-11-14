# Storage and local runtime state

`storage/` contains framework files and machine-local application state. It is not an automatic S3 sync directory. Upload destinations and access controls depend on the configured storage driver and the application that owns the files.

| Path | Purpose |
| --- | --- |
| `framework/defaults` | Framework defaults used by the app override model |
| `framework/stx`, `framework/runtime` | Generated STX cache and runtime state |
| `native` | Prepared platform source, native build inputs and local release evidence |
| `runtime` | Local preparation and handoff state, including private account inputs where configured |
| `cloud` | Local deployment-driver state |
| `logs` | Application logs |

Treat generated caches differently from private inputs, source checkouts and release evidence. Do not delete all of `storage/` to fix a cache issue. Keep private account files, keys, tokens and uploads out of commits and shared logs.

Production training data lives under the persistent paths and private bucket declared in [enterprise/deployment.json](../enterprise/deployment.json), with its own recovery policy. See [enterprise operations](../enterprise/README.md) and [recovery](../enterprise/RECOVERY.md).

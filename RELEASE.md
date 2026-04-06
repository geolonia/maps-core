# Release Guide

## How to release

1. Bump the version in `package.json`
2. Push a tag: `git tag v<version> && git push origin v<version>`
3. CI automatically runs build, e2e tests, creates a GitHub Release (with UMD tarball), and publishes to npm

## CI release workflow

The release job in `.github/workflows/ci.yml` triggers on tags matching `v*`.

### Build artifacts

| Artifact | Output | Distribution |
|---|---|---|
| ESM/CJS/DTS | `dist/npm/` | npm registry (~31 KB) |
| UMD bundle | `dist/umd/maps-core.umd.cjs` | GitHub Releases (~1.3 MB) |

### npm authentication

Publishing uses **OIDC provenance** (`id-token: write` permission) rather than a stored `NPM_TOKEN` secret. The npm registry verifies the package origin via a signed provenance statement from GitHub Actions.

### Known constraints: Node and npm versions

The release job uses **Node 24.x** (not 22.x like build/e2e jobs). This is intentional due to two issues in npm 10.9.x (bundled with Node 22):

1. **`--ignore-scripts` does not skip `prepare`** — npm 10.9.x runs the `prepare` lifecycle script during `npm publish` even with `--ignore-scripts`. Since the release job does not install devDependencies (it uses pre-built artifacts), any `prepare` script that invokes build tools (e.g., tsup) will fail with `command not found`. This is why `package.json` must not have a `prepare` script.

2. **OIDC provenance fails for scoped packages** — npm 10.9.x returns `E404` on `PUT` when publishing scoped packages (`@geolonia/*`) with `--provenance`, even though the provenance statement is signed successfully. npm 11 (bundled with Node 24) handles OIDC authentication correctly.

The v0.1.0 release worked around these issues by running `npm install -g npm@latest` to upgrade to npm 11, but this approach broke when Node 22.22.2 introduced a `MODULE_NOT_FOUND` error during the global install. Using Node 24.x directly is the stable fix.

### Prerelease tags

Tags containing `-pre.` (e.g., `v0.3.0-pre.1`) are published with `--tag=next` and marked as prerelease on GitHub Releases.

## Re-running a failed release

The workflow is designed to be re-runnable:

- GitHub Release creation is idempotent (deletes existing release before creating)
- npm publish will fail if the version already exists (immutable); bump the version and re-tag

# pebble-ci

Reusable GitHub Actions workflow that builds a Pebble watchapp with Docker and uploads the `.pbw` artifact.

No repository secrets. Runs on GitHub-hosted `ubuntu-latest` using [`ghcr.io/skylord123/docker-coredevices-pebble-tool`](https://github.com/skylord123/docker-coredevices-pebble-tool) (Core Devices `pebble-tool` + SDK).

## Use from another repo

Create `.github/workflows/pebble-build.yml`:

```yaml
name: pebble-build

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    uses: erad84/pebble-ci/.github/workflows/pebble-build-reusable.yml@v1
    with:
      working-directory: '.'
      artifact-name: my-pebble-app
      # optional:
      # platforms: basalt,chalk
      # pebble-command: pebble build
      # docker-image: ghcr.io/skylord123/docker-coredevices-pebble-tool:latest
      # npm-install: auto
```

**Pin `@v1`.** Breaking changes ship as `v2`. Moving the floating major tag (`v1` → newer commits) is for compatible fixes only.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `working-directory` | `.` | Path to the Pebble project root (`package.json` / `wscript`) |
| `artifact-name` | `pebble-app` | Uploaded artifact name |
| `platforms` | _(empty)_ | Comma-separated `targetPlatforms` override; empty keeps `package.json` |
| `pebble-command` | `pebble build` | Command inside the container |
| `docker-image` | `ghcr.io/skylord123/docker-coredevices-pebble-tool:latest` | SDK image |
| `npm-install` | `auto` | `auto` / `true` / `false` — `auto` installs only when `package.json` has `dependencies` / `devDependencies` |

## Requirements

- Caller must allow reusable workflows from `erad84/pebble-ci` (public).
- Project root must be a normal Pebble app (`package.json` + `wscript` / `src`).

## Report issues / request updates

Open a GitHub Issue on this repo: **[erad84/pebble-ci/issues](https://github.com/erad84/pebble-ci/issues)**.

Use issues for bugs, missing inputs, image/SDK bumps, or feature requests from other Cursor Projects or public Pebble repos.

## Versioning

| Ref | Use |
| --- | --- |
| `@v1` | **Recommended** — stable major; pin this in callers |
| `@v2` | Next major if the `workflow_call` contract breaks |
| `@main` | Development tip — not for production callers |

Compatible fixes and docs updates land on `main` and may move the `v1` tag. Contract-breaking changes get a new major tag (`v2`) so existing `@v1` callers stay green.

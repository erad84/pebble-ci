# pebble-ci

Reusable GitHub Actions workflow that builds a Pebble watchapp with Docker and
uploads the `.pbw` artifact. Optionally installs that `.pbw` to a watch via
CloudPebble when the caller opts in and provides secrets.

Build requires **no** repository secrets. CloudPebble install secrets stay on
the **caller** repo (never in this public repo).

Runs on GitHub-hosted `ubuntu-latest` using
[`ghcr.io/skylord123/docker-coredevices-pebble-tool`](https://github.com/skylord123/docker-coredevices-pebble-tool)
(Core Devices `pebble-tool` + SDK).

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
      # install-cloudpebble: true   # optional watch install after build
    # Required for CloudPebble install (same secret names on the caller):
    secrets: inherit
```

**Pin `@v1`.** Breaking changes ship as `v2`. Moving the floating major tag
(`v1` → newer commits) is for compatible fixes only. Optional CloudPebble
install is additive (`install-cloudpebble` defaults to `false`) so existing
`@v1` callers stay unchanged.

### Explicit secrets (instead of `inherit`)

```yaml
    secrets:
      PEBBLE_FIREBASE_REFRESH_TOKEN: ${{ secrets.PEBBLE_FIREBASE_REFRESH_TOKEN }}
      PEBBLE_FIREBASE_API_KEY: ${{ secrets.PEBBLE_FIREBASE_API_KEY }}  # optional
```

`secrets: inherit` is preferred when the caller secret names match.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `working-directory` | `.` | Path to the Pebble project root (`package.json` / `wscript`) |
| `artifact-name` | `pebble-app` | Uploaded artifact name |
| `platforms` | _(empty)_ | Comma-separated `targetPlatforms` override; empty keeps `package.json` |
| `pebble-command` | `pebble build` | Command inside the container |
| `docker-image` | `ghcr.io/skylord123/docker-coredevices-pebble-tool:latest` | SDK image |
| `npm-install` | `auto` | `auto` / `true` / `false` — `auto` installs only when `package.json` has `dependencies` / `devDependencies` |
| `install-cloudpebble` | `false` | When `true`, run optional CloudPebble install after build |

## Secrets (caller repo only)

| Secret | Required for install? | Meaning |
| --- | --- | --- |
| `PEBBLE_FIREBASE_REFRESH_TOKEN` | **Yes** | Firebase `refresh_token` from local `pebble login` |
| `PEBBLE_FIREBASE_API_KEY` | No | Firebase Web API key; defaults to pebble-tool’s public Rebble/Core Devices key |

### How to mint `PEBBLE_FIREBASE_REFRESH_TOKEN`

On a machine where you already use CloudPebble (WSL is fine):

1. `pebble login` (browser / Google).
2. Confirm: `pebble login --status` → logged in, developer linked.
3. Open `~/.local/share/pebble-sdk/oauth_firebase/firebase_oauth_storage.json`.
4. Copy **only** the `refresh_token` string into the caller repo’s Actions
   secret named `PEBBLE_FIREBASE_REFRESH_TOKEN`.
5. Do **not** commit the JSON file or paste tokens into issues/PRs/logs.

If `install-cloudpebble: true` but the refresh-token secret is missing, the
install job **skips** with a notice (build + artifact still succeed).

## CloudPebble install behaviour

1. Builds and uploads the `.pbw` (unchanged).
2. Optional `cloudpebble-install` job downloads the artifact.
3. Exchanges the refresh token for a short-lived Firebase `id_token` (never
   printed) and writes XDG oauth storage under the job temp `HOME`.
4. Runs `pebble login --status` / `pebble install --cloudpebble` inside the
   SDK Docker image with `HOME=/home/pebble`, bind-mounting the bootstrapped
   `oauth_firebase` directory onto `/home/pebble/.pebble-sdk/oauth_firebase`
   (the image entrypoint makes pebble-tool prefer that legacy path over XDG).
5. On install failure: writes a **job summary** and a failing **step
   annotation** with an actionable cause (see below).

### Failure meanings (Actions UI)

| Classifier code | Typical cause |
| --- | --- |
| `not_logged_in` | Credentials missing/invalid after bootstrap |
| `bad_refresh_token` | Refresh token rejected — rotate secret via fresh `pebble login` |
| `proxy_auth_failed` | Proxy rejected token — often wrong CloudPebble/Rebble account |
| `phone_offline` | Phone app not connected to CloudPebble (open app, net + BT) |
| `install_timeout` | Watch didn’t confirm — Developer Mode / proximity / BT |
| `install_rejected` | Watch rejected the `.pbw` |
| `cloudpebble_unreachable` | Network / DNS / proxy down from the runner |
| `developer_not_linked` | Firebase user has no linked developer profile |

## Requirements

- Caller must allow reusable workflows from `erad84/pebble-ci` (public).
- Project root must be a normal Pebble app (`package.json` + `wscript` / `src`).
- CloudPebble install also needs the phone online with the Pebble/Rebble app
  reachable while the job runs (often 2–4 minutes waiting for the phone).

## Report issues / request updates

Open a GitHub Issue on this repo:
**[erad84/pebble-ci/issues](https://github.com/erad84/pebble-ci/issues)**.

## Versioning

| Ref | Use |
| --- | --- |
| `@v1` | **Recommended** — stable major; pin this in callers |
| `@v1.1.1` | CloudPebble Firebase login fix (legacy SDK oauth mount) |
| `@v1.1.0` | First release with optional CloudPebble install |
| `@v2` | Next major if the `workflow_call` contract breaks |
| `@main` | Development tip — not for production callers |

Compatible fixes and docs updates land on `main` and may move the `v1` tag.
Contract-breaking changes get a new major tag (`v2`) so existing `@v1` callers
stay green.

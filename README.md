# pebble-ci

Pebble CI is a tiny local continuous-integration runner. It reads a pipeline
definition from a YAML file, runs each job's steps as shell commands, and
reports pass/fail with per-step output and timing. It ships with both a **CLI**
and a **web dashboard**.

> This project was scaffolded to establish a working Cloud Agent development
> environment for the `pebble-ci` repository (which previously contained only a
> README). It is a small but fully functional application: TypeScript source, a
> CLI, an HTTP API + web UI, unit/integration tests, linting, and type checking.

## Requirements

- Node.js >= 20 (developed against Node 22)
- npm

## Install

```bash
npm ci        # or: npm install
```

## Quick start

### Web dashboard

```bash
npm run build
npm start
# open http://localhost:3000
```

Click **Run pipeline** to execute the demo pipeline in `examples/.pebble.yml`
and watch the per-job results appear.

During development you can use the auto-reloading server instead:

```bash
npm run dev
```

### CLI

Run a pipeline file (defaults to `.pebble.yml` in the current directory):

```bash
npm run cli -- run                      # runs ./.pebble.yml
npm run cli -- run examples/.pebble.yml # a specific file
```

After `npm run build`, the `pebble` binary is available at `dist/cli.js`:

```bash
node dist/cli.js run examples/failing.pebble.yml
```

The CLI exits non-zero when any step fails, so it can gate a real CI job.

## Pipeline format

```yaml
name: demo
jobs:
  - name: build
    steps:
      - name: compile
        run: node -e "console.log('compiled')"
  - name: test
    steps:
      - name: unit
        run: "true"
```

- Jobs run sequentially.
- Steps within a job run sequentially.
- On the first failing step, the rest of that job and all later jobs are
  **skipped** (fail-fast), mirroring typical CI behavior.

## Project scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run build`     | Compile TypeScript to `dist/`                |
| `npm start`         | Start the web dashboard (`dist/server.js`)   |
| `npm run dev`       | Start the dashboard with hot reload (`tsx`)  |
| `npm run cli -- …`  | Run the CLI via `tsx`                         |
| `npm run typecheck` | Type-check without emitting                  |
| `npm run lint`      | Lint with ESLint                             |
| `npm test`          | Run the test suite with Vitest               |

## HTTP API

| Method | Path             | Description                          |
| ------ | ---------------- | ------------------------------------ |
| GET    | `/api/health`    | Health check                         |
| GET    | `/api/pipeline`  | The parsed pipeline definition       |
| GET    | `/api/runs`      | Summaries of past runs (newest first)|
| GET    | `/api/runs/:id`  | Full detail for one run              |
| POST   | `/api/runs`      | Trigger a new run                    |

## Layout

```
src/
  core/          # pipeline parsing + execution engine
  cli.ts         # command-line entrypoint
  server.ts      # Express API + static dashboard
public/          # dashboard frontend (HTML/CSS/JS)
examples/        # sample pipelines (passing + failing)
test/            # Vitest unit + API tests
```

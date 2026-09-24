import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { parsePipeline } from "./core/pipeline.js";
import { runPipeline } from "./core/runner.js";
import type { PipelineRun } from "./core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const DEFAULT_PIPELINE = resolve(projectRoot, "examples/.pebble.yml");

export interface ServerOptions {
  pipelineFile?: string;
  cwd?: string;
}

export function createServer(options: ServerOptions = {}) {
  const pipelineFile = options.pipelineFile ?? DEFAULT_PIPELINE;
  const cwd = options.cwd ?? projectRoot;

  const app = express();
  app.use(express.json());

  const runs: PipelineRun[] = [];

  const publicDir = resolve(projectRoot, "public");
  app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", pipelineFile });
  });

  app.get("/api/pipeline", async (_req, res) => {
    try {
      if (!existsSync(pipelineFile)) {
        res.status(404).json({ error: `Pipeline file not found: ${pipelineFile}` });
        return;
      }
      const source = await readFile(pipelineFile, "utf8");
      const pipeline = parsePipeline(source);
      res.json(pipeline);
    } catch (error) {
      res.status(400).json({ error: messageFrom(error) });
    }
  });

  app.get("/api/runs", (_req, res) => {
    res.json(runs.map(summarize));
  });

  app.get("/api/runs/:id", (req, res) => {
    const run = runs.find((r) => r.id === req.params.id);
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(run);
  });

  app.post("/api/runs", async (_req, res) => {
    try {
      const source = await readFile(pipelineFile, "utf8");
      const pipeline = parsePipeline(source);
      const run = await runPipeline(pipeline, { cwd });
      runs.unshift(run);
      res.status(201).json(run);
    } catch (error) {
      res.status(400).json({ error: messageFrom(error) });
    }
  });

  return app;
}

function summarize(run: PipelineRun) {
  return {
    id: run.id,
    pipeline: run.pipeline,
    status: run.status,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    jobs: run.jobs.map((job) => ({ name: job.name, status: job.status })),
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createServer();
  app.listen(port, () => {
    process.stdout.write(`Pebble CI dashboard listening on http://localhost:${port}\n`);
  });
}

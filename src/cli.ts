#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parsePipeline } from "./core/pipeline.js";
import { runPipeline } from "./core/runner.js";
import type { PipelineRun, Status } from "./core/types.js";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function symbol(status: Status): string {
  switch (status) {
    case "success":
      return `${COLORS.green}✔${COLORS.reset}`;
    case "failed":
      return `${COLORS.red}✖${COLORS.reset}`;
    case "skipped":
      return `${COLORS.yellow}∙${COLORS.reset}`;
  }
}

function printRun(run: PipelineRun): void {
  process.stdout.write(
    `\n${COLORS.bold}Pipeline: ${run.pipeline}${COLORS.reset}\n`,
  );
  for (const job of run.jobs) {
    process.stdout.write(
      `\n${symbol(job.status)} ${COLORS.bold}${job.name}${COLORS.reset} ${COLORS.dim}(${job.durationMs}ms)${COLORS.reset}\n`,
    );
    for (const step of job.steps) {
      process.stdout.write(
        `  ${symbol(step.status)} ${step.name} ${COLORS.dim}$ ${step.run}${COLORS.reset}\n`,
      );
      if (step.status === "failed" && step.stderr.trim()) {
        const indented = step.stderr
          .trim()
          .split("\n")
          .map((line) => `      ${COLORS.red}${line}${COLORS.reset}`)
          .join("\n");
        process.stdout.write(`${indented}\n`);
      }
    }
  }

  const color = run.status === "success" ? COLORS.green : COLORS.red;
  process.stdout.write(
    `\n${color}${COLORS.bold}${run.status.toUpperCase()}${COLORS.reset} in ${run.durationMs}ms\n`,
  );
}

async function main(): Promise<void> {
  const [command, fileArg] = process.argv.slice(2);

  if (command !== "run") {
    process.stdout.write(
      "Pebble CI\n\nUsage:\n  pebble run [pipeline.yml]\n\n" +
        "Runs the given pipeline file (defaults to .pebble.yml) and exits\n" +
        "non-zero if any step fails.\n",
    );
    process.exit(command === undefined ? 0 : 1);
    return;
  }

  const file = resolve(process.cwd(), fileArg ?? ".pebble.yml");

  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch {
    process.stderr.write(`${COLORS.red}Cannot read pipeline file: ${file}${COLORS.reset}\n`);
    process.exit(1);
    return;
  }

  const pipeline = parsePipeline(source);
  const run = await runPipeline(pipeline, { cwd: process.cwd() });
  printRun(run);

  process.exit(run.status === "success" ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${COLORS.red}${message}${COLORS.reset}\n`);
  process.exit(1);
});

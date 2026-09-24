import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import type {
  JobResult,
  PipelineDefinition,
  PipelineRun,
  StepDefinition,
  StepResult,
} from "./types.js";

export interface RunOptions {
  /** Working directory for step commands. Defaults to process.cwd(). */
  cwd?: string;
  /** Per-step timeout in milliseconds. */
  timeoutMs?: number;
}

interface CommandOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd, timeout: timeoutMs, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error && typeof error.code === "number") {
          resolve({ exitCode: error.code, stdout, stderr });
        } else if (error) {
          // Killed by signal or spawn failure.
          resolve({
            exitCode: null,
            stdout,
            stderr: stderr || String(error.message),
          });
        } else {
          resolve({ exitCode: 0, stdout, stderr });
        }
      },
    );
  });
}

async function runStep(
  step: StepDefinition,
  cwd: string,
  timeoutMs: number,
): Promise<StepResult> {
  const startedAt = Date.now();
  const outcome = await runCommand(step.run, cwd, timeoutMs);
  const durationMs = Date.now() - startedAt;

  return {
    name: step.name,
    run: step.run,
    status: outcome.exitCode === 0 ? "success" : "failed",
    exitCode: outcome.exitCode,
    stdout: outcome.stdout,
    stderr: outcome.stderr,
    durationMs,
  };
}

/**
 * Execute a pipeline definition, running each job's steps sequentially.
 *
 * A step failure fails its job and marks the remaining steps in that job as
 * skipped. Subsequent jobs are also skipped, mirroring fail-fast CI behavior.
 */
export async function runPipeline(
  pipeline: PipelineDefinition,
  options: RunOptions = {},
): Promise<PipelineRun> {
  const cwd = options.cwd ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? 60_000;

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const jobs: JobResult[] = [];
  let pipelineFailed = false;

  for (const job of pipeline.jobs) {
    const jobStartedAt = Date.now();
    const steps: StepResult[] = [];
    let jobFailed = false;

    for (const step of job.steps) {
      if (pipelineFailed || jobFailed) {
        steps.push({
          name: step.name,
          run: step.run,
          status: "skipped",
          exitCode: null,
          stdout: "",
          stderr: "",
          durationMs: 0,
        });
        continue;
      }

      const result = await runStep(step, cwd, timeoutMs);
      steps.push(result);
      if (result.status === "failed") {
        jobFailed = true;
        pipelineFailed = true;
      }
    }

    jobs.push({
      name: job.name,
      status: jobFailed ? "failed" : pipelineFailed ? "skipped" : "success",
      steps,
      durationMs: Date.now() - jobStartedAt,
    });
  }

  const finishedAtMs = Date.now();

  return {
    id: randomUUID(),
    pipeline: pipeline.name,
    status: pipelineFailed ? "failed" : "success",
    jobs,
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
  };
}

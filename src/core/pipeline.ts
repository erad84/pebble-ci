import { load } from "js-yaml";
import type {
  JobDefinition,
  PipelineDefinition,
  StepDefinition,
} from "./types.js";

/**
 * Parse and validate a Pebble pipeline definition from a YAML string.
 *
 * Throws a descriptive error when required fields are missing so that both the
 * CLI and the HTTP API can surface actionable messages to the user.
 */
export function parsePipeline(source: string): PipelineDefinition {
  const raw = load(source);

  if (raw === null || typeof raw !== "object") {
    throw new Error("Pipeline must be a YAML mapping with a `name` and `jobs`.");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    throw new Error("Pipeline is missing a non-empty `name`.");
  }

  if (!Array.isArray(obj.jobs) || obj.jobs.length === 0) {
    throw new Error("Pipeline must define at least one job under `jobs`.");
  }

  const jobs: JobDefinition[] = obj.jobs.map((job, jobIndex) =>
    parseJob(job, jobIndex),
  );

  return { name: obj.name, jobs };
}

function parseJob(job: unknown, jobIndex: number): JobDefinition {
  if (job === null || typeof job !== "object") {
    throw new Error(`Job at index ${jobIndex} must be a mapping.`);
  }

  const obj = job as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    throw new Error(`Job at index ${jobIndex} is missing a non-empty \`name\`.`);
  }

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    throw new Error(`Job \`${obj.name}\` must define at least one step.`);
  }

  const steps: StepDefinition[] = obj.steps.map((step, stepIndex) =>
    parseStep(step, obj.name as string, stepIndex),
  );

  return { name: obj.name, steps };
}

function parseStep(
  step: unknown,
  jobName: string,
  stepIndex: number,
): StepDefinition {
  if (step === null || typeof step !== "object") {
    throw new Error(
      `Step at index ${stepIndex} in job \`${jobName}\` must be a mapping.`,
    );
  }

  const obj = step as Record<string, unknown>;

  if (typeof obj.run !== "string" || obj.run.trim() === "") {
    throw new Error(
      `Step at index ${stepIndex} in job \`${jobName}\` is missing a \`run\` command.`,
    );
  }

  const name =
    typeof obj.name === "string" && obj.name.trim() !== ""
      ? obj.name
      : `step-${stepIndex + 1}`;

  return { name, run: obj.run };
}

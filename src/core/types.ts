export interface StepDefinition {
  name: string;
  run: string;
}

export interface JobDefinition {
  name: string;
  steps: StepDefinition[];
}

export interface PipelineDefinition {
  name: string;
  jobs: JobDefinition[];
}

export type Status = "success" | "failed" | "skipped";

export interface StepResult {
  name: string;
  run: string;
  status: Status;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface JobResult {
  name: string;
  status: Status;
  steps: StepResult[];
  durationMs: number;
}

export interface PipelineRun {
  id: string;
  pipeline: string;
  status: Status;
  jobs: JobResult[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

import { describe, expect, it } from "vitest";
import { parsePipeline } from "../src/core/pipeline.js";
import { runPipeline } from "../src/core/runner.js";

describe("parsePipeline", () => {
  it("parses a valid pipeline", () => {
    const pipeline = parsePipeline(`
name: demo
jobs:
  - name: build
    steps:
      - name: compile
        run: "true"
`);
    expect(pipeline.name).toBe("demo");
    expect(pipeline.jobs).toHaveLength(1);
    expect(pipeline.jobs[0].steps[0].run).toBe("true");
  });

  it("defaults a step name when omitted", () => {
    const pipeline = parsePipeline(`
name: demo
jobs:
  - name: build
    steps:
      - run: "true"
`);
    expect(pipeline.jobs[0].steps[0].name).toBe("step-1");
  });

  it("throws when name is missing", () => {
    expect(() => parsePipeline("jobs: []")).toThrow(/non-empty `name`/);
  });

  it("throws when jobs are missing", () => {
    expect(() => parsePipeline("name: demo")).toThrow(/at least one job/);
  });

  it("throws when a step lacks a run command", () => {
    expect(() =>
      parsePipeline(`
name: demo
jobs:
  - name: build
    steps:
      - name: nope
`),
    ).toThrow(/missing a `run` command/);
  });
});

describe("runPipeline", () => {
  it("runs all steps successfully", async () => {
    const pipeline = parsePipeline(`
name: ok
jobs:
  - name: build
    steps:
      - name: a
        run: node -e "console.log('hello')"
      - name: b
        run: "true"
`);
    const run = await runPipeline(pipeline);
    expect(run.status).toBe("success");
    expect(run.jobs[0].status).toBe("success");
    expect(run.jobs[0].steps[0].stdout).toContain("hello");
    expect(run.jobs[0].steps.every((s) => s.status === "success")).toBe(true);
  });

  it("fails fast and skips downstream steps and jobs", async () => {
    const pipeline = parsePipeline(`
name: bad
jobs:
  - name: build
    steps:
      - name: boom
        run: node -e "process.exit(3)"
      - name: after
        run: "true"
  - name: deploy
    steps:
      - name: ship
        run: "true"
`);
    const run = await runPipeline(pipeline);
    expect(run.status).toBe("failed");
    expect(run.jobs[0].status).toBe("failed");
    expect(run.jobs[0].steps[0].status).toBe("failed");
    expect(run.jobs[0].steps[0].exitCode).toBe(3);
    expect(run.jobs[0].steps[1].status).toBe("skipped");
    expect(run.jobs[1].status).toBe("skipped");
    expect(run.jobs[1].steps[0].status).toBe("skipped");
  });
});

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const goodPipeline = resolve(here, "../examples/.pebble.yml");
const badPipeline = resolve(here, "../examples/failing.pebble.yml");

describe("HTTP API", () => {
  it("reports health", async () => {
    const app = createServer({ pipelineFile: goodPipeline });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("returns the pipeline definition", async () => {
    const app = createServer({ pipelineFile: goodPipeline });
    const res = await request(app).get("/api/pipeline");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("demo");
    expect(res.body.jobs.length).toBeGreaterThan(0);
  });

  it("triggers a successful run and stores it", async () => {
    const app = createServer({ pipelineFile: goodPipeline });
    const create = await request(app).post("/api/runs");
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("success");

    const list = await request(app).get("/api/runs");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(create.body.id);
  });

  it("reports a failed run for a failing pipeline", async () => {
    const app = createServer({ pipelineFile: badPipeline });
    const create = await request(app).post("/api/runs");
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("failed");
  });
});

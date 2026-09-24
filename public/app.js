const runBtn = document.getElementById("run-btn");
const pipelineEl = document.getElementById("pipeline");
const runsEl = document.getElementById("runs");

async function loadPipeline() {
  try {
    const res = await fetch("/api/pipeline");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load pipeline");
    renderPipeline(data);
  } catch (err) {
    pipelineEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function renderPipeline(pipeline) {
  const jobs = pipeline.jobs
    .map((job) => {
      const steps = job.steps
        .map(
          (step) =>
            `<div class="step"><span class="dot"></span><span>${escapeHtml(
              step.name,
            )}</span><code>${escapeHtml(step.run)}</code></div>`,
        )
        .join("");
      return `<div class="job"><div class="job-name">${escapeHtml(
        job.name,
      )}</div>${steps}</div>`;
    })
    .join("");
  pipelineEl.innerHTML = jobs;
}

async function loadRuns() {
  const res = await fetch("/api/runs");
  const runs = await res.json();
  if (!Array.isArray(runs) || runs.length === 0) {
    runsEl.innerHTML = `<div class="empty">No runs yet. Click “Run pipeline”.</div>`;
    return;
  }
  runsEl.innerHTML = runs.map(renderRunCard).join("");
}

function renderRunCard(run) {
  const chips = run.jobs
    .map(
      (job) =>
        `<span class="chip"><span class="dot ${job.status}"></span>${escapeHtml(
          job.name,
        )}</span>`,
    )
    .join("");
  const started = new Date(run.startedAt).toLocaleTimeString();
  return `<div class="run-card">
    <div class="run-head">
      <strong>${escapeHtml(run.pipeline)}</strong>
      <span class="badge ${run.status}">${run.status}</span>
    </div>
    <div class="run-meta">${started} • ${run.durationMs}ms • ${run.id.slice(0, 8)}</div>
    <div class="run-jobs">${chips}</div>
  </div>`;
}

async function triggerRun() {
  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  try {
    const res = await fetch("/api/runs", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Run failed to start");
    await loadRuns();
  } catch (err) {
    runsEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run pipeline";
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

runBtn.addEventListener("click", triggerRun);
loadPipeline();
loadRuns();

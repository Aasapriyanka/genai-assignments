const { AnalysisError } = require('./analysisSchema');

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 500;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);

class AnalysisProgressTracker {
  constructor(now = Date.now) {
    this.now = now;
    this.jobs = new Map();
    this.activeRequirements = new Map();
  }

  start(jobId, requirementIds) {
    this.prune();
    if (this.jobs.has(jobId)) {
      throw new AnalysisError('This analysis operation has already been submitted.', 409, 'DUPLICATE_SUBMISSION');
    }
    if (this.jobs.size >= MAX_JOBS) {
      throw new AnalysisError('Too many analysis operations are active. Please try again later.', 503, 'TOO_MANY_JOBS');
    }
    const activeId = requirementIds.find((id) => this.activeRequirements.has(id));
    if (activeId) {
      throw new AnalysisError(`Requirement ${activeId} is already being analysed.`, 409, 'DUPLICATE_SUBMISSION');
    }

    const job = {
      createdAt: this.now(),
      touchedAt: this.now(),
      items: new Map(requirementIds.map((id) => [id, { status: 'pending', retryCount: 0 }]))
    };
    this.jobs.set(jobId, job);
    requirementIds.forEach((id) => this.activeRequirements.set(id, jobId));
  }

  claim(jobId, requirementIds) {
    const job = this.getJob(jobId);
    requirementIds.forEach((id) => {
      const item = job.items.get(id);
      if (!item || item.status !== 'pending') {
        throw new AnalysisError(`Requirement ${id} is not pending in this analysis operation.`, 409, 'DUPLICATE_SUBMISSION');
      }
    });
    requirementIds.forEach((id) => this.update(jobId, id, 'processing'));
  }

  finish(jobId) {
    const job = this.getJob(jobId);
    for (const [id, item] of job.items) {
      if (item.status === 'pending') this.update(jobId, id, 'failed');
    }
  }

  update(jobId, requirementId, status) {
    const job = this.getJob(jobId);
    const item = job.items.get(requirementId);
    if (!item) return;
    item.status = status;
    if (status === 'retrying') item.retryCount += 1;
    job.touchedAt = this.now();
    if (TERMINAL_STATUSES.has(status) && this.activeRequirements.get(requirementId) === jobId) {
      this.activeRequirements.delete(requirementId);
    }
  }

  snapshot(jobId) {
    const job = this.getJob(jobId);
    const items = [...job.items.entries()].map(([id, item]) => ({
      id,
      status: item.status,
      retryCount: item.retryCount
    }));
    job.touchedAt = this.now();
    return {
      total: items.length,
      succeeded: count(items, 'succeeded'),
      failed: count(items, 'failed'),
      pending: count(items, 'pending'),
      processing: count(items, 'processing'),
      retrying: count(items, 'retrying'),
      items
    };
  }

  getJob(jobId) {
    this.prune();
    const job = this.jobs.get(jobId);
    if (!job) throw new AnalysisError('Analysis progress is no longer available.', 404, 'JOB_NOT_FOUND');
    return job;
  }

  prune() {
    const threshold = this.now() - JOB_TTL_MS;
    for (const [jobId, job] of this.jobs) {
      if (job.touchedAt >= threshold) continue;
      this.jobs.delete(jobId);
      for (const [id, activeJobId] of this.activeRequirements) {
        if (activeJobId === jobId) this.activeRequirements.delete(id);
      }
    }
  }
}

function count(items, status) {
  return items.filter((item) => item.status === status).length;
}

module.exports = { AnalysisProgressTracker };

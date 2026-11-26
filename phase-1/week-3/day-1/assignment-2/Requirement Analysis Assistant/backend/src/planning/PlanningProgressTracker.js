const { AnalysisError } = require('../analysis/analysisSchema');

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 200;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);

class PlanningProgressTracker {
  constructor(now = Date.now) {
    this.now = now;
    this.jobs = new Map();
    this.activeGroups = new Map();
  }

  start(jobId, groupIds) {
    this.prune();
    if (this.jobs.has(jobId)) {
      throw new AnalysisError('This planning operation has already been submitted.', 409, 'DUPLICATE_SUBMISSION');
    }
    if (this.jobs.size >= MAX_JOBS) {
      throw new AnalysisError('Too many planning operations are active. Please try again later.', 503, 'TOO_MANY_JOBS');
    }
    this.jobs.set(jobId, {
      claimed: false,
      createdAt: this.now(),
      touchedAt: this.now(),
      items: new Map(groupIds.map((id) => [id, { status: 'pending', retryCount: 0 }]))
    });
  }

  claim(jobId, groupIds) {
    const job = this.getJob(jobId);
    if (job.claimed) {
      throw new AnalysisError('This planning operation is already running.', 409, 'DUPLICATE_SUBMISSION');
    }
    if (
      !Array.isArray(groupIds) ||
      groupIds.length !== job.items.size ||
      groupIds.some((id) => !job.items.has(id))
    ) {
      throw new AnalysisError('Planning semantic groups do not match the started operation.', 409, 'INVALID_REQUEST');
    }
    const activeId = groupIds.find((id) => this.activeGroups.has(id));
    if (activeId) {
      throw new AnalysisError('A matching semantic analysis group is already running.', 409, 'DUPLICATE_SUBMISSION');
    }
    job.claimed = true;
    groupIds.forEach((id) => this.activeGroups.set(id, jobId));
    job.touchedAt = this.now();
  }

  update(jobId, groupId, status) {
    const job = this.getJob(jobId);
    const item = job.items.get(groupId);
    if (!item) return;
    item.status = status;
    if (status === 'retrying') item.retryCount += 1;
    job.touchedAt = this.now();
    if (TERMINAL_STATUSES.has(status) && this.activeGroups.get(groupId) === jobId) {
      this.activeGroups.delete(groupId);
    }
  }

  finish(jobId) {
    const job = this.getJob(jobId);
    for (const [id, item] of job.items) {
      if (!TERMINAL_STATUSES.has(item.status)) this.update(jobId, id, 'failed');
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
    if (!job) throw new AnalysisError('Planning progress is no longer available.', 404, 'JOB_NOT_FOUND');
    return job;
  }

  prune() {
    const threshold = this.now() - JOB_TTL_MS;
    for (const [jobId, job] of this.jobs) {
      if (job.touchedAt >= threshold) continue;
      this.jobs.delete(jobId);
      for (const [groupId, activeJobId] of this.activeGroups) {
        if (activeJobId === jobId) this.activeGroups.delete(groupId);
      }
    }
  }
}

function count(items, status) {
  return items.filter((item) => item.status === status).length;
}

module.exports = { PlanningProgressTracker };

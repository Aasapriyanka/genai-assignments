const test = require('node:test');
const assert = require('node:assert/strict');
const { PlanningProgressTracker } = require('../src/planning/PlanningProgressTracker');

const jobId = '123e4567-e89b-42d3-a456-426614174000';
const groupA = 'a'.repeat(64);
const groupB = 'b'.repeat(64);

test('reports pending, retrying, successful, and failed planning groups accurately', () => {
  const tracker = new PlanningProgressTracker();
  tracker.start(jobId, [groupA, groupB]);
  tracker.claim(jobId, [groupA, groupB]);
  tracker.update(jobId, groupA, 'processing');
  tracker.update(jobId, groupA, 'retrying');
  tracker.update(jobId, groupA, 'succeeded');
  tracker.update(jobId, groupB, 'failed');
  const snapshot = tracker.snapshot(jobId);
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.succeeded, 1);
  assert.equal(snapshot.failed, 1);
  assert.equal(snapshot.pending, 0);
  assert.equal(snapshot.retrying, 0);
  assert.equal(snapshot.items[0].retryCount, 1);
});

test('prevents duplicate claims and concurrent reuse of active semantic groups', () => {
  const tracker = new PlanningProgressTracker();
  tracker.start(jobId, [groupA]);
  tracker.claim(jobId, [groupA]);
  assert.throws(() => tracker.claim(jobId, [groupA]), /already running/);
  const secondJobId = '223e4567-e89b-42d3-a456-426614174000';
  tracker.start(secondJobId, [groupA]);
  assert.throws(() => tracker.claim(secondJobId, [groupA]), /already running/);
});

test('rejects a claim whose groups do not match the started estimate', () => {
  const tracker = new PlanningProgressTracker();
  tracker.start(jobId, [groupA]);
  assert.throws(() => tracker.claim(jobId, [groupB]), /do not match/);
});

test('finalizing interrupted planning marks remaining groups failed and releases them', () => {
  const tracker = new PlanningProgressTracker();
  tracker.start(jobId, [groupA, groupB]);
  tracker.claim(jobId, [groupA, groupB]);
  tracker.update(jobId, groupA, 'succeeded');
  tracker.finish(jobId);
  assert.equal(tracker.snapshot(jobId).failed, 1);
  tracker.start('223e4567-e89b-42d3-a456-426614174000', [groupB]);
  assert.equal(tracker.snapshot('223e4567-e89b-42d3-a456-426614174000').pending, 1);
});

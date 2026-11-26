const test = require('node:test');
const assert = require('node:assert/strict');
const { AnalysisProgressTracker } = require('../src/analysis/AnalysisProgressTracker');
const { AnalysisError } = require('../src/analysis/analysisSchema');
const { validateAnalysisJob, validateJobId } = require('../src/routes');

const firstJob = '00000000-0000-4000-8000-000000000001';
const secondJob = '00000000-0000-4000-8000-000000000002';

test('prevents duplicate job submissions and concurrent requirement submissions', () => {
  const tracker = new AnalysisProgressTracker();
  tracker.start(firstJob, ['APP-1']);
  assert.throws(() => tracker.start(firstJob, ['APP-2']), (error) =>
    error instanceof AnalysisError && error.code === 'DUPLICATE_SUBMISSION'
  );
  assert.throws(() => tracker.start(secondJob, ['APP-1']), (error) =>
    error instanceof AnalysisError && error.code === 'DUPLICATE_SUBMISSION'
  );
  tracker.claim(firstJob, ['APP-1']);
  assert.throws(() => tracker.claim(firstJob, ['APP-1']), (error) =>
    error instanceof AnalysisError && error.code === 'DUPLICATE_SUBMISSION'
  );
});

test('reports pending, retrying, successful and failed counts accurately', () => {
  const tracker = new AnalysisProgressTracker();
  tracker.start(firstJob, ['APP-1', 'APP-2', 'APP-3']);
  tracker.claim(firstJob, ['APP-1', 'APP-2']);
  tracker.update(firstJob, 'APP-1', 'retrying');
  tracker.update(firstJob, 'APP-1', 'processing');
  tracker.update(firstJob, 'APP-1', 'succeeded');
  tracker.update(firstJob, 'APP-2', 'failed');

  const snapshot = tracker.snapshot(firstJob);
  assert.deepEqual({
    total: snapshot.total,
    succeeded: snapshot.succeeded,
    failed: snapshot.failed,
    pending: snapshot.pending,
    processing: snapshot.processing,
    retrying: snapshot.retrying
  }, {
    total: 3,
    succeeded: 1,
    failed: 1,
    pending: 1,
    processing: 0,
    retrying: 0
  });
  assert.equal(snapshot.items.find((item) => item.id === 'APP-1').retryCount, 1);
});

test('finalizing an interrupted job releases unsubmitted requirements', () => {
  const tracker = new AnalysisProgressTracker();
  tracker.start(firstJob, ['APP-1', 'APP-2']);
  tracker.claim(firstJob, ['APP-1']);
  tracker.finish(firstJob);
  const snapshot = tracker.snapshot(firstJob);
  assert.equal(snapshot.failed, 1);
  assert.equal(snapshot.processing, 1);
  tracker.start(secondJob, ['APP-2']);
  assert.throws(() => tracker.start('00000000-0000-4000-8000-000000000003', ['APP-1']), /already being analysed/);
});

test('validates operation identifiers and requirement lists', () => {
  assert.equal(validateJobId(firstJob), firstJob);
  assert.deepEqual(validateAnalysisJob({
    jobId: firstJob,
    requirementIds: ['APP-1', 'APP-2']
  }), {
    jobId: firstJob,
    requirementIds: ['APP-1', 'APP-2']
  });
  assert.throws(() => validateJobId('not-a-uuid'), /Invalid analysis operation ID/);
  assert.throws(() => validateAnalysisJob({
    jobId: firstJob,
    requirementIds: ['APP-1', 'APP-1']
  }), /duplicate requirement IDs/);
});

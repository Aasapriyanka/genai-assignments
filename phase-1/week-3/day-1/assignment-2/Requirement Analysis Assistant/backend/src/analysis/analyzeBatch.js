const { AnalysisError } = require('./analysisSchema');

async function analyzeBatch(requirements, analyzer, concurrency = 1, onStatus = () => {}, onUsage = () => {}) {
  const results = new Array(requirements.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), requirements.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= requirements.length) return;
      const requirement = requirements[index];
      onStatus(requirement.requirementId, 'processing');
      try {
        results[index] = {
          requirementId: requirement.requirementId,
          analysis: await analyzer.analyze(requirement, {
            onAttempt: () => onStatus(requirement.requirementId, 'processing'),
            onRetry: () => onStatus(requirement.requirementId, 'retrying'),
            onUsage
          })
        };
        onStatus(requirement.requirementId, 'succeeded');
      } catch (error) {
        results[index] = {
          requirementId: requirement.requirementId,
          error: {
            code: error instanceof AnalysisError ? error.code : 'ANALYSIS_FAILED',
            message: error instanceof AnalysisError
              ? error.message
              : 'Analysis failed unexpectedly. Please retry this requirement.'
          }
        };
        onStatus(requirement.requirementId, 'failed');
      }
    }
  }));
  return results;
}

module.exports = { analyzeBatch };

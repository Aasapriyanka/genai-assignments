function createUsageAccumulator() {
  return {
    inferenceRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retryAttempts: 0,
    usageReports: 0,
    inputTokenReports: 0,
    outputTokenReports: 0,
    completeTokenReports: 0,
    inputTokens: 0,
    outputTokens: 0,
    byOperation: {}
  };
}

function recordUsage(accumulator, event = {}) {
  const operation = typeof event.operation === 'string' ? event.operation : 'analysis';
  const target = accumulator.byOperation[operation] || createOperationUsage();
  const fields = [
    'inferenceRequests', 'successfulRequests', 'failedRequests', 'retryAttempts',
    'usageReports', 'inputTokenReports', 'outputTokenReports', 'completeTokenReports'
  ];
  fields.forEach((field) => {
    const value = Number(event[field]) || 0;
    accumulator[field] += value;
    target[field] += value;
  });
  ['inputTokens', 'outputTokens'].forEach((field) => {
    if (!Number.isFinite(event[field])) return;
    accumulator[field] += event[field];
    target[field] += event[field];
  });
  accumulator.byOperation[operation] = target;
}

function serializeUsage(accumulator) {
  const tokensComplete = accumulator.successfulRequests > 0 &&
    accumulator.completeTokenReports === accumulator.successfulRequests;
  return {
    inferenceRequests: accumulator.inferenceRequests,
    successfulRequests: accumulator.successfulRequests,
    failedRequests: accumulator.failedRequests,
    retryAttempts: accumulator.retryAttempts,
    usageReports: accumulator.usageReports,
    inputTokenReports: accumulator.inputTokenReports,
    outputTokenReports: accumulator.outputTokenReports,
    completeTokenReports: accumulator.completeTokenReports,
    inputTokens: accumulator.inputTokenReports ? accumulator.inputTokens : null,
    outputTokens: accumulator.outputTokenReports ? accumulator.outputTokens : null,
    totalTokens: tokensComplete ? accumulator.inputTokens + accumulator.outputTokens : null,
    byOperation: Object.fromEntries(Object.entries(accumulator.byOperation).map(([name, usage]) => [
      name,
      {
        inferenceRequests: usage.inferenceRequests,
        successfulRequests: usage.successfulRequests,
        failedRequests: usage.failedRequests,
        retryAttempts: usage.retryAttempts,
        usageReports: usage.usageReports,
        inputTokenReports: usage.inputTokenReports,
        outputTokenReports: usage.outputTokenReports,
        completeTokenReports: usage.completeTokenReports,
        inputTokens: usage.inputTokenReports ? usage.inputTokens : null,
        outputTokens: usage.outputTokenReports ? usage.outputTokens : null,
        totalTokens: usage.successfulRequests > 0 &&
          usage.completeTokenReports === usage.successfulRequests
          ? usage.inputTokens + usage.outputTokens
          : null
      }
    ]))
  };
}

function createOperationUsage() {
  return {
    inferenceRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retryAttempts: 0,
    usageReports: 0,
    inputTokenReports: 0,
    outputTokenReports: 0,
    completeTokenReports: 0,
    inputTokens: 0,
    outputTokens: 0
  };
}

function reportRequestUsage(context, { successful, retry }) {
  context.onUsage?.({
    operation: context.phase === 'planning' ? 'dependency-planning' : 'requirement-analysis',
    inferenceRequests: 1,
    successfulRequests: successful ? 1 : 0,
    failedRequests: successful ? 0 : 1,
    retryAttempts: retry ? 1 : 0
  });
}

module.exports = {
  createUsageAccumulator,
  recordUsage,
  serializeUsage,
  reportRequestUsage
};

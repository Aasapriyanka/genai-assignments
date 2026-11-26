const test = require('node:test');
const assert = require('node:assert/strict');
const { JiraConnector, validateJiraCloudUrl, JiraApiError } = require('../src/jira/JiraConnector');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test('retrieves project pages until Jira marks the final page', async () => {
  const requestedUrls = [];
  const connector = new JiraConnector(async (url) => {
    requestedUrls.push(url);
    if (url.includes('startAt=0')) {
      return jsonResponse({ values: [{ key: 'ONE', name: 'One' }], isLast: false });
    }
    return jsonResponse({ values: [{ key: 'TWO', name: 'Two' }], isLast: true });
  });

  const projects = await connector.getProjects({
    instanceUrl: 'https://example.atlassian.net',
    email: 'analyst@example.com',
    apiToken: 'secret'
  });

  assert.deepEqual(projects, [{ key: 'ONE', name: 'One' }, { key: 'TWO', name: 'Two' }]);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[1], /startAt=1/);
});

test('retrieves all story pages using the next page token', async () => {
  const requests = [];
  const connector = new JiraConnector(async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/rest/api/3/field')) {
      return jsonResponse([{ id: 'customfield_9', name: 'Acceptance Criteria' }]);
    }
    return url.includes('nextPageToken=next-page')
      ? jsonResponse({ issues: [{ key: 'APP-2' }], isLast: true })
      : jsonResponse({ issues: [{ key: 'APP-1' }], isLast: false, nextPageToken: 'next-page' });
  });

  test('accepts only a Jira Cloud HTTPS site base URL', () => {
    assert.equal(validateJiraCloudUrl('https://example.atlassian.net/'), 'https://example.atlassian.net');
    for (const invalid of [
      'http://example.atlassian.net',
      'https://example.atlassian.net.attacker.invalid',
      'https://nested.example.atlassian.net',
      'https://example.atlassian.net/path',
      'https://example.atlassian.net/?redirect=elsewhere'
    ]) {
      assert.throws(() => validateJiraCloudUrl(invalid), JiraApiError);
    }
  });

  const issues = await connector.getStories({
    instanceUrl: 'https://example.atlassian.net',
    email: 'analyst@example.com',
    apiToken: 'secret'
  }, 'APP');

  assert.deepEqual(issues.map((issue) => issue.key), ['APP-1', 'APP-2']);
  assert.equal(requests.length, 3);
  assert.match(requests[1].url, /project\+%3D\+APP\+AND\+issuetype\+%3D\+Story\+ORDER\+BY\+key\+ASC/);
  assert.match(requests[1].url, /fields=summary%2Cdescription%2Cpriority%2Cstatus%2Cissuelinks%2Cissuetype%2Cparent%2Ccustomfield_9/);
  assert.match(requests[2].url, /nextPageToken=next-page/);
  assert.equal(requests[1].options.redirect, 'manual');
  assert.deepEqual(issues[0].acceptanceCriteriaFields, [{ id: 'customfield_9', name: 'Acceptance Criteria' }]);
});

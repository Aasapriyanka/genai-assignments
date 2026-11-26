const test = require('node:test');
const assert = require('node:assert/strict');
const { adfToPlainText, normaliseRequirement } = require('../src/normaliseRequirement');

test('converts nested ADF paragraphs and lists into readable plain text', () => {
  const text = adfToPlainText({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second item' }] }] }
        ]
      }
    ]
  });

  assert.equal(text, 'First paragraph.\n- First item\n- Second item');
});

test('preserves absent Jira fields separately from explicitly empty values', () => {
  const requirement = normaliseRequirement({
    key: 'APP-1',
    fields: { summary: '', description: null, issuelinks: [], parent: null },
    acceptanceCriteriaFields: []
  });

  assert.equal(requirement.id, 'APP-1');
  assert.equal(requirement.title, '');
  assert.equal(requirement.description, null);
  assert.equal(requirement.priority, null);
  assert.deepEqual(requirement.acceptanceCriteria, {
    fieldRetrieved: false,
    fieldName: null,
    value: null,
    descriptionCriteria: null,
    contentAvailable: false
  });
  assert.deepEqual(requirement.dependencies, []);
  assert.equal(requirement.parent, null);
  assert.equal(requirement.availability.title, true);
  assert.equal(requirement.availability.priority, false);
  assert.equal(requirement.availability.parent, true);
  assert.equal(requirement.availability.acceptanceCriteria, false);
});

test('normalises discovered acceptance-criteria custom fields without inventing values', () => {
  const populated = normaliseRequirement({
    key: 'APP-3',
    fields: { customfield_7: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Must save.' }] }] } },
    acceptanceCriteriaFields: [{ id: 'customfield_7', name: 'Acceptance Criteria' }]
  });
  const empty = normaliseRequirement({
    key: 'APP-4',
    fields: { customfield_7: null },
    acceptanceCriteriaFields: [{ id: 'customfield_7', name: 'Acceptance Criteria' }]
  });

  assert.deepEqual(populated.acceptanceCriteria, {
    fieldRetrieved: true,
    fieldName: 'Acceptance Criteria',
    value: 'Must save.',
    descriptionCriteria: null,
    contentAvailable: true
  });
  assert.deepEqual(empty.acceptanceCriteria, {
    fieldRetrieved: true,
    fieldName: 'Acceptance Criteria',
    value: '',
    descriptionCriteria: null,
    contentAvailable: false
  });
});

test('treats null, undefined, empty, whitespace and empty ADF field values as empty', () => {
  const emptyValues = [null, undefined, '', '   ', { type: 'doc', content: [] }];
  for (const [index, value] of emptyValues.entries()) {
    const requirement = normaliseRequirement({
      key: `APP-${index}`,
      fields: { customfield_8: value },
      acceptanceCriteriaFields: [{ id: 'customfield_8', name: 'Acceptance Criteria' }]
    });
    assert.equal(requirement.acceptanceCriteria.fieldRetrieved, true);
    assert.equal(requirement.acceptanceCriteria.value, '');
    assert.equal(requirement.acceptanceCriteria.contentAvailable, false);
  }
});

test('extracts acceptance criteria embedded in Jira descriptions', () => {
  const requirement = normaliseRequirement({
    key: 'APP-5',
    fields: {
      description: 'As a member, save a draft.\n\n## Acceptance Criteria\n- Draft is stored.\n- Confirmation is shown.\n\n## Notes\nInternal implementation detail.'
    },
    acceptanceCriteriaFields: []
  });

  assert.equal(requirement.acceptanceCriteria.fieldRetrieved, false);
  assert.equal(requirement.acceptanceCriteria.descriptionCriteria, '- Draft is stored.\n- Confirmation is shown.');
  assert.equal(requirement.acceptanceCriteria.contentAvailable, true);
});

test('empty ADF descriptions contain no embedded acceptance criteria', () => {
  const requirement = normaliseRequirement({
    key: 'APP-6',
    fields: { description: { type: 'doc', content: [] } },
    acceptanceCriteriaFields: []
  });
  assert.equal(requirement.description, '');
  assert.equal(requirement.acceptanceCriteria.descriptionCriteria, null);
});

test('retains missing relationship fields as unavailable', () => {
  const requirement = normaliseRequirement({ key: 'APP-2', fields: {} });
  assert.equal(requirement.dependencies, null);
  assert.equal(requirement.parent, null);
  assert.equal(requirement.description, null);
  assert.equal(requirement.availability.dependencies, false);
  assert.equal(requirement.availability.parent, false);
});

test('preserves Jira issue-link direction labels for dependency interpretation', () => {
  const requirement = normaliseRequirement({
    key: 'APP-7',
    fields: {
      issuelinks: [
        {
          type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          outwardIssue: { key: 'APP-8' }
        },
        {
          type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          inwardIssue: { key: 'APP-9' }
        }
      ]
    }
  });

  assert.deepEqual(requirement.dependencies, [
    { key: 'APP-8', type: 'Blocks', direction: 'outward', outward: 'blocks', inward: 'is blocked by' },
    { key: 'APP-9', type: 'Blocks', direction: 'inward', outward: 'blocks', inward: 'is blocked by' }
  ]);
  assert.equal(requirement.availability.dependencies, true);
  assert.equal(requirement.availability.parent, false);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveDepartmentName,
  computePriority,
  NEARBY_RADIUS_METERS,
} = require('../src/services/departmentService');

test('resolveDepartmentName routes known categories to their department', () => {
  assert.equal(resolveDepartmentName('pothole'), 'Roads/Infrastructure');
  assert.equal(resolveDepartmentName('road obstruction'), 'Roads/Infrastructure');
  assert.equal(resolveDepartmentName('garbage'), 'Sanitation');
  assert.equal(resolveDepartmentName('drainage blockage'), 'Sanitation');
  assert.equal(resolveDepartmentName('broken streetlight'), 'Electrical');
  assert.equal(resolveDepartmentName('water leakage'), 'Water Department');
});

test('resolveDepartmentName falls back to Unassigned for unknown/blank categories', () => {
  assert.equal(resolveDepartmentName('alien invasion'), 'Unassigned');
  assert.equal(resolveDepartmentName(''), 'Unassigned');
  assert.equal(resolveDepartmentName(undefined), 'Unassigned');
  assert.equal(resolveDepartmentName(null), 'Unassigned');
});

test('computePriority: high severity with 3 nearby reports escalates to critical', () => {
  const r = computePriority('high', 3);
  assert.equal(r.priority, 'critical');
  assert.equal(typeof r.priorityReason, 'string');
  assert.match(r.priorityReason, /6/);
  assert.match(r.priorityReason, /critical/);
});

test('computePriority: low severity with no nearby reports stays low', () => {
  assert.equal(computePriority('low', 0).priority, 'low');
});

test('computePriority: medium severity with 1 nearby report stays medium; high with 2 stays high', () => {
  assert.equal(computePriority('medium', 1).priority, 'medium');
  assert.equal(computePriority('high', 2).priority, 'high');
});

test('computePriority returns a rich human-readable reason', () => {
  const r = computePriority('high', 3);
  assert.equal(typeof r.priorityReason, 'string');
  assert.match(r.priorityReason, /nearby/i);
  assert.match(r.priorityReason, /score/i);
  assert.match(r.priorityReason, /[0-9]/);
});

test('NEARBY_RADIUS_METERS is a finite positive meter value', () => {
  assert.ok(Number.isFinite(NEARBY_RADIUS_METERS));
  assert.ok(NEARBY_RADIUS_METERS > 0);
});

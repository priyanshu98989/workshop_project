const { test } = require('node:test');
const assert = require('node:assert/strict');

const store = require('../src/db/memoryStore');

// memoryStore is a module-level singleton (in-memory). Tests only assert
// deltas / monotonic growth so they stay green no matter how many complaint
// rows earlier tests in this file (or other test files) added.

const CATEGORY = 'pothole';
const TITLE = 'Deep pothole near the market';
const DESCRIPTION = 'Deep pothole blocking two-wheelers';
const SEVERITY = 'high';
const DEPARTMENT = 'Roads/Infrastructure';
const PRIORITY = 'high';
const REPORTER = 'usr_reporter-a';
const OTHER = 'usr_reporter-b';
const LON = 77.1025;
const LAT = 28.7041;

function basePayload() {
  return {
    title: TITLE,
    description: DESCRIPTION,
    category: CATEGORY,
    severity: SEVERITY,
    department: null,
    departmentName: DEPARTMENT,
    priority: PRIORITY,
    priorityReason: 'high severity (3 pt) + 无声 nearby = score 5',
    aiTimeline: [
      { step: 'AI analyzed image', ts: new Date().toISOString() },
      { step: 'Assigned department', ts: new Date().toISOString() },
    ],
    location: { type: 'Point', coordinates: [LON, LAT] },
    locationSource: 'device',
    reportedBy: REPORTER,
    status: 'Pending',
  };
}

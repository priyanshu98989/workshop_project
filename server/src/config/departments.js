// Configurable category → department routing.
//
// Edit this map to change where AI-routed complaints land. Each key is a
// complaint category (see COMPLAINT_CATEGORIES in ./constants). Individual
// department names can be overridden at deploy time without code edits via the
// DEPARTMENT_ROUTING_OVERRIDES env var, e.g.:
//   DEPARTMENT_ROUTING_OVERRIDES='{"pothole":"Highways & Roads"}'

const DEFAULT_ROUTING = {
  pothole: { name: 'Roads/Infrastructure' },
  'road obstruction': { name: 'Roads/Infrastructure' },
  garbage: { name: 'Sanitation' },
  'broken streetlight': { name: 'Electrical' },
  'water leakage': { name: 'Water Department' },
  'drainage blockage': { name: 'Sanitation' },
  other: { name: 'General' },
};

function loadOverrides() {
  try {
    return JSON.parse(process.env.DEPARTMENT_ROUTING_OVERRIDES || '{}');
  } catch (err) {
    return {};
  }
}

const OVERRIDES = loadOverrides();

const DEPARTMENT_ROUTING = Object.keys(DEFAULT_ROUTING).reduce((acc, category) => {
  const overrideName = OVERRIDES[category];
  acc[category] = {
    name: typeof overrideName === 'string' && overrideName.trim()
      ? overrideName.trim()
      : DEFAULT_ROUTING[category].name,
  };
  return acc;
}, {});

const UNASSIGNED_DEPARTMENT = 'Unassigned';

// Priority is derived from severity plus the number of nearby reports.
const SEVERITY_PRIORITY_WEIGHTS = { low: 1, medium: 2, high: 3 };
const NEARBY_RADIUS_METERS = 200;
const PRIORITY_SCORE_CUTOFFS = [
  { min: 6, level: 'critical' },
  { min: 5, level: 'high' },
  { min: 3, level: 'medium' },
  { min: 0, level: 'low' },
];

const AI_TIMELINE_STEPS = {
  analyzeImage: 'AI analyzed image',
  detectCategory: 'Detected category',
  detectSeverity: 'Detected severity',
  checkDuplicates: 'Checked duplicates',
  assignDepartment: 'Assigned department',
  assignPriority: 'Assigned priority',
  complaintCreated: 'Complaint created',
  complaintMerged: 'Merged with existing complaint',
};

module.exports = {
  DEPARTMENT_ROUTING,
  UNASSIGNED_DEPARTMENT,
  SEVERITY_PRIORITY_WEIGHTS,
  NEARBY_RADIUS_METERS,
  PRIORITY_SCORE_CUTOFFS,
  AI_TIMELINE_STEPS,
};
const COMPLAINT_CATEGORIES = [
  'pothole',
  'garbage',
  'water leakage',
  'broken streetlight',
  'road obstruction',
  'drainage blockage',
  'other',
];

const SEVERITY_LEVELS = ['low', 'medium', 'high'];

const COMPLAINT_STATUSES = ['Pending', 'Acknowledged', 'In Progress', 'Resolved'];

const USER_ROLES = ['citizen', 'officer', 'admin'];

const DEDUP_RADIUS_METERS = 50;

const USERNAME_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}$/i;

module.exports = {
  COMPLAINT_CATEGORIES,
  SEVERITY_LEVELS,
  COMPLAINT_STATUSES,
  USER_ROLES,
  DEDUP_RADIUS_METERS,
  USERNAME_PATTERN,
};
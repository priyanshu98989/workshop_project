const Department = require('../models/Department');
const { isMemoryMode } = require('../db/connect');
const {
  DEPARTMENT_ROUTING,
  UNASSIGNED_DEPARTMENT,
  SEVERITY_PRIORITY_WEIGHTS,
  NEARBY_RADIUS_METERS,
  PRIORITY_SCORE_CUTOFFS,
} = require('../config/departments');

// Department name for a category — always available, even in memory mode.
function resolveDepartmentName(category) {
  return DEPARTMENT_ROUTING[category]?.name || UNASSIGNED_DEPARTMENT;
}

// Resolve a Department document reference for the category. In MongoDB mode the
// department is found (or created) so complaint.department is a valid ObjectId.
// In memory mode we return the plain name which memoryStore stores as-is.
async function resolveDepartment(category) {
  const name = resolveDepartmentName(category);
  if (isMemoryMode()) return { _id: name, name };

  try {
    let dept = await Department.findOne({ name }).select('_id name').lean();
    if (!dept) {
      await Department.updateOne(
        { name },
        { $setOnInsert: { name, categories: [category] } },
        { upsert: true }
      );
      dept = await Department.findOne({ name }).select('_id name').lean();
    }
    return dept;
  } catch (err) {
    return isMemoryMode() ? { _id: name, name } : null;
  }
}

// Priority = severity weight + number of nearby reports of the same category.
function computePriority(severity, nearbyReportCount) {
  const base = SEVERITY_PRIORITY_WEIGHTS[severity] ?? 2;
  const nearby = Math.max(0, Math.floor(Number(nearbyReportCount) || 0));
  const score = base + nearby;

  let level = 'low';
  for (const cutoff of PRIORITY_SCORE_CUTOFFS) {
    if (score >= cutoff.min) {
      level = cutoff.level;
      break;
    }
  }

  const reason =
    `Severity ${severity} (${base} pt) + ${nearby} nearby report${nearby === 1 ? '' : 's'} within ${NEARBY_RADIUS_METERS}m ` +
    `= score ${score} → ${level} priority`;
  return { priority: level, priorityReason: reason };
}

module.exports = {
  resolveDepartmentName,
  resolveDepartment,
  computePriority,
  NEARBY_RADIUS_METERS,
};
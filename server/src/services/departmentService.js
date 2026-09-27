const Department = require('../models/Department');
const { isMemoryMode } = require('../db/connect');
const logger = require('../utils/logger');
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
    // One atomic upsert instead of findOne -> updateOne(upsert) -> findOne.
    // The read-then-write pair raced with itself: two complaints routed to the
    // same new department could both read "not found" and both attempt the
    // insert, and since name is uniquely indexed the loser got a duplicate key
    // error and the complaint was stored with department: null.
    return await Department.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, categories: [category] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .select('_id name')
      .lean();
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Department.findOne({ name }).select('_id name').lean();
      if (existing) return existing;
    }
    // Previously swallowed outright, so a database failure here was
    // indistinguishable from "no department configured".
    logger.warn(`Department resolution failed for "${name}" (${err.message})`);
    return isMemoryMode() ? { _id: name, name } : null;
  }
}

// Priority = severity weight + number of nearby reports of the same category.
function computePriority(severity, nearbyReportCount) {
  const base = SEVERITY_PRIORITY_WEIGHTS[severity] ?? 2;
  const nearby = Math.max(0, Math.floor(Number(nearbyReportCount) || 0));
  const score = base + nearby;

  let level = 'low';
  // Scanned high to low so the first cutoff the score clears wins. The order is
  // taken from the config rather than assumed, because reading the cutoffs
  // ascending would let the { min: 0 } entry match everything and silently pin
  // every complaint to low priority.
  const cutoffs = [...PRIORITY_SCORE_CUTOFFS].sort((a, b) => b.min - a.min);
  for (const cutoff of cutoffs) {
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
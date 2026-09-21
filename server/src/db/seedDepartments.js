const Department = require('../models/Department');
const { DEPARTMENT_ROUTING } = require('../config/departments');

// Department documents are seeded from the same routing config the app uses to
// assign complaints, so the category → department links always stay in sync.
function buildDepartments() {
  const byName = {};
  const categoriesByName = {};
  for (const [category, dept] of Object.entries(DEPARTMENT_ROUTING)) {
    if (!byName[dept.name]) byName[dept.name] = dept.name;
    (categoriesByName[dept.name] = categoriesByName[dept.name] || []).push(category);
  }
  return Object.entries(byName).map(([name]) => ({
    name,
    categories: categoriesByName[name],
  }));
}

async function ensureDepartments() {
  const departments = buildDepartments();
  for (const dept of departments) {
    await Department.updateOne(
      { name: dept.name },
      { $setOnInsert: dept },
      { upsert: true }
    );
  }
}

module.exports = { ensureDepartments };
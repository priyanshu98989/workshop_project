const Department = require('../models/Department');

const DEPARTMENTS = [
  {
    name: 'Roads & Public Works',
    categories: ['pothole', 'road obstruction', 'street light', 'road'],
  },
  {
    name: 'Water & Sanitation',
    categories: ['garbage', 'drainage', 'water leakage', 'illegal dumping'],
  },
  {
    name: 'Public Safety',
    categories: ['security', 'traffic', 'accident', 'safety'],
  },
];

async function ensureDepartments() {
  for (const dept of DEPARTMENTS) {
    await Department.updateOne(
      { name: dept.name },
      { $setOnInsert: dept },
      { upsert: true }
    );
  }
}

module.exports = { ensureDepartments };
const mongoose = require('mongoose');
const { mongodbUri } = require('../config/env');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const { hashPassword } = require('../utils/password');

async function seed() {
  await mongoose.connect(mongodbUri);
  await User.deleteMany({});
  await Department.deleteMany({});
  await Complaint.deleteMany({});

  const citizen = await User.create({
    name: 'Jane Doe',
    email: 'jane@civiceye.org',
    password: hashPassword('demo-password'),
    civicScore: 45,
  });

  const roads = await Department.create({
    name: 'Roads/Infrastructure',
    categories: ['pothole', 'road obstruction'],
  });

  await Complaint.create({
    title: 'POTHOLE reported',
    description: 'Deep pothole on main road.',
    category: 'pothole',
    severity: 'high',
    confidenceScore: 0.94,
    images: [{ url: 'https://via.placeholder.com/600x400' }],
    location: { type: 'Point', coordinates: [75.7873, 26.9124] },
    address: 'M.I. Road, Ward 5',
    status: 'Pending',
    department: roads._id,
    departmentName: 'Roads/Infrastructure',
    priority: 'high',
    priorityReason: 'Severity high (3 pt) + 2 nearby report(s) within 200m = score 5 → high priority',
    reportedBy: citizen._id,
    supportScore: 4,
    ward: 'Ward 5',
  });

  console.log('Database seeded successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
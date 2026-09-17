const { haversineDistance } = require('../utils/geo');

const users = [];
const complaints = [];
let complaintIdCounter = 1;
let userIdCounter = 1;

function nextComplaintId() {
  return 'mem_' + String(complaintIdCounter++).padStart(6, '0');
}

function nextUserId() {
  return 'usr_' + String(userIdCounter++).padStart(6, '0');
}

function findUserByEmail(email) {
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

function createUser(data) {
  const user = {
    _id: nextUserId(),
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role || 'citizen',
    civicScore: data.civicScore || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

const publicUser = ({ password, ...rest }) => rest;

function createComplaint(data) {
  const complaint = {
    _id: nextComplaintId(),
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    confidenceScore: data.confidenceScore,
    images: data.images || [],
    location: {
      type: 'Point',
      coordinates: [data.longitude, data.latitude],
    },
    department: data.department || null,
    reportedBy: data.reportedBy,
    status: 'Pending',
    mergedUsers: [],
    supportScore: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  complaints.unshift(complaint);
  return complaint;
}

function listComplaints() {
  return [...complaints];
}

function findComplaintById(id) {
  return complaints.find((c) => c._id === id) || null;
}

function findNearbyDuplicate({ category, longitude, latitude, maxDistance }) {
  return complaints.find(
    (c) =>
      c.category === category &&
      c.status !== 'Resolved' &&
      haversineDistance(
        latitude,
        longitude,
        c.location.coordinates[1],
        c.location.coordinates[0]
      ) <= maxDistance
  );
}

function addSupport(complaint, userId) {
  if (!complaint.mergedUsers.includes(userId)) {
    complaint.supportScore += 1;
    complaint.mergedUsers.push(userId);
  }
  return complaint;
}

function updateComplaintStatus(complaint, status) {
  complaint.status = status;
  complaint.updatedAt = new Date().toISOString();
  if (status === 'Resolved') complaint.resolvedAt = new Date().toISOString();
  return complaint;
}

module.exports = {
  findUserByEmail,
  createUser,
  publicUser,
  createComplaint,
  listComplaints,
  findComplaintById,
  findNearbyDuplicate,
  addSupport,
  updateComplaintStatus,
};
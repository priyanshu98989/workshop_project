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
  const hasLocation =
    data.location &&
    Array.isArray(data.location.coordinates) &&
    data.location.coordinates.length === 2;
  const complaint = {
    _id: nextComplaintId(),
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    confidenceScore: data.confidenceScore,
    images: data.images || [],
    location: hasLocation ? data.location : null,
    locationSource: data.locationSource || 'not-provided',
    department: data.department || null,
    departmentName: data.departmentName || 'Unassigned',
    priority: data.priority || 'medium',
    priorityReason: data.priorityReason || '',
    aiTimeline: Array.isArray(data.aiTimeline) ? data.aiTimeline : [],
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

function findNearbyDuplicate({ category, longitude, latitude, reporterId, maxDistance }) {
  return complaints.find(
    (c) =>
      c.location &&
      c.reportedBy !== reporterId &&
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

function countNearbyReports({ category, longitude, latitude, reporterId, radius }) {
  return complaints.filter(
    (c) =>
      c.location &&
      c.category === category &&
      c.status !== 'Resolved' &&
      (!reporterId || c.reportedBy !== reporterId) &&
      haversineDistance(
        latitude,
        longitude,
        c.location.coordinates[1],
        c.location.coordinates[0]
      ) <= radius
  ).length;
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

function pushTimeline(complaint, event) {
  complaint.aiTimeline = complaint.aiTimeline || [];
  complaint.aiTimeline.push({ ...event, ts: event.ts || new Date().toISOString() });
  complaint.updatedAt = new Date().toISOString();
  return complaint;
}

function setPriority(complaint, { priority, priorityReason }) {
  complaint.priority = priority;
  complaint.priorityReason = priorityReason || complaint.priorityReason;
  complaint.updatedAt = new Date().toISOString();
  return complaint;
}

function stats() {
  const statuses = [
    'Pending',
    'Acknowledged',
    'In Progress',
    'Resolved',
    'Any',
  ];
  const count = (fn) => complaints.filter(fn).length;
  return {
    total: complaints.length,
    byStatus: statuses.reduce(
      (acc, s) => ({ ...acc, [s]: count((c) => c.status === s) }),
      {}
    ),
    byCategory: countBy('category'),
    byDepartment: countBy('departmentName'),
    bySeverity: countBy('severity'),
    byPriority: countBy('priority'),
  };
  function countBy(key) {
    return complaints.reduce((acc, c) => {
      const val = c[key] || 'None';
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }
}

module.exports = {
  findUserByEmail,
  createUser,
  publicUser,
  createComplaint,
  listComplaints,
  findComplaintById,
  findNearbyDuplicate,
  countNearbyReports,
  addSupport,
  pushTimeline,
  setPriority,
  updateComplaintStatus,
  stats,
};
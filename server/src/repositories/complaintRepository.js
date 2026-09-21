const { isMemoryMode } = require('../db/connect');
const memoryStore = require('../db/memoryStore');
const { DEDUP_RADIUS_METERS } = require('../config/constants');
const { NEARBY_RADIUS_METERS } = require('../config/departments');
const { haversineDistance } = require('../utils/geo');
const Complaint = require('../models/Complaint');

function toPlain(doc) {
  return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

function attachDistance(complaint, longitude, latitude) {
  if (!complaint || !complaint.location?.coordinates) return complaint;
  return {
    ...complaint,
    distanceMeters: Math.round(
      haversineDistance(
        latitude,
        longitude,
        complaint.location.coordinates[1],
        complaint.location.coordinates[0]
      )
    ),
  };
}

exports.create = async (data) => {
  const hasLocation = data.longitude !== undefined && data.latitude !== undefined;
  const base = {
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    confidenceScore: data.confidenceScore,
    images: data.images || [],
    location: hasLocation
      ? { type: 'Point', coordinates: [data.longitude, data.latitude] }
      : undefined,
    locationSource: data.locationSource || 'not-provided',
    department: data.department || null,
    departmentName: data.departmentName || 'Unassigned',
    priority: data.priority || 'medium',
    priorityReason: data.priorityReason || '',
    aiTimeline: Array.isArray(data.aiTimeline) ? data.aiTimeline : [],
    reportedBy: data.reportedBy,
  };
  if (isMemoryMode()) return memoryStore.createComplaint(base);
  const entry = { ...base };
  if (!hasLocation) delete entry.location;
  const complaint = await Complaint.create(entry);
  return toPlain(complaint);
};

exports.list = async () => {
  if (isMemoryMode()) return memoryStore.listComplaints();
  const docs = await Complaint.find()
    .populate('department', 'name')
    .sort({ createdAt: -1 })
    .lean();
  return docs;
};

exports.findById = async (id) => {
  if (isMemoryMode()) return memoryStore.findComplaintById(id);
  return Complaint.findById(id).lean();
};

exports.findNearbyDuplicate = async ({ category, longitude, latitude, reporterId, maxDistance = DEDUP_RADIUS_METERS }) => {
  if (isMemoryMode()) {
    const found = memoryStore.findNearbyDuplicate({ category, longitude, latitude, reporterId, maxDistance });
    return attachDistance(found, longitude, latitude);
  }
  const found = await Complaint.findOne({
    category,
    reportedBy: { $ne: reporterId },
    status: { $ne: 'Resolved' },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        $maxDistance,
      },
    },
  }).lean();
  return attachDistance(found, longitude, latitude);
};

// Count non-resolved nearby reports of the same category (used for priority).
exports.countNearbyReports = async ({ category, longitude, latitude, reporterId, radius = NEARBY_RADIUS_METERS }) => {
  const coords = [parseFloat(longitude), parseFloat(latitude)];
  if (isMemoryMode()) {
    return memoryStore.countNearbyReports({ category, longitude, latitude, reporterId, radius });
  }
  return Complaint.countDocuments({
    category,
    status: { $ne: 'Resolved' },
    ...(reporterId ? { reportedBy: { $ne: reporterId } } : {}),
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: coords },
        $maxDistance: radius,
      },
    },
  });
};

exports.addSupport = async (complaintId, userId) => {
  if (isMemoryMode()) {
    const complaint = memoryStore.findComplaintById(complaintId);
    if (!complaint) return null;
    return memoryStore.addSupport(complaint, userId);
  }
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  if (!complaint.mergedUsers.includes(userId)) {
    complaint.supportScore += 1;
    complaint.mergedUsers.push(userId);
    await complaint.save();
  }
  return toPlain(complaint);
};

exports.pushTimeline = async (complaintId, event) => {
  if (isMemoryMode()) {
    const complaint = memoryStore.findComplaintById(complaintId);
    if (complaint) memoryStore.pushTimeline(complaint, event);
    return complaint;
  }
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  complaint.aiTimeline.push(event);
  await complaint.save();
  return toPlain(complaint);
};

exports.setPriority = async (complaintId, { priority, priorityReason }) => {
  if (isMemoryMode()) {
    const complaint = memoryStore.findComplaintById(complaintId);
    if (complaint) memoryStore.setPriority(complaint, { priority, priorityReason });
    return complaint;
  }
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  complaint.priority = priority;
  complaint.priorityReason = priorityReason;
  await complaint.save();
  return toPlain(complaint);
};

exports.updateStatus = async (complaintId, status) => {
  if (isMemoryMode()) {
    const complaint = memoryStore.findComplaintById(complaintId);
    if (!complaint) return null;
    return memoryStore.updateComplaintStatus(complaint, status);
  }
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  complaint.status = status;
  complaint.resolvedAt = status === 'Resolved' ? new Date() : undefined;
  await complaint.save();
  return toPlain(complaint);
};

exports.stats = async () => {
  if (isMemoryMode()) return memoryStore.stats();

  const [byStatus, byCategory, byDepartment, bySeverity, byPriority] = await Promise.all([
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$departmentName', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);

  const toObject = (rows) =>
    rows.reduce((acc, row) => ({ ...acc, [row._id || 'None']: row.count }), {});
  const total = await Complaint.countDocuments();

  return {
    total,
    byStatus: toObject(byStatus),
    byCategory: toObject(byCategory),
    byDepartment: toObject(byDepartment),
    bySeverity: toObject(bySeverity),
    byPriority: toObject(byPriority),
  };
};

module.exports = {
  create: exports.create,
  list: exports.list,
  findById: exports.findById,
  findNearbyDuplicate: exports.findNearbyDuplicate,
  countNearbyReports: exports.countNearbyReports,
  addSupport: exports.addSupport,
  pushTimeline: exports.pushTimeline,
  setPriority: exports.setPriority,
  updateStatus: exports.updateStatus,
  stats: exports.stats,
};
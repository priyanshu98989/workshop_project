const { isMemoryMode } = require('../db/connect');
const memoryStore = require('../db/memoryStore');
const { DEDUP_RADIUS_METERS } = require('../config/constants');
const Complaint = require('../models/Complaint');

function toPlain(doc) {
  return doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

exports.create = async (data) => {
  if (isMemoryMode()) return memoryStore.createComplaint(data);
  const complaint = await Complaint.create({
    title: data.title,
    description: data.description,
    category: data.category,
    severity: data.severity,
    confidenceScore: data.confidenceScore,
    images: data.images || [],
    location: { type: 'Point', coordinates: [data.longitude, data.latitude] },
    department: data.department || null,
    reportedBy: data.reportedBy,
  });
  return toPlain(complaint);
};

exports.list = async () => {
  if (isMemoryMode()) return memoryStore.listComplaints();
  const docs = await Complaint.find().sort({ createdAt: -1 }).lean();
  return docs;
};

exports.findById = async (id) => {
  if (isMemoryMode()) return memoryStore.findComplaintById(id);
  return Complaint.findById(id).lean();
};

exports.findNearbyDuplicate = async ({ category, longitude, latitude, reporterId, maxDistance = DEDUP_RADIUS_METERS }) => {
  if (isMemoryMode()) {
    return memoryStore.findNearbyDuplicate({ category, longitude, latitude, reporterId, maxDistance });
  }
  return Complaint.findOne({
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
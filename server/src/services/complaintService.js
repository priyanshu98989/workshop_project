const { classifyCivicIssue } = require('./aiService');
const complaintRepository = require('../repositories/complaintRepository');
const AppError = require('../utils/AppError');
const Department = require('../models/Department');
const { isMemoryMode } = require('../db/connect');
const { COMPLAINT_STATUSES, DEDUP_RADIUS_METERS } = require('../config/constants');

function validateCoordinates(longitude, latitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new AppError('Valid longitude and latitude are required.', 400);
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new AppError('Invalid coordinates provided.', 400);
  }
}

function validateImage(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    throw new AppError('A photo is required.', 400);
  }
}

async function resolveDepartment(category) {
  if (isMemoryMode()) return null;
  try {
    return Department.findOne({ categories: category }).select('_id').lean();
  } catch (err) {
    return null;
  }
}

async function createComplaint({ userId, longitude, latitude, imageBase64, mimeType, optionalNote }) {
  validateCoordinates(longitude, latitude);
  validateImage(imageBase64);

  const aiResult = await classifyCivicIssue(imageBase64, mimeType);

  const duplicate = await complaintRepository.findNearbyDuplicate({
    category: aiResult.category,
    longitude,
    latitude,
    maxDistance: DEDUP_RADIUS_METERS,
  });

  if (duplicate) {
    const updated = await complaintRepository.addSupport(duplicate._id, userId);
    return {
      isDuplicate: true,
      message: 'Duplicate detected. Support score updated.',
      complaint: updated || duplicate,
    };
  }

  const department = await resolveDepartment(aiResult.category);

  const complaint = await complaintRepository.create({
    title: `${aiResult.category.toUpperCase()} reported`,
    description: optionalNote
      ? `${aiResult.description} | Note: ${optionalNote}`
      : aiResult.description,
    category: aiResult.category,
    severity: aiResult.severity,
    confidenceScore: aiResult.confidence,
    images: [{ url: 'https://via.placeholder.com/600x400' }],
    longitude,
    latitude,
    department: department?._id || null,
    reportedBy: userId,
  });

  return { isDuplicate: false, message: 'Complaint submitted.', complaint };
}

async function listComplaints() {
  const complaints = await complaintRepository.list();
  return complaints;
}

async function updateComplaintStatus(complaintId, status) {
  if (!COMPLAINT_STATUSES.includes(status)) {
    throw new AppError(
      `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}`,
      400
    );
  }

  const complaint = await complaintRepository.updateStatus(complaintId, status);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }

  return complaint;
}

module.exports = { createComplaint, listComplaints, updateComplaintStatus };
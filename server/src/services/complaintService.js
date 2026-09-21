const { classifyCivicIssue } = require('./aiService');
const {
  resolveDepartment,
  resolveDepartmentName,
  computePriority,
} = require('./departmentService');
const complaintRepository = require('../repositories/complaintRepository');
const AppError = require('../utils/AppError');
const { isMemoryMode } = require('../db/connect');
const { COMPLAINT_STATUSES, DEDUP_RADIUS_METERS } = require('../config/constants');
const { AI_TIMELINE_STEPS } = require('../config/departments');

function validateCoordinates(longitude, latitude) {
  if (longitude === undefined || latitude === undefined) return;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
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

function timelineStep(step, detail) {
  return { step, detail, ts: new Date() };
}

async function createComplaint({
  userId,
  longitude,
  latitude,
  imageBase64,
  mimeType,
  optionalNote,
  locationTrusted,
  locationSource,
}) {
  validateImage(imageBase64);
  validateCoordinates(longitude, latitude);

  const storeLocation = locationTrusted === true && longitude !== undefined && latitude !== undefined;
  const source = storeLocation ? locationSource || 'device' : 'not-provided';

  // Agentic pipeline: AI analyzes and decides category/severity/dept/priority/action,
  // then the backend executes the decided action (create or merge).
  const aiResult = await classifyCivicIssue(imageBase64, mimeType);

  const timeline = [
    timelineStep(AI_TIMELINE_STEPS.analyzeImage, `Confidence ${Math.round((aiResult.confidence || 0) * 100)}%`),
    timelineStep(AI_TIMELINE_STEPS.detectCategory, aiResult.category),
    timelineStep(AI_TIMELINE_STEPS.detectSeverity, aiResult.severity),
  ];

  let duplicate = null;
  let nearbyCount = 0;
  if (storeLocation) {
    duplicate = await complaintRepository.findNearbyDuplicate({
      category: aiResult.category,
      longitude,
      latitude,
      reporterId: userId,
      maxDistance: DEDUP_RADIUS_METERS,
    });
    nearbyCount = await complaintRepository.countNearbyReports({
      category: aiResult.category,
      longitude,
      latitude,
      reporterId: userId,
    });
  }

  timeline.push(
    timelineStep(
      AI_TIMELINE_STEPS.checkDuplicates,
      duplicate
        ? `Duplicate found ~${duplicate.distanceMeters ?? '?'}m away`
        : 'No nearby duplicates found'
    )
  );

  const aiAnalysis = {
    category: aiResult.category,
    severity: aiResult.severity,
    confidence: aiResult.confidence,
    description: aiResult.description,
    department: aiResult.department || '',
    priorityHint: aiResult.priority || '',
    nextAction: aiResult.nextAction || 'create_complaint',
  };

  // === Agentic action #1: merge with the existing duplicate ===
  if (duplicate) {
    const updated = await complaintRepository.addSupport(duplicate._id, userId);
    const latest = updated || duplicate;
    const recomputed = computePriority(latest.severity, Math.max(0, (latest.supportScore || 1) - 1));
    await complaintRepository.setPriority(latest._id, recomputed);
    await complaintRepository.pushTimeline(latest._id, {
      ...timelineStep(
        AI_TIMELINE_STEPS.complaintMerged,
        `New report linked to complaint #${String(latest._id).slice(-8)} (${latest.distanceMeters ?? '?'}m away)`
      ),
    });
    await complaintRepository.pushTimeline(latest._id, {
      ...timelineStep(AI_TIMELINE_STEPS.assignPriority, recomputed.reason),
    });

    return {
      isDuplicate: true,
      message: `Duplicate detected — a similar ${aiResult.category} report already exists ~${latest.distanceMeters ?? '?'}m away. Your report was linked/merged with it.`,
      complaint: latest,
      existingComplaint: duplicate,
      aiAnalysis: {
        ...aiAnalysis,
        departmentName: latest.departmentName || resolveDepartmentName(aiResult.category),
        priority: recomputed.priority,
        priorityReason: recomputed.reason,
        executedAction: 'merged',
      },
    };
  }

  // === Agentic action #2: create a new complaint with routing + priority ===
  const dept = await resolveDepartment(aiResult.category);
  const departmentName = resolveDepartmentName(aiResult.category);
  const { priority, priorityReason } = computePriority(aiResult.severity, nearbyCount);

  timeline.push(
    timelineStep(AI_TIMELINE_STEPS.assignDepartment, departmentName),
    timelineStep(AI_TIMELINE_STEPS.assignPriority, priorityReason)
  );

  const imageDataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

  const complaint = await complaintRepository.create({
    title: `${aiResult.category.toUpperCase()} reported`,
    description: optionalNote
      ? `${aiResult.description} | Note: ${optionalNote}`
      : aiResult.description,
    category: aiResult.category,
    severity: aiResult.severity,
    confidenceScore: aiResult.confidence,
    images: [{ url: imageDataUrl, uploadedAt: new Date() }],
    longitude: storeLocation ? longitude : undefined,
    latitude: storeLocation ? latitude : undefined,
    locationSource: source,
    department: isMemoryMode() ? null : dept?._id || null,
    departmentName,
    priority,
    priorityReason,
    aiTimeline: [...timeline, timelineStep(AI_TIMELINE_STEPS.complaintCreated, String(aiResult.category))],
    reportedBy: userId,
  });

  return {
    isDuplicate: false,
    message: 'Complaint submitted.',
    complaint,
    aiAnalysis: {
      ...aiAnalysis,
      departmentName,
      priority,
      priorityReason,
      executedAction: 'created',
    },
  };
}

async function listComplaints() {
  return complaintRepository.list();
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

async function getStats() {
  return complaintRepository.stats();
}

module.exports = { createComplaint, listComplaints, updateComplaintStatus, getStats };
const mongoose = require('mongoose');
const {
  COMPLAINT_CATEGORIES,
  SEVERITY_LEVELS,
  PRIORITY_LEVELS,
  COMPLAINT_STATUSES,
} = require('../config/constants');

const complaintSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: 'medium' },
    confidenceScore: { type: Number, default: 0, min: 0, max: 1 },
    images: [
      {
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        isResolutionImage: { type: Boolean, default: false },
      },
    ],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number],
    },
    locationSource: {
      type: String,
      enum: ['exif', 'device', 'pinned', 'geocode', 'not-provided'],
      default: 'not-provided',
    },
    address: { type: String, trim: true },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'Pending', index: true },
    resolvedAt: { type: Date },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    departmentName: { type: String, default: 'Unassigned' },
    priority: { type: String, enum: PRIORITY_LEVELS, default: 'medium', index: true },
    priorityReason: { type: String, default: '' },
    aiTimeline: [
      {
        step: { type: String, required: true },
        detail: { type: String, default: '' },
        ts: { type: Date, default: Date.now },
      },
    ],
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mergedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    supportScore: { type: Number, default: 1, min: 1 },
    ward: { type: String, default: 'Unassigned' },
  },
  { timestamps: true }
);

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
const mongoose = require('mongoose');
const { COMPLAINT_CATEGORIES } = require('../config/constants');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    categories: [{ type: String, enum: COMPLAINT_CATEGORIES }],
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
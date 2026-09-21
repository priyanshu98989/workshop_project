const complaintService = require('../services/complaintService');
const asyncHandler = require('../utils/asyncHandler');

exports.createComplaint = asyncHandler(async (req, res) => {
  const {
    longitude,
    latitude,
    imageBase64,
    mimeType,
    optionalNote,
    locationTrusted,
    locationSource,
  } = req.body;
  const result = await complaintService.createComplaint({
    userId: req.user.id,
    longitude,
    latitude,
    imageBase64,
    mimeType,
    optionalNote,
    locationTrusted,
    locationSource,
  });

  res.status(result.isDuplicate ? 200 : 201).json(result);
});

exports.getComplaints = asyncHandler(async (req, res) => {
  const complaints = await complaintService.listComplaints();
  res.json({ success: true, data: complaints });
});

exports.getStats = asyncHandler(async (req, res) => {
  const stats = await complaintService.getStats();
  res.json({ success: true, data: stats });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const complaint = await complaintService.updateComplaintStatus(
    req.params.id,
    req.body.status
  );
  res.json({ success: true, complaint });
});
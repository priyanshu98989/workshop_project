const express = require('express');
const complaintController = require('../controllers/complaintController');
const { complaint: validateComplaint } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, validateComplaint, complaintController.createComplaint);
router.get('/', complaintController.getComplaints);
router.get('/stats', complaintController.getStats);
router.patch('/:id', protect, complaintController.updateStatus);

module.exports = router;
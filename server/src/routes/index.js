const express = require('express');
const authRoutes = require('./auth.routes');
const complaintRoutes = require('./complaint.routes');
const assistantRoutes = require('./assistant.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    name: 'CivicEye 2.0 API',
    status: 'running',
    version: '2.0.0',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/complaints',
      'GET /api/complaints',
      'PATCH /api/complaints/:id',
      'POST /api/assistant/chat',
    ],
  });
});

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/assistant', assistantRoutes);

module.exports = router;
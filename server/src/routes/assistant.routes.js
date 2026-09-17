const express = require('express');
const assistantController = require('../controllers/assistantController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/chat', protect, assistantController.chat);

module.exports = router;
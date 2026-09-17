const express = require('express');
const { register: validateRegister, login: validateLogin } = require('../middleware/validation');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/me', protect, authController.me);

module.exports = router;
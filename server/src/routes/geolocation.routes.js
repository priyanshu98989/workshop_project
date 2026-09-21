const express = require('express');
const geolocationController = require('../controllers/geolocationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/place', protect, geolocationController.geocode);
router.post('/reverse', protect, geolocationController.reverseSearch);
router.post('/model', protect, geolocationController.imageLocation);

module.exports = router;
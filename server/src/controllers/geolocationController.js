const { geocodePlace, reverseSearchLandmark } = require('../services/geolocationService');
const { inferLocationFromImage } = require('../services/imageGeolocationService');
const asyncHandler = require('../utils/asyncHandler');

exports.geocode = asyncHandler(async (req, res) => {
  const { query } = req.query;
  const results = query ? await geocodePlace(query) : [];
  res.json({ success: true, data: results });
});

exports.reverseSearch = asyncHandler(async (req, res) => {
  const { imageDataUrl } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'imageDataUrl is required.' });
  }
  const result = await reverseSearchLandmark(imageDataUrl);
  res.json({ success: true, data: result });
});

exports.imageLocation = asyncHandler(async (req, res) => {
  const { imageDataUrl } = req.body || {};
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return res.status(400).json({ error: 'imageDataUrl is required.' });
  }
  // Model trace: location is inferred from the photo CONTENT only,
  // never from the device's current location.
  const result = await inferLocationFromImage({ imageDataUrl });
  res.json({ success: true, data: result });
});
const assistantService = require('../services/assistantService');
const asyncHandler = require('../utils/asyncHandler');

exports.chat = asyncHandler(async (req, res) => {
  const { message, imageBase64, mimeType, history } = req.body;
  const result = await assistantService.chat({
    userId: req.user.id,
    message,
    imageBase64,
    mimeType,
    history,
  });
  res.json(result);
});
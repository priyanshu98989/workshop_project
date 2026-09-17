const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

exports.register = asyncHandler(async (req, res) => {
  const { body } = req;
  const result = await authService.register(body);
  res.status(201).json(result);
});

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

exports.me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: { id: req.user.id, role: req.user.role } });
});
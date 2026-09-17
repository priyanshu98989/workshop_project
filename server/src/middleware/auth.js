const { verifyToken } = require('../services/authService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

exports.protect = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AppError('Authentication required. Please log in.', 401);
  }

  req.user = verifyToken(token);
  next();
});
const { USERNAME_PATTERN } = require('../config/constants');

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

exports.register = (req, res, next) => {
  const { name, email, password } = req.body || {};

  const errors = [];
  if (!isString(name) || name.trim().length < 2) {
    errors.push('"name" must be at least 2 characters.');
  }
  if (!isString(email) || !USERNAME_PATTERN.test(email)) {
    errors.push('A valid "email" is required.');
  }
  if (!isString(password) || password.length < 6) {
    errors.push('"password" must be at least 6 characters.');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  next();
};

exports.login = (req, res, next) => {
  const { email, password } = req.body || {};

  if (!isString(email) || !isString(password)) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: ['"email" and "password" are required.'],
    });
  }

  next();
};

exports.complaint = (req, res, next) => {
  const { longitude, latitude, imageBase64 } = req.body || {};

  const errors = [];
  if (longitude === undefined || latitude === undefined) {
    errors.push('GPS coordinates are required.');
  }
  if (!isString(imageBase64) || imageBase64.length < 100) {
    errors.push('A photo (base64) is required.');
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed.', details: errors });
  }

  next();
};
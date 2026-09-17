const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { hashPassword, verifyPassword } = require('../utils/password');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');
const { USER_ROLES } = require('../config/constants');

const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: TOKEN_TTL });
}

async function register({ name, email, password, role }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const user = await userRepository.create({
    name,
    email,
    password: hashPassword(password),
    role: USER_ROLES.includes(role) ? role : 'citizen',
  });

  return { token: signToken(user), user: userRepository.sanitize(user) };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid credentials.', 401);
  }

  const passwordOk = await verifyPassword(password, user.password);
  if (!passwordOk) {
    throw new AppError('Invalid credentials.', 401);
  }

  return { token: signToken(user), user: userRepository.sanitize(user) };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, jwtSecret);
    return { id: payload.id, role: payload.role };
  } catch (err) {
    throw new AppError('Invalid or expired token.', 401);
  }
}

module.exports = { register, login, verifyToken, signToken };
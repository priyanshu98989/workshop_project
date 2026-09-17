const { isMemoryMode } = require('../db/connect');
const memoryStore = require('../db/memoryStore');
const User = require('../models/User');

exports.findByEmail = async (email) => {
  if (isMemoryMode()) return memoryStore.findUserByEmail(email);
  return User.findOne({ email }).select('+password').lean();
};

exports.create = async (data) => {
  if (isMemoryMode()) return memoryStore.createUser(data);
  const user = await User.create(data);
  return user.toObject();
};

exports.sanitize = (user) => {
  if (isMemoryMode()) return memoryStore.publicUser(user);
  const { password, ...publicUser } = user;
  return publicUser;
};
const mongoose = require('mongoose');
const { mongodbUri } = require('../config/env');
const logger = require('../utils/logger');
const { ensureDepartments } = require('./seedDepartments');

const state = {
  isMemoryMode: false,
};

async function connectDatabase() {
  try {
    await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: true,
    });
    state.isMemoryMode = false;
    try {
      await ensureDepartments();
      logger.info('Departments ensured in DB');
    } catch (err) {
      logger.warn(`Department seeding failed: ${err.message}`);
    }
    logger.info('MongoDB connected');
  } catch (err) {
    state.isMemoryMode = true;
    logger.warn(`MongoDB not reachable (${err.message}). Running in-memory mode.`);
  }

  mongoose.connection.on('error', (err) => {
    state.isMemoryMode = true;
    logger.warn(`MongoDB connection error (${err.message}). Running in-memory mode.`);
  });

  mongoose.connection.on('disconnected', () => {
    if (mongoose.connection.readyState !== 0) return;
    state.isMemoryMode = true;
    logger.warn('MongoDB disconnected. Falling back to in-memory mode.');
  });

  return state;
}

function isMemoryMode() {
  return state.isMemoryMode;
}

module.exports = { connectDatabase, isMemoryMode };
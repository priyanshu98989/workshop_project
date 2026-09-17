const { createApp } = require('./app');
const { connectDatabase, isMemoryMode } = require('./db/connect');
const { port } = require('./config/env');
const logger = require('./utils/logger');

async function bootstrap() {
  await connectDatabase();

  const app = createApp();

  app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port} (${isMemoryMode() ? 'in-memory mode' : 'mongodb'})`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
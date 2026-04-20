import mongoose from 'mongoose';

const resolveTestMongoUri = (): string => {
  const configuredUri =
    process.env.MONGODB_TEST_URI?.trim() || process.env.TEST_MONGODB_URI?.trim();

  if (configuredUri) {
    return configuredUri;
  }

  const workerId = process.env.JEST_WORKER_ID?.trim();
  const databaseName = workerId
    ? `uptime-monitor-test-${workerId}`
    : 'uptime-monitor-test';

  return `mongodb://127.0.0.1:27017/${databaseName}`;
};

const testMongoUri = resolveTestMongoUri();

// Make the test environment deterministic before app modules are imported.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = process.env.JWT_SECRET?.trim() || 'test-secret';

// Before all tests, connect to the local MongoDB service used for integration tests.
beforeAll(async () => {
  await mongoose.connect(testMongoUri);
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase();
  }
}, 60000);

// After all tests, close the shared connection cleanly.
afterAll(async () => {
  await mongoose.disconnect();
}, 60000);

// Clear collections after each test so cases stay isolated.
afterEach(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Keep expected test failures out of the output noise.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const firstArg = args[0];
  if (typeof firstArg === 'string' && firstArg.includes?.('test')) {
    return;
  }
  originalConsoleError.apply(console, args as [string, ...unknown[]]);
};

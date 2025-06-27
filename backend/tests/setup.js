// Test setup file for Jest
// This file can be referenced in jest.config.js or package.json

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for all tests
jest.setTimeout(60000);

// Global test setup
beforeAll(async () => {
  // Any global setup needed
  console.log('Setting up test environment...');
});

// Global test teardown
afterAll(async () => {
  // Any global cleanup needed
  console.log('Cleaning up test environment...');
});

// Global beforeEach
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Global afterEach
afterEach(() => {
  // Any cleanup needed after each test
});

// Suppress console.log during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// }; 
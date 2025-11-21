// Jest setup file - runs before all tests
// Set environment to test mode
process.env.NODE_ENV = 'test';

// Set test environment variables to avoid warnings
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test_encryption_key_for_ci';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_ci';
process.env.GEMINI_API_KEYS = process.env.GEMINI_API_KEYS || 'test_gemini_api_key_for_ci';

// Suppress console logs during tests (optional, comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

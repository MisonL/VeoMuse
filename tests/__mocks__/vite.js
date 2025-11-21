// Mock for Vite module in Jest tests
// Vite is ESM-only and cannot be required by Jest in CommonJS mode
// This mock prevents the "Cannot use import statement outside a module" error

module.exports = {
  createServer: jest.fn().mockResolvedValue({
    middlewares: (req, res, next) => next(),
    close: jest.fn()
  }),
  build: jest.fn().mockResolvedValue({}),
  preview: jest.fn().mockResolvedValue({})
};

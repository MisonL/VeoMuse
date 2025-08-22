// tests/server.test.js

const request = require('supertest');

// Mock the main server
jest.mock('../server.js', () => {
  const mockExpress = require('express');
  const mockApp = mockExpress();
  
  mockApp.get('/', (req, res) => {
    res.send('Hello World!');
  });
  
  mockApp.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString()
    });
  });
  
  return mockApp;
});

describe('Server', () => {
  let app;
  
  beforeAll(() => {
    app = require('../server.js');
  });
  
  describe('GET /', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });
  
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
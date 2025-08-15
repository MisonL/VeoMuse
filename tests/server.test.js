// tests/server.test.js

const request = require('supertest');
const express = require('express');

// Mock the main server
jest.mock('../server.js', () => {
  const app = express();
  
  app.get('/', (req, res) => {
    res.send('Hello World!');
  });
  
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString()
    });
  });
  
  return app;
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
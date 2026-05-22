import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/server';
import User from '../../src/models/User';
import Monitor from '../../src/models/Monitor';

describe('Monitors API Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    const user = new User({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      role: 'admin',
    });
    await user.save();
    userId = user._id.toString();

    authToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/monitors', () => {
    it('returns an empty list when no monitors exist', async () => {
      const response = await request(app)
        .get('/api/monitors')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.monitors).toEqual([]);
    });

    it('returns monitors for the authenticated user', async () => {
      const monitor = new Monitor({
        name: 'Test Monitor',
        url: 'https://example.com',
        type: 'https',
        interval: 5,
        timeout: 30,
        status: 'up',
        owner: userId,
      });
      await monitor.save();

      const response = await request(app)
        .get('/api/monitors')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.monitors).toHaveLength(1);
      expect(response.body.monitors[0].name).toBe('Test Monitor');
    });

    it('returns 401 without authentication', async () => {
      const response = await request(app).get('/api/monitors');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/monitors', () => {
    it('creates a new monitor', async () => {
      const monitorData = {
        name: 'New Monitor',
        url: 'https://test.com',
        type: 'https',
        interval: 5,
        timeout: 30,
      };

      const response = await request(app)
        .post('/api/monitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(monitorData);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Monitor');
      expect(response.body.message).toContain('succ');
      expect(response.body.monitor.name).toBe('New Monitor');

      const monitorInDb = await Monitor.findOne({ name: 'New Monitor' });
      expect(monitorInDb).toBeTruthy();
      expect(monitorInDb?.owner.toString()).toBe(userId);
    });

    it('returns 400 with invalid data', async () => {
      const invalidData = {
        name: '',
        url: 'not-a-url',
        type: 'https',
      };

      const response = await request(app)
        .post('/api/monitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('returns 401 without authentication', async () => {
      const monitorData = {
        name: 'New Monitor',
        url: 'https://test.com',
        type: 'https',
      };

      const response = await request(app).post('/api/monitors').send(monitorData);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/monitors/:id', () => {
    it('updates an existing monitor', async () => {
      const monitor = new Monitor({
        name: 'Old Name',
        url: 'https://example.com',
        type: 'https',
        interval: 5,
        timeout: 30,
        status: 'up',
        owner: userId,
      });
      await monitor.save();

      const updateData = {
        name: 'Updated Name',
        interval: 10,
      };

      const response = await request(app)
        .put(`/api/monitors/${monitor._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.monitor.name).toBe('Updated Name');
      expect(response.body.monitor.interval).toBe(10);
    });

    it('returns 404 for a non-existent monitor', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { name: 'Updated Name' };

      const response = await request(app)
        .put(`/api/monitors/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/monitors/:id', () => {
    it('deletes an existing monitor', async () => {
      const monitor = new Monitor({
        name: 'To Delete',
        url: 'https://example.com',
        type: 'https',
        interval: 5,
        timeout: 30,
        status: 'up',
        owner: userId,
      });
      await monitor.save();

      const response = await request(app)
        .delete(`/api/monitors/${monitor._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toMatch(/supprim/i);

      const monitorInDb = await Monitor.findById(monitor._id);
      expect(monitorInDb).toBeNull();
    });

    it('returns 404 for a non-existent monitor', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/monitors/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});

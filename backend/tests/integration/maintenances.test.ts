import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/server';
import Maintenance from '../../src/models/Maintenance';
import Monitor from '../../src/models/Monitor';
import User from '../../src/models/User';

describe('Maintenances API Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    const user = new User({
      email: 'planner@example.com',
      password: 'password123',
      name: 'Planner User',
      role: 'user',
    });
    await user.save();
    userId = user._id.toString();

    authToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );
  });

  describe('POST /api/maintenances', () => {
    it('creates a maintenance for a shared monitor', async () => {
      const owner = new User({
        email: 'owner@example.com',
        password: 'password123',
        name: 'Owner User',
        role: 'user',
      });
      await owner.save();

      const monitor = new Monitor({
        name: 'Shared Monitor',
        url: 'https://example.com',
        type: 'https',
        interval: 5,
        timeout: 30,
        status: 'up',
        owner: owner._id,
        sharedWith: [userId],
      });
      await monitor.save();

      const startAt = new Date(Date.now() + 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/maintenances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monitorId: monitor._id.toString(),
          name: 'Planned maintenance',
          reason: 'Routine work',
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('succ');
      expect(response.body.maintenance.name).toBe('Planned maintenance');
      expect(response.body.maintenance.monitor._id || response.body.maintenance.monitor).toBeDefined();

      const maintenanceInDb = await Maintenance.findOne({
        monitor: monitor._id,
        owner: userId,
      }).populate('monitor', 'name url type status');

      expect(maintenanceInDb).toBeTruthy();
      expect(maintenanceInDb?.reason).toBe('Routine work');
      expect(maintenanceInDb?.status).toBe('scheduled');
    });

    it('returns 404 when the monitor is not accessible', async () => {
      const owner = new User({
        email: 'private-owner@example.com',
        password: 'password123',
        name: 'Private Owner',
        role: 'user',
      });
      await owner.save();

      const monitor = new Monitor({
        name: 'Private Monitor',
        url: 'https://private.example.com',
        type: 'https',
        interval: 5,
        timeout: 30,
        status: 'up',
        owner: owner._id,
      });
      await monitor.save();

      const startAt = new Date(Date.now() + 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/maintenances')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          monitorId: monitor._id.toString(),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/autoris|propri/i);
    });
  });
});

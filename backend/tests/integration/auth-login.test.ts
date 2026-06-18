jest.mock('../../src/services/emailService', () => ({
  __esModule: true,
  default: {
    sendLoginOtpCode: jest.fn().mockResolvedValue(undefined),
  },
}));

import request from 'supertest';
import app from '../../src/server';
import Utilisateur from '../../src/models/Utilisateur';
import emailService from '../../src/services/emailService';

describe('Auth login', () => {
  beforeEach(async () => {
    const user = await new Utilisateur({
      email: 'casesensitive@example.com',
      password: 'Password123!',
      name: 'Case Sensitive',
      role: 'user',
    }).save();

    await Utilisateur.collection.updateOne(
      { _id: user._id },
      { $set: { email: 'CASESENSITIVE@EXAMPLE.COM' } },
    );
  });

  it('allows login when the stored email casing differs from the submitted email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'casesensitive@example.com',
        password: 'Password123!',
        rememberMe: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.requiresOtp).toBe(true);
    expect(response.body.email).toBe('CASESENSITIVE@EXAMPLE.COM');
    expect(
      (emailService as unknown as { sendLoginOtpCode: jest.Mock })
        .sendLoginOtpCode,
    ).toHaveBeenCalledWith(
      'CASESENSITIVE@EXAMPLE.COM',
      expect.any(String),
      'Case Sensitive',
    );
  });
});

import { MonitorService } from '../../src/services/monitorService';
import Monitor, { IMonitor } from '../../src/models/Monitor';
import mongoose from 'mongoose';
import dns from 'dns';

const monitorService = new MonitorService();

jest.mock('axios', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    isAxiosError: jest.fn((error: unknown) =>
      Boolean((error as { isAxiosError?: boolean } | undefined)?.isAxiosError)
    ),
  }),
  isAxiosError: jest.fn((error: unknown) =>
    Boolean((error as { isAxiosError?: boolean } | undefined)?.isAxiosError)
  ),
}));

const mockedAxios = jest.requireMock('axios').default as jest.Mock & {
  isAxiosError: jest.Mock;
};

describe('MonitorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkMonitor', () => {
    describe('HTTP/HTTPS Monitoring', () => {
      it('should return UP when HTTP status code is 200', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: 'OK',
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('up');
        expect(result.statusCode).toBe(200);
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
        expect(result.errorMessage).toBeUndefined();
      });

      it('should return DOWN when HTTP status code is 500', async () => {
        // Arrange
        const mockResponse = {
          status: 500,
          data: 'Server Error',
        };
        mockedAxios.mockResolvedValue(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('down');
        expect(result.statusCode).toBe(500);
        expect(result.errorMessage).toContain('Code HTTP attendu');
      });

      it('should return UP when response validation matches (case insensitive)', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { status: 'ok' },
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
          responseValidation: {
            field: 'status',
            mode: 'value',
            expectedValue: 'OK', // Test case insensitivity
          },
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('up');
        expect(result.statusCode).toBe(200);
      });

      it('should return DOWN when response validation fails', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { status: 'error' },
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
          responseValidation: {
            field: 'status',
            mode: 'value',
            expectedValue: 'ok',
          },
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('down');
        expect(result.errorMessage).toContain('Validation echouee');
        expect(result.errorMessage).toContain('error');
        expect(result.errorMessage).toContain('ok');
      });

      it('should handle network errors', async () => {
        // Arrange
        const error = new Error('Network Error');
        mockedAxios.mockRejectedValue(error);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('down');
        expect(result.errorMessage).toContain('Network Error');
      });

      it('should return UP for 3xx redirects when allowed', async () => {
        // Arrange
        const mockResponse = {
          status: 301,
          data: '',
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
          upStatusCodeGroups: ['2xx', '3xx'], // Allow 3xx
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('up');
        expect(result.statusCode).toBe(301);
      });

      it('should return an address array when the lookup caller requests all addresses', async () => {
        // Arrange
        const lookupSpy = jest.spyOn(dns as any, 'lookup').mockImplementation(
          (...args: any[]) => {
            const [, options, callback] = args;
            if (options?.all) {
              callback(null, [{ address: '1.1.1.1', family: 4 }]);
              return;
            }

            callback(null, '1.1.1.1', 4);
          }
        );

        let capturedConfig: Record<string, any> | null = null;
        mockedAxios.mockImplementationOnce(async (config: Record<string, any>) => {
          capturedConfig = config;
          return {
            status: 200,
            data: 'OK',
          };
        });

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
        }) as IMonitor;

        // Act
        try {
          const result = await monitorService.checkMonitor(monitor);

          // Assert
          expect(result.status).toBe('up');
          expect(capturedConfig).not.toBeNull();

          const lookup = capturedConfig!.httpsAgent.options.lookup as (
            hostname: string,
            options: { all?: boolean; family?: number; hints?: number },
            callback: (
              error: NodeJS.ErrnoException | null,
              addresses?: Array<{ address: string; family: number }>,
              family?: number
            ) => void
          ) => void;

          await new Promise<void>((resolve, reject) => {
            lookup('example.com', { all: true, hints: 0 }, (error, addresses) => {
              try {
                expect(error).toBeNull();
                expect(Array.isArray(addresses)).toBe(true);
                expect(addresses).toEqual([{ address: '1.1.1.1', family: 4 }]);
                resolve();
              } catch (assertionError) {
                reject(assertionError);
              }
            });
          });
        } finally {
          lookupSpy.mockRestore();
        }
      });
    });

    describe('Response Validation Types', () => {
      it('should validate boolean type correctly', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { status: true },
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
          responseValidation: {
            field: 'status',
            mode: 'type',
            expectedType: 'boolean',
          },
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('up');
      });

      it('should return DOWN when boolean type validation fails', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { status: 'not-a-boolean' },
        };
        mockedAxios.mockResolvedValueOnce(mockResponse);

        const monitor = new Monitor({
          _id: new mongoose.Types.ObjectId(),
          name: 'Test Monitor',
          url: 'https://example.com',
          type: 'https',
          httpMethod: 'GET',
          expectedStatusCode: 200,
          timeout: 30,
          interval: 5,
          status: 'pending',
          owner: new mongoose.Types.ObjectId(),
          responseValidation: {
            field: 'status',
            mode: 'type',
            expectedType: 'boolean',
          },
        }) as IMonitor;

        // Act
        const result = await monitorService.checkMonitor(monitor);

        // Assert
        expect(result.status).toBe('down');
        expect(result.errorMessage).toContain('boolean');
      });
    });
  });
});

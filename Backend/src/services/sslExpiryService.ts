import tls from 'tls';

const SSL_TIMEOUT_MS = 10000;

export interface SslExpiryLookupResult {
  hostname: string;
  expiryAt: Date | null;
  checkedAt: Date;
  error?: string;
}

const parseExpiryDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
};

export const lookupSslExpiry = async (url: string): Promise<SslExpiryLookupResult> => {
  const checkedAt = new Date();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      hostname: '',
      expiryAt: null,
      checkedAt,
      error: 'Invalid URL',
    };
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'wss:') {
    return {
      hostname: parsedUrl.hostname,
      expiryAt: null,
      checkedAt,
      error: 'SSL check only applies to HTTPS/WSS',
    };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 443;

  return new Promise((resolve) => {
    let settled = false;
    const finalize = (result: SslExpiryLookupResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = typeof cert.valid_to === 'string' ? cert.valid_to : '';
        const expiryAt = parseExpiryDate(validTo);

        finalize({
          hostname,
          expiryAt,
          checkedAt,
          error: expiryAt ? undefined : 'Certificate expiry not found',
        });
        socket.end();
      }
    );

    socket.setTimeout(SSL_TIMEOUT_MS, () => {
      socket.destroy();
      finalize({
        hostname,
        expiryAt: null,
        checkedAt,
        error: 'SSL lookup timeout',
      });
    });

    socket.on('error', (error) => {
      finalize({
        hostname,
        expiryAt: null,
        checkedAt,
        error: error instanceof Error ? error.message : 'SSL lookup failed',
      });
    });
  });
};

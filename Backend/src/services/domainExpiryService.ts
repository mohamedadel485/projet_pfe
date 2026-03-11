import { isIP } from 'net';
import whoiser from 'whoiser';

const WHOIS_FOLLOW = 2;
const WHOIS_TIMEOUT_MS = 10000;

const EXPIRY_KEYS = new Set([
  'registry expiry date',
  'registry expiration date',
  'registrar registration expiration date',
  'registrar registration expiry date',
  'expiration date',
  'expiry date',
  'paid-till',
  'paid till',
  'renewal date',
  'domain expiration date',
  'domain expiry date',
]);

export interface DomainExpiryLookupResult {
  domain: string;
  expiryAt: Date | null;
  checkedAt: Date;
  error?: string;
}

const normalizeHost = (hostname: string): string | null => {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!trimmed || isIP(trimmed)) {
    return null;
  }
  return trimmed;
};

const buildCandidateDomains = (hostname: string): string[] => {
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return [hostname];
  }

  const candidates = [hostname];

  if (labels.length >= 2) {
    candidates.push(labels.slice(-2).join('.'));
  }
  if (labels.length >= 3) {
    candidates.push(labels.slice(-3).join('.'));
  }

  return Array.from(new Set(candidates));
};

const parseDateFromString = (value: string): Date | null => {
  const cleaned = value.trim();
  if (cleaned === '') return null;

  const direct = Date.parse(cleaned);
  if (!Number.isNaN(direct)) return new Date(direct);

  const normalized = cleaned
    .replace(/\(.*\)$/g, '')
    .replace(/(\d{4})\.(\d{2})\.(\d{2})/g, '$1-$2-$3')
    .replace(/\s+/, 'T');

  const normalizedWithZone =
    /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;

  const parsed = Date.parse(normalizedWithZone);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  const slashNormalized = normalizedWithZone.replace(/\//g, '-');
  const parsedSlash = Date.parse(slashNormalized);
  if (!Number.isNaN(parsedSlash)) return new Date(parsedSlash);

  return null;
};

const extractDatesFromRecord = (record: Record<string, unknown>): Date[] => {
  const dates: Date[] = [];

  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = rawKey.trim().toLowerCase();
    const shouldCheckKey = EXPIRY_KEYS.has(key) || key.includes('expir');
    if (!shouldCheckKey) continue;

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value === 'string') {
        const parsed = parseDateFromString(value);
        if (parsed) dates.push(parsed);
      }
    }
  }

  if (typeof record.__raw === 'string') {
    const rawText = record.__raw;
    const regex =
      /(Registry Expiry Date|Registrar Registration Expiration Date|Registrar Registration Expiry Date|Expiration Date|Expiry Date|paid-till|paid till|Renewal Date|Domain Expiration Date|Domain Expiry Date)\s*[:=]\s*(.+)/gi;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(rawText)) !== null) {
      const parsed = parseDateFromString(match[2] ?? '');
      if (parsed) dates.push(parsed);
    }
  }

  return dates;
};

const collectRecords = (data: unknown): Record<string, unknown>[] => {
  if (!data || typeof data !== 'object') return [];

  const records: Record<string, unknown>[] = [];

  const pushRecord = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushRecord(entry));
      return;
    }
    if (typeof value === 'string') {
      records.push({ __raw: value });
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record.data) {
        pushRecord(record.data);
      }
      if (record.text && typeof record.text === 'string') {
        records.push({ __raw: record.text });
      }
      records.push(record);
    }
  };

  Object.values(data).forEach((value) => pushRecord(value));
  return records;
};

const extractExpiryDate = (whoisData: unknown): Date | null => {
  const records = collectRecords(whoisData);
  const dates = records.flatMap((record) => extractDatesFromRecord(record));
  if (dates.length === 0) return null;
  return dates.reduce((latest, current) => (current > latest ? current : latest));
};

export const lookupDomainExpiry = async (url: string): Promise<DomainExpiryLookupResult> => {
  const checkedAt = new Date();

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return {
      domain: '',
      expiryAt: null,
      checkedAt,
      error: 'Invalid URL',
    };
  }

  const normalizedHost = normalizeHost(hostname);
  if (!normalizedHost) {
    return {
      domain: '',
      expiryAt: null,
      checkedAt,
      error: 'Domain not eligible for WHOIS lookup',
    };
  }

  const candidateDomains = buildCandidateDomains(normalizedHost);
  let lastError: string | undefined;

  for (const domain of candidateDomains) {
    try {
      const whoisData = await whoiser(domain, { follow: WHOIS_FOLLOW, timeout: WHOIS_TIMEOUT_MS });
      const expiryAt = extractExpiryDate(whoisData);
      if (expiryAt) {
        return { domain, expiryAt, checkedAt };
      }
      lastError = 'Expiry date not found in WHOIS response';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'WHOIS lookup failed';
    }
  }

  return {
    domain: candidateDomains[0] ?? '',
    expiryAt: null,
    checkedAt,
    error: lastError ?? 'WHOIS lookup failed',
  };
};

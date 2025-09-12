/**
 * @jest-environment node
 */
import CryptoJS from 'crypto-js';
import { syncAll } from '../sync';

// Mocks
jest.mock('../connections', () => ({
  getConnections: jest.fn()
}));
jest.mock('../settings', () => ({
  getAllSettings: jest.fn()
}));
jest.mock('../httpRequest', () => ({
  httpRequest: jest.fn()
}));

import { getConnections } from '../connections';
import { getAllSettings } from '../settings';
import { httpRequest } from '../httpRequest';

const mockGetConnections = getConnections as jest.MockedFunction<typeof getConnections>;
const mockGetAllSettings = getAllSettings as jest.MockedFunction<typeof getAllSettings>;
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

// Helper to encrypt passwords like production
const key = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || 'adguard-buddy-key';
const enc = (plain: string) => CryptoJS.AES.encrypt(plain, key).toString();

describe('syncAll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('logs no replicas found when only master present', async () => {
    mockGetConnections.mockResolvedValue({
      connections: [
        { ip: '10.0.0.1', port: 80, username: 'u', password: enc('p') }
      ],
      masterServerIp: '10.0.0.1'
    });
    const logs: string[] = [];
    await syncAll(msg => { logs.push(msg); return Promise.resolve(); });
    expect(logs.some(l => l.includes('No replica servers found'))).toBe(true);
  });

  it('selects both URL and IP replicas and syncs changed category', async () => {
    mockGetConnections.mockResolvedValue({
      connections: [
        { ip: '10.0.0.1', port: 80, username: 'u', password: enc('p') }, // master
        { url: 'https://node.example.com', port: 443, username: 'u', password: enc('p') }, // url replica
        { ip: '10.0.0.2', port: 80, username: 'u', password: enc('p') }, // ip replica
      ],
      masterServerIp: '10.0.0.1'
    });

    // Master settings vs replicas: filtering differs (enabled flag)
    const masterSettings = { filtering: { enabled: true, interval: 30, user_rules: [], filters: [], whitelist_filters: [] }, querylogConfig: {}, statsConfig: {}, rewrites: [], blockedServices: [], accessList: { allowed_clients: [], disallowed_clients: [] } };
    const replicaSettingsChanged = { filtering: { enabled: false, interval: 30, user_rules: [], filters: [], whitelist_filters: [] }, querylogConfig: {}, statsConfig: {}, rewrites: [], blockedServices: [], accessList: { allowed_clients: [], disallowed_clients: [] } };

    mockGetAllSettings.mockImplementation(async (conn: any) => {
      if (conn.ip === '10.0.0.1') return { settings: masterSettings, errors: {} };
      return { settings: replicaSettingsChanged, errors: {} };
    });

    // httpRequest mock to satisfy doSync network calls.
    mockHttpRequest.mockImplementation(async ({ url }) => {
      // Provide dynamic responses for filtering/status
      if (url.includes('filtering/status')) {
        const isMaster = url.includes('10.0.0.1');
        return { statusCode: 200, headers: {}, body: JSON.stringify(isMaster ? masterSettings.filtering : replicaSettingsChanged.filtering) };
      }
      // All write operations succeed
      return { statusCode: 200, headers: {}, body: '' };
    });

    const logs: string[] = [];
    await syncAll(msg => { logs.push(msg); return Promise.resolve(); });

    // Replica block delimiters
    const replicaStartLines = logs.filter(l => l.includes('Replica 1/2 START') || l.includes('Replica 2/2 START'));
    expect(replicaStartLines.length).toBe(2);
    // Category success lines
    const successLines = logs.filter(l => /SUCCESS in \d+ms/.test(l));
    expect(successLines.length).toBeGreaterThanOrEqual(2); // at least one per replica for filtering
    // Ensure run id prefix present
    expect(logs.some(l => /\[run:/.test(l))).toBe(true);
  });
});

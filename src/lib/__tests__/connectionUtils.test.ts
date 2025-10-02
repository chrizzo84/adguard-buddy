import { getConnectionId, findConnectionById, getConnectionDisplayName, type Connection } from '../connectionUtils';

describe('connectionUtils', () => {
  describe('getConnectionId', () => {
    it('should return URL without trailing slash for URL-based connections', () => {
      const conn: Connection = {
        url: 'http://adguard.local/',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('http://adguard.local');
    });

    it('should return URL as-is if no trailing slash', () => {
      const conn: Connection = {
        url: 'https://adguard.example.com',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('https://adguard.example.com');
    });

    it('should return IP:port for IP-based connections with port', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1:80');
    });

    it('should return IP only when port is not specified', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1');
    });

    it('should prefer URL over IP when both are present', () => {
      const conn: Connection = {
        url: 'http://adguard.local',
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('http://adguard.local');
    });

    it('should return empty string when neither URL nor IP is present', () => {
      const conn: Connection = {
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('');
    });

    it('should handle port 0', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        port: 0,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1');
    });

    it('should handle empty URL string', () => {
      const conn: Connection = {
        url: '',
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1:80');
    });
  });

  describe('findConnectionById', () => {
    const connections: Connection[] = [
      {
        ip: '192.168.1.1',
        port: 80,
        username: 'admin1',
        password: 'pass1',
      },
      {
        url: 'http://adguard.local',
        username: 'admin2',
        password: 'pass2',
      },
      {
        ip: '192.168.1.2',
        port: 3000,
        username: 'admin3',
        password: 'pass3',
      },
    ];

    it('should find connection by IP:port', () => {
      const result = findConnectionById(connections, '192.168.1.1:80');
      expect(result).toBeDefined();
      expect(result?.username).toBe('admin1');
    });

    it('should find connection by URL', () => {
      const result = findConnectionById(connections, 'http://adguard.local');
      expect(result).toBeDefined();
      expect(result?.username).toBe('admin2');
    });

    it('should return undefined when connection not found', () => {
      const result = findConnectionById(connections, '192.168.1.99:80');
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = findConnectionById([], '192.168.1.1:80');
      expect(result).toBeUndefined();
    });

    it('should match exact format', () => {
      // Should NOT match if format differs
      const result = findConnectionById(connections, '192.168.1.1'); // Without port
      expect(result).toBeUndefined();
    });
  });

  describe('getConnectionDisplayName', () => {
    it('should return URL for URL-based connections', () => {
      const conn: Connection = {
        url: 'http://adguard.local',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionDisplayName(conn)).toBe('http://adguard.local');
    });

    it('should return IP:port for IP connections with port', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionDisplayName(conn)).toBe('192.168.1.1:80');
    });

    it('should return IP only when port not specified', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionDisplayName(conn)).toBe('192.168.1.1');
    });

    it('should return "unknown" when no identifier present', () => {
      const conn: Connection = {
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionDisplayName(conn)).toBe('unknown');
    });

    it('should prefer URL over IP', () => {
      const conn: Connection = {
        url: 'http://adguard.local',
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionDisplayName(conn)).toBe('http://adguard.local');
    });
  });

  describe('Connection type compatibility', () => {
    it('should work with all optional fields', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'pass',
        allowInsecure: true,
        color: '#ff0000',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1:80');
    });

    it('should work with minimal required fields', () => {
      const conn: Connection = {
        ip: '192.168.1.1',
        username: 'admin',
        password: 'pass',
      };
      expect(getConnectionId(conn)).toBe('192.168.1.1');
    });
  });
});

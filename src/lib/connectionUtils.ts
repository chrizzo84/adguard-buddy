/**
 * Connection utilities for AdGuard Buddy
 * 
 * Provides consistent connection identification across the application.
 * This ensures that connections are matched correctly whether they use
 * IP addresses with ports or full URLs.
 */

export type Connection = {
  ip?: string;
  url?: string;
  port?: number;
  username: string;
  password: string;
  allowInsecure?: boolean;
  color?: string;
};

/**
 * Generates a consistent, normalized identifier for a connection.
 * 
 * The identifier format is:
 * - For URL-based connections: The URL without trailing slash (e.g., "http://adguard.local")
 * - For IP-based connections: IP with port if specified (e.g., "192.168.1.1:80" or "192.168.1.1")
 * 
 * This function is used across the application to ensure consistent connection matching
 * in settings, sync status, auto-sync scheduler, and API routes.
 * 
 * @param conn - The connection object
 * @returns A normalized connection identifier string
 * 
 * @example
 * // URL-based connection
 * getConnectionId({ url: "http://adguard.local/", username: "admin", password: "..." })
 * // Returns: "http://adguard.local"
 * 
 * @example
 * // IP with port
 * getConnectionId({ ip: "192.168.1.1", port: 80, username: "admin", password: "..." })
 * // Returns: "192.168.1.1:80"
 * 
 * @example
 * // IP without port
 * getConnectionId({ ip: "192.168.1.1", username: "admin", password: "..." })
 * // Returns: "192.168.1.1"
 */
export function getConnectionId(conn: Connection): string {
  // Prefer URL over IP if both are present
  if (conn.url && conn.url.length > 0) {
    // Remove trailing slash for consistency
    return conn.url.replace(/\/$/, '');
  }
  
  // Use IP with optional port
  if (conn.ip) {
    return conn.port ? `${conn.ip}:${conn.port}` : conn.ip;
  }
  
  // No valid identifier found
  return '';
}

/**
 * Finds a connection in an array by its normalized ID.
 * 
 * @param connections - Array of connections to search
 * @param connectionId - The normalized connection ID to find
 * @returns The matching connection or undefined
 * 
 * @example
 * const connections = [{ ip: "192.168.1.1", port: 80, ... }];
 * const conn = findConnectionById(connections, "192.168.1.1:80");
 */
export function findConnectionById(
  connections: Connection[],
  connectionId: string
): Connection | undefined {
  return connections.find(conn => getConnectionId(conn) === connectionId);
}

/**
 * Gets a display name for a connection.
 * Uses the URL if available, otherwise formats IP:port.
 * 
 * @param conn - The connection object
 * @returns A human-readable connection name
 * 
 * @example
 * getConnectionDisplayName({ url: "http://adguard.local", ... })
 * // Returns: "http://adguard.local"
 * 
 * @example
 * getConnectionDisplayName({ ip: "192.168.1.1", port: 80, ... })
 * // Returns: "192.168.1.1:80"
 */
export function getConnectionDisplayName(conn: Connection): string {
  if (conn.url && conn.url.length > 0) {
    return conn.url;
  }
  if (conn.ip) {
    return conn.port ? `${conn.ip}:${conn.port}` : conn.ip;
  }
  return 'unknown';
}

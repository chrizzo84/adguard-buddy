"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { components } from "../../types/adguard";

type Connection = {
  ip: string;
  username: string;
  password: string;
  url?: string;
  port?: number;
  allowInsecure?: boolean;
};

type AdGuardServerStatus = components['schemas']['ServerStatus'];
type AdGuardStats = components['schemas']['Stats'];

type Result = Connection & {
  status: string;
  response: string; // This is a JSON string of AdGuardServerStatus
  code?: number;
  stats?: AdGuardStats | null;
};

type CheckAdguardResponse = {
    status: string;
    response: string;
    code?: number;
    stats: AdGuardStats | null;
}

export default function Dashboard() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingIp, setUpdatingIp] = useState<string | null>(null);
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const toggleProtection = async (connection: Connection, enabled: boolean) => {
  const id = connection.url && connection.url.length > 0 ? connection.url.replace(/\/$/, '') : `${connection.ip}${connection.port ? ':'+connection.port : ''}`;
  setUpdatingIp(id);
    setError(null);
    try {
      let decrypted = "";
      try {
        decrypted = CryptoJS.AES.decrypt(connection.password, encryptionKey).toString(CryptoJS.enc.Utf8);
      } catch {
        decrypted = "";
      }

      const response = await fetch('/api/adguard-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...connection,
          password: decrypted,
          protection_enabled: enabled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
  setError(`Error toggling protection for ${connection.url || connection.ip}: ${errorData.message || 'Unknown error'}`);
        return;
      }

      await fetchAll();

    } catch (err) {
      setError(`A network error occurred while toggling protection.`);
      console.error(err);
    } finally {
  setUpdatingIp(null);
    }
  };

  const toggleAllProtection = async (enabled: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      const togglePromises = connections.map(conn => {
        let decrypted = "";
        try {
          decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
        } catch {
          decrypted = "";
        }

  return fetch('/api/adguard-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...conn,
            password: decrypted,
            protection_enabled: enabled,
          }),
        });
      });

      const responses = await Promise.all(togglePromises);

      const failedResponses = responses.filter(res => !res.ok);
      if (failedResponses.length > 0) {
        setError(`Failed to toggle protection for ${failedResponses.length} servers.`);
      }

    } catch (err) {
      setError(`A network error occurred during a global toggle action.`);
      console.error(err);
    } finally {
      await fetchAll();
    }
  };

  useEffect(() => {
    const fetchConnections = async () => {
        try {
          const response = await fetch('/api/get-connections');
          if (!response.ok) {
            throw new Error('Failed to fetch connections.');
          }
          const data = await response.json();
          const conns = data.connections || [];
          setConnections(conns);
          if (conns.length === 0) {
            setIsLoading(false);
          }
        } catch (error) {
          const err = error as Error;
          setError(`Error fetching connections: ${err.message}`);
          setIsLoading(false);
        }
    };
    fetchConnections();
  }, []);

  const fetchAll = useCallback(async () => {
    if (connections.length === 0) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await Promise.all(
  connections.map(async (conn): Promise<Result> => {
          let decrypted = "";
          try {
            decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
          } catch {
            decrypted = "";
          }
          const r = await fetch("/api/check-adguard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...conn, password: decrypted }),
          });
          if (!r.ok) {
            const errorText = await r.text();
            return { ...conn, status: "error", response: `Server Error: ${r.status} ${errorText}`, code: r.status, stats: null };
          }
          
          const data = await r.json() as CheckAdguardResponse;
          return { ...conn, ...data };
        })
      );
      setResults(res);
    } catch (err: unknown) {
      setError("A network error occurred while fetching statuses.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [connections, encryptionKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Helper function for the status card
  function AdGuardStatusCard({ data }: { data: AdGuardServerStatus }) {
    return (
      <div className="adguard-card">
        <h2 className="card-title">AdGuard Status</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500">Version:</div>
          <div className="text-primary">{data.version || "-"}</div>
          <div className="text-gray-500">Language:</div>
          <div className="text-primary">{data.language || "-"}</div>
          <div className="text-gray-500">DNS Port:</div>
          <div className="text-primary">{data.dns_port || "-"}</div>
          <div className="text-gray-500">HTTP Port:</div>
          <div className="text-primary">{data.http_port || "-"}</div>
          <div className="text-gray-500">Protection:</div>
          <div className={data.protection_enabled ? "text-primary" : "text-danger"}>{data.protection_enabled ? "Active" : "Disabled"}</div>
          <div className="text-gray-500">DHCP:</div>
          <div className={data.dhcp_available ? "text-primary" : "text-danger"}>{data.dhcp_available ? "Available" : "Not Available"}</div>
          <div className="text-gray-500">Running:</div>
          <div className={data.running ? "text-primary" : "text-danger"}>{data.running ? "Yes" : "No"}</div>
        </div>
        <div className="mt-4">
          <div className="text-gray-500 mb-1">DNS Addresses:</div>
          <div className="flex flex-wrap gap-2">
            {Array.isArray(data.dns_addresses)
              ? data.dns_addresses.map((addr, i) => (
                  <span key={i} className="bg-gray-800 text-primary px-2 py-1 rounded text-xs font-mono border border-neon">{addr}</span>
                ))
              : <span className="text-gray-400">-</span>}
          </div>
        </div>
      </div>
    );
  }

  // Helper function for the stats card
  function AdGuardStatsCard({ stats }: { stats: AdGuardStats }) {
    if (!stats) return null;

    const statItems = [
      { key: 'num_dns_queries', label: 'DNS queries' },
      { key: 'num_blocked_filtering', label: 'Blocked' },
      { key: 'num_replaced_safebrowsing', label: 'Blocked Malware' },
      { key: 'num_replaced_parental', label: 'Block parental' },
    ] as const;

    return (
      <div className="adguard-card mt-4">
        <h2 className="card-title">AdGuard Statistics</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {statItems.map(({ key, label }) => (
            <div key={key} className="contents">
              <div className="text-gray-500">{label}</div>
              <div className="text-primary break-all">
                {stats[key] ? stats[key]!.toLocaleString() : '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8 dashboard-bg rounded-xl shadow-xl">
      <NavMenu />
      <h1 className="text-3xl font-extrabold mb-4 text-center dashboard-title">Dashboard</h1>

      <div className="flex justify-center flex-wrap gap-4 mb-8">
        <button
          onClick={fetchAll}
          className="px-4 py-2 font-bold text-primary bg-gray-800 rounded-lg border-neon border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        <button
          onClick={() => toggleAllProtection(true)}
          className="px-4 py-2 font-bold text-primary bg-gray-800 rounded-lg border-neon border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50"
          disabled={isLoading || connections.length === 0}
        >
          Enable All
        </button>
        <button
          onClick={() => toggleAllProtection(false)}
          className="px-4 py-2 font-bold text-danger bg-gray-800 rounded-lg border-danger border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50"
          disabled={isLoading || connections.length === 0}
        >
          Disable All
        </button>
      </div>

      {isLoading && <p className="text-primary text-center">Loading connection statuses...</p>}
      {error && <p className="text-danger p-3 rounded-md bg-danger-dark">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {!isLoading && !error && results.map((res, idx) => {
          let parsed: AdGuardServerStatus | null = null;
          try {
            parsed = JSON.parse(res.response);
          } catch {
            parsed = null;
          }
          const connId = res.url && res.url.length > 0 ? res.url.replace(/\/$/, '') : `${res.ip}${res.port ? ':'+res.port : ''}`;
          return (
              <div key={`${connId}-${idx}`}>
                <div className="adguard-card mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-primary text-lg truncate block max-w-full">{connId}</span>
                    </div>
                    <span className={`${res.status === "connected" ? "text-primary font-bold" : "text-danger font-bold"} flex-shrink-0 ml-4`}>{res.status}</span>
                  </div>
                <div className="flex items-center gap-4 mb-2">
                  <span className="text-xs text-gray-500">User:</span>
                  <span className="text-primary font-mono">{res.username}</span>
                </div>
                {parsed ? (
                  <AdGuardStatusCard data={parsed} />
                ) : (
                  <pre className="text-xs bg-gray-800 rounded p-3 overflow-x-auto max-h-40 whitespace-pre-wrap text-primary border border-neon">
                    {res.response}
                  </pre>
                )}
                {res.stats && <AdGuardStatsCard stats={res.stats} />}
                {res.code && (
                  <div className="mt-2 text-right text-xs text-gray-500">HTTP: {res.code}</div>
                )}

                {parsed && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
                        <button
                            onClick={() => toggleProtection(res, !parsed.protection_enabled)}
                            className={`px-3 py-1 text-sm font-bold bg-gray-800 rounded-lg border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50
                                ${parsed.protection_enabled
                                    ? 'text-danger border-danger'
                                    : 'text-primary border-neon'
                                }
                            `}
              disabled={isLoading || updatingIp === connId}
                        >
                            {updatingIp === res.ip
                ? 'Updating...'
                : (parsed.protection_enabled ? 'Disable Protection' : 'Enable Protection')
                            }
                        </button>
                    </div>
                )}
              </div>
            </div>
          );
        })}
        {!isLoading && !error && connections.length === 0 && <div className="text-gray-500 dark:text-gray-400">No connections configured.</div>}
      </div>
    </div>
  );
}
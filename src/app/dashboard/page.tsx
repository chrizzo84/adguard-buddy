"use client";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { components } from "../../types/adguard";
import { RefreshCw, Power, PowerOff, Router, User, Info, BarChart3 } from "lucide-react";

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
  response: string;
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
    const id = connection.url && connection.url.length > 0 ? connection.url.replace(/\/$/, '') : `${connection.ip}${connection.port ? ':' + connection.port : ''}`;
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

  function AdGuardStatusCard({ data }: { data: AdGuardServerStatus }) {
    return (
      <div className="bg-[#0F1115]/50 rounded-lg p-4 border border-white/5">
        <h3 className="text-[var(--primary)] font-semibold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
          <Info className="w-4 h-4" /> AdGuard Status
        </h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
          <div className="text-gray-500">Version:</div>
          <div className="text-right font-mono text-gray-300">{data.version || "-"}</div>
          <div className="text-gray-500">Language:</div>
          <div className="text-right font-mono text-gray-300">{data.language || "-"}</div>
          <div className="text-gray-500">Ports (DNS/HTTP):</div>
          <div className="text-right font-mono text-gray-300">{data.dns_port || "-"} / {data.http_port || "-"}</div>
          <div className="text-gray-500">Protection:</div>
          <div className={`text-right font-medium ${data.protection_enabled ? "text-emerald-400" : "text-red-400"}`}>
            {data.protection_enabled ? "Active" : "Disabled"}
          </div>
          <div className="text-gray-500">DHCP / Running:</div>
          <div className={`text-right font-medium ${data.running ? "text-emerald-400" : "text-red-400"}`}>
            {data.dhcp_available ? "Available" : "N/A"} / {data.running ? "Yes" : "No"}
          </div>
        </div>
        {Array.isArray(data.dns_addresses) && data.dns_addresses.length > 0 && (
          <div className="mt-4">
            <div className="text-gray-500 text-xs uppercase tracking-wider mb-2">DNS Addresses</div>
            <div className="flex flex-wrap gap-2">
              {data.dns_addresses.map((addr, i) => (
                <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-white/5 text-gray-300 border border-white/10 select-all">
                  {addr}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function AdGuardStatsCard({ stats }: { stats: AdGuardStats }) {
    if (!stats) return null;

    const statItems = [
      { key: 'num_dns_queries', label: 'DNS queries', color: 'var(--primary)' },
      { key: 'num_blocked_filtering', label: 'Blocked', color: '#34d399' },
      { key: 'num_replaced_safebrowsing', label: 'Blocked Malware', color: '#fbbf24' },
      { key: 'num_replaced_parental', label: 'Block parental', color: '#f472b6' },
    ] as const;

    const maxQueries = stats.num_dns_queries || 1;

    return (
      <div className="bg-[#0F1115]/50 rounded-lg p-4 border border-white/5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[var(--primary)] font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Statistics
          </h3>
          <span className="text-[10px] text-gray-500">Live Updates</span>
        </div>
        <div className="space-y-3">
          {statItems.map(({ key, label, color }) => {
            const value = stats[key] || 0;
            const percentage = key === 'num_dns_queries' ? 100 : Math.min(100, (value / maxQueries) * 100 * 5);
            return (
              <div key={key}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono font-medium" style={{ color }}>
                    {value ? value.toLocaleString() : '-'}
                  </span>
                </div>
                {value > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%`, backgroundColor: color }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor your network instances in real-time.</p>
        </div>
        <div className="flex items-center bg-[#181A20] border border-[#2A2D35] rounded-lg p-1 shadow-sm">
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <div className="w-px h-6 bg-[#2A2D35] mx-1" />
          <button
            onClick={() => toggleAllProtection(true)}
            disabled={isLoading || connections.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
          >
            <Power className="w-4 h-4" /> Enable All
          </button>
          <button
            onClick={() => toggleAllProtection(false)}
            disabled={isLoading || connections.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <PowerOff className="w-4 h-4" /> Disable All
          </button>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && results.length === 0 && (
        <div className="text-center py-12 text-[var(--primary)]">Loading connection statuses...</div>
      )}

      {/* Server Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!isLoading && !error && results.map((res, idx) => {
          let parsed: AdGuardServerStatus | null = null;
          try {
            parsed = JSON.parse(res.response);
          } catch {
            parsed = null;
          }
          const connId = res.url && res.url.length > 0 ? res.url.replace(/\/$/, '') : `${res.ip}${res.port ? ':' + res.port : ''}`;

          return (
            <div key={`${connId}-${idx}`} className="adguard-card flex flex-col">
              {/* Card Header */}
              <div className="pb-4 border-b border-[#2A2D35] flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Router className="w-5 h-5 text-gray-500" />
                    <h2 className="text-lg font-bold text-white font-mono tracking-wide truncate max-w-[200px] sm:max-w-xs" title={connId}>
                      {connId.length > 30 ? connId.substring(0, 30) + '...' : connId}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    <span>User: <span className="font-mono text-[var(--primary)] font-semibold">{res.username}</span></span>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${res.status === "connected"
                    ? "bg-emerald-900/30 text-emerald-400 border-emerald-800"
                    : "bg-red-900/30 text-red-400 border-red-800"
                  }`}>
                  {res.status === "connected" && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                  )}
                  {res.status === "connected" ? "Connected" : "Error"}
                </span>
              </div>

              {/* Card Content */}
              <div className="flex-grow space-y-4">
                {parsed ? (
                  <>
                    <AdGuardStatusCard data={parsed} />
                    {res.stats && <AdGuardStatsCard stats={res.stats} />}
                  </>
                ) : (
                  <pre className="text-xs bg-[#0F1115] rounded p-3 overflow-x-auto max-h-40 whitespace-pre-wrap text-gray-400 border border-white/5">
                    {res.response}
                  </pre>
                )}
              </div>

              {/* Card Footer */}
              {parsed && (
                <div className="mt-4 pt-4 border-t border-[#2A2D35] flex justify-between items-center">
                  <span className="text-[10px] text-gray-500 font-mono">HTTP: {res.code || 200}</span>
                  <button
                    onClick={() => toggleProtection(res, !parsed.protection_enabled)}
                    disabled={isLoading || updatingIp === connId}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-50
                      ${parsed.protection_enabled
                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                        : 'bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]/20'
                      }`}
                  >
                    {updatingIp === connId
                      ? 'Updating...'
                      : (parsed.protection_enabled ? 'Disable Protection' : 'Enable Protection')
                    }
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && !error && connections.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No connections configured. Go to Settings to add AdGuard Home instances.
          </div>
        )}
      </div>
    </main>
  );
}
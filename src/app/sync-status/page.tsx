"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";
import { components } from "../../types/adguard";
import { SyncLogEntry, AutoSyncConfig } from "@/types/auto-sync";
import { getConnectionId, type Connection } from "@/lib/connectionUtils";

type FilterListItem = components['schemas']['Filter'];

type SettingsValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SettingsValue }
  | SettingsValue[]
  | FilterListItem;

type Settings = Record<string, SettingsValue>;

const areSettingsEqual = (a: SettingsValue, b: SettingsValue): boolean => {
    if (a === b) return true;

    // Treat null and empty array as equivalent, which AdGuard Home sometimes uses interchangeably.
    if ((a === null && Array.isArray(b) && b.length === 0) || (b === null && Array.isArray(a) && a.length === 0)) {
        return true;
    }

    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return a === b;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        const isFilterList = (arr: SettingsValue[]): arr is FilterListItem[] => {
            if (arr.length === 0) return false; // An empty array could be anything, so we don't use the special logic.
            const item = arr[0];
            // Heuristic: It's a filter list if items have 'url' and 'name'.
            return typeof item === 'object' && item !== null && 'url' in item && 'name' in item;
        };

        if (isFilterList(a) && isFilterList(b)) {
            const toComparableString = (item: FilterListItem) => JSON.stringify({ name: item.name, url: item.url });
            const setA = new Set(a.map(toComparableString));
            const setB = new Set(b.map(toComparableString));

            if (setA.size !== setB.size) return false;
            for (const item of setA) {
                if (!setB.has(item)) return false;
            }
            return true;
        }

        if (a.length !== b.length) return false;

        const sortKey = (arr: SettingsValue[]) => {
            if (arr.length === 0) return arr;
            const item = arr[0];
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                if ('id' in item) {
                    return [...arr].sort((x, y) => ((x as { id: number }).id - (y as { id: number }).id));
                }
                if ('url' in item) {
                    return [...arr].sort((x, y) => String((x as { url: string }).url).localeCompare(String((y as { url: string }).url)));
                }
                if ('domain' in item) {
                    return [...arr].sort((x, y) => String((x as { domain: string }).domain).localeCompare(String((y as { domain: string }).domain)));
                }
            }
            return [...arr].sort();
        };

        const sortedA = sortKey(a);
        const sortedB = sortKey(b);

        for (let i = 0; i < sortedA.length; i++) {
            if (!areSettingsEqual(sortedA[i], sortedB[i])) {
                return false;
            }
        }
        return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const IGNORED_COMPARISON_KEYS = ['id', 'last_updated', 'rules_count', 'default_local_ptr_upstreams'];

    for (const key of keysA) {
        if (IGNORED_COMPARISON_KEYS.includes(key)) continue;
        if (!keysB.includes(key) || !areSettingsEqual((a as Record<string, SettingsValue>)[key], (b as Record<string, SettingsValue>)[key])) {
            return false;
        }
    }

    for (const key of keysB) {
        if (IGNORED_COMPARISON_KEYS.includes(key)) continue;
        if (!keysA.includes(key)) return false;
    }

    return true;
};


export default function SyncStatusPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [masterServerIp, setMasterServerIp] = useState<string | null>(null);
  const [masterSettings, setMasterSettings] = useState<Settings | null>(null);
    const [replicaSettings, setReplicaSettings] = useState<Record<string, { settings?: Settings; errors?: Record<string,string> }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logModalTitle, setLogModalTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'status' | 'auto-sync'>('status');
  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig | null>(null);
  const [autoSyncLogs, setAutoSyncLogs] = useState<SyncLogEntry[]>([]);
  const [autoSyncRunning, setAutoSyncRunning] = useState(false);
  const [autoSyncPaused, setAutoSyncPaused] = useState(false);
  const [nextSyncTime, setNextSyncTime] = useState<number | null>(null);
  const [filterReplica, setFilterReplica] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [isTriggering, setIsTriggering] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, string | null>>({});
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchAutoSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-sync-config');
      if (!response || !response.ok) return;
      
      const data = await response.json();
      if (!data) return;
      
      setAutoSyncConfig(data.config);
      setAutoSyncLogs(data.recentLogs || []);
      setAutoSyncRunning(data.isRunning);
      setAutoSyncPaused(data.isPaused || false);
      setNextSyncTime(data.nextSync);
    } catch (error) {
      console.error('Failed to fetch auto-sync status:', error);
    }
  }, []);

  const triggerAutoSync = async () => {
    if (!autoSyncConfig?.enabled) {
      showNotification('Auto-sync is not enabled. Enable it in Settings first.', 'error');
      return;
    }
    if (autoSyncPaused) {
      showNotification('Auto-sync is currently paused. Please resume auto-sync before triggering.', 'error');
      return;
    }

    setIsTriggering(true);
    try {
      const response = await fetch('/api/auto-sync-trigger', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger auto-sync');
      }

      showNotification('Auto-sync triggered successfully! Check the logs below.', 'success');
      
      // Refresh status after a short delay to see the results
      setTimeout(() => {
        fetchAutoSyncStatus();
      }, 2000);
    } catch (error) {
      const err = error as Error;
      showNotification(`Failed to trigger auto-sync: ${err.message}`, 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSync = async (replicaIp: string, category: string) => {
    // Prevent manual sync if auto-sync is active
    if (autoSyncRunning && !autoSyncPaused) {
      showNotification('Manual sync is disabled while auto-sync is active. Pause or disable auto-sync first.', 'error');
      return;
    }

    const syncKey = `${replicaIp}:${category}`;
    setSyncing(syncKey);
    setSyncLogs([]);
    setLogModalTitle(`Syncing '${category}' to ${replicaIp}...`);
    setShowLogModal(true);

    // Resolve connections using normalized IDs
    const masterConn = connections.find(c => getConnectionId(c) === masterServerIp);
    const replicaConn = connections.find(c => getConnectionId(c) === replicaIp);

    if (!masterConn || !replicaConn) {
        setSyncLogs(prev => [...prev, "Error: Master or replica connection not found."]);
        setSyncing(null);
        return;
    }

    try {
    const sourceDecrypted = CryptoJS.AES.decrypt(masterConn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
    const destDecrypted = CryptoJS.AES.decrypt(replicaConn.password, encryptionKey).toString(CryptoJS.enc.Utf8);

        const response = await fetch('/api/sync-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceConnection: { ...masterConn, password: sourceDecrypted },
                destinationConnection: { ...replicaConn, password: destDecrypted },
                category,
            }),
        });

        if (!response.ok || !response.body) {
            const errorData = await response.json().catch(() => ({ message: 'Sync failed with no error message.' }));
            throw new Error(errorData.message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                setLogModalTitle(prev => prev.replace('Syncing', 'Synced'));
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        setSyncLogs(prev => [...prev, data.message]);
                    } catch {
                        console.error("Failed to parse log line:", jsonStr);
                    }
                }
            }
        }
        setTimeout(() => fetchAllSettings(), 1000);

    } catch (e: unknown) {
        const errorMessage = `FATAL: ${e instanceof Error ? e.message : String(e)}`;
        setSyncLogs(prev => [...prev, errorMessage]);
        setLogModalTitle(prev => prev.replace('Syncing', 'Failed'));
        showNotification(errorMessage, 'error');
    } finally {
        setSyncing(null);
    }
  };

  const fetchAllSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
        const response = await fetch('/api/get-connections');
        if (!response.ok) {
            throw new Error('Failed to fetch connection settings.');
        }
        const config = await response.json();

        if (!config.connections || !config.masterServerIp) {
            setError("Master server or connections not configured.");
            setIsLoading(false);
            return;
        }

    const allConnections: Connection[] = config.connections;
    // Use consistent connection ID helper
    const masterConn = allConnections.find(c => getConnectionId(c) === config.masterServerIp);
    const replicaConns = allConnections.filter(c => getConnectionId(c) !== (config.masterServerIp || ''));

    setConnections(allConnections);
    setMasterServerIp(config.masterServerIp);

        if (!masterConn) {
            setError("Configured master server not found in connections list.");
            setIsLoading(false);
            return;
        }

        const fetchSettingsFor = async (conn: Connection) => {
            let decrypted = "";
            try {
                decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
            } catch {}
            const response = await fetch('/api/get-all-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...conn, password: decrypted }),
            });
            if (!response.ok) throw new Error(`Failed to fetch settings for ${conn.ip}`);
            return response.json();
        };
        const masterPromise = fetchSettingsFor(masterConn as Connection);
    const replicaPromises = replicaConns.map(conn => fetchSettingsFor(conn).then(data => ({ id: getConnectionId(conn), settings: data.settings, errors: data.errors })));

        const masterResult = await masterPromise;
        setMasterSettings(masterResult.settings);

        const allReplicas = await Promise.all(replicaPromises);
        const replicaData = allReplicas.reduce((acc, current) => {
            acc[current.id] = { settings: current.settings, errors: current.errors };
            return acc;
        }, {} as Record<string, { settings?: Settings; errors?: Record<string,string> }>);
        setReplicaSettings(replicaData);

    } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
    } finally {
        setIsLoading(false);
    }
  }, [encryptionKey]);

  useEffect(() => {
    fetchAllSettings();
    fetchAutoSyncStatus();
    
    // Refresh auto-sync status every 10 seconds
    const interval = setInterval(fetchAutoSyncStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchAllSettings, fetchAutoSyncStatus]);

  const SimpleDiffViewer = ({ masterData, replicaData }: { masterData: unknown, replicaData: unknown }) => (
      <div className="grid grid-cols-2 gap-4 p-2 mt-1 bg-gray-900/50 rounded-md text-xs">
          <div>
              <h4 className="font-bold text-gray-400">Master:</h4>
              <pre className="text-gray-500 whitespace-pre-wrap break-all">{JSON.stringify(masterData, null, 2)}</pre>
          </div>
          <div>
              <h4 className="font-bold text-gray-400">This Server:</h4>
              <pre className="text-gray-500 whitespace-pre-wrap break-all">{JSON.stringify(replicaData, null, 2)}</pre>
          </div>
      </div>
  );

  const ComparisonCard = ({ ip, settings }: { ip: string, settings: { settings?: Settings; errors?: Record<string,string> } }) => {
    const expandedCategory = expandedCategories[ip] || null;
    const setExpandedCategory = (value: string | null) => {
      setExpandedCategories(prev => ({ ...prev, [ip]: value }));
    };

    if (!masterSettings) return null;

    const SYNCABLE_KEYS = ['filtering', 'querylogConfig', 'statsConfig', 'dnsSettings', 'rewrites', 'blockedServices', 'accessList'];

    if (!settings || (!settings.settings && settings.errors)) {
        // Show error state
        return (
            <div className="adguard-card border-2 border-warning">
                <h3 className="font-mono text-primary text-lg mb-2">{ip}</h3>
                <p className="text-danger font-bold mb-2">Error fetching settings</p>
                <div className="text-xs text-gray-400">
                    {settings.errors ? Object.entries(settings.errors).map(([k,v]) => <div key={k}><strong>{k}:</strong> {v}</div>) : 'No details.'}
                </div>
            </div>
        );
    }

    const targetSettings = settings.settings as Settings;

    const differences = SYNCABLE_KEYS.filter(key => {
        const m = (masterSettings as Settings)[key];
        const r = (targetSettings as Settings)[key];
        const bothMissing = (m === undefined || m === null) && (r === undefined || r === null);
        if (bothMissing) return false;
        return !areSettingsEqual(m, r);
    });

    const isSynced = differences.length === 0;

    if (isSynced) {
        return (
            <div className="adguard-card border-2 border-primary-dark">
                <h3 className="font-mono text-primary text-lg mb-2">{ip}</h3>
                <p className="text-primary">In Sync with Master</p>
            </div>
        );
    }

    return (
        <div className="adguard-card border-2 border-danger">
            <h3 className="font-mono text-primary text-lg mb-2">{ip}</h3>
            <p className="text-danger font-bold mb-2">Out of Sync</p>
            <ul className="text-sm text-gray-400 space-y-2">
                {differences.map(key => {
                    const syncKey = `${ip}:${key}`;
                    const isSyncing = syncing === syncKey;
                    return (
                        <li key={key}>
                            <div className="flex justify-between items-center p-2 rounded-md hover:bg-gray-800">
                                <button onClick={() => setExpandedCategory(expandedCategory === key ? null : key)} className="flex-grow text-left flex items-center gap-2">
                                    <span>{key}</span>
                                    <span>{expandedCategory === key ? '▼' : '▶'}</span>
                                </button>
                                <button
                                    onClick={() => handleSync(ip, key)}
                                    className="px-3 py-1 text-xs text-primary border border-neon rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSyncing || (autoSyncRunning && !autoSyncPaused)}
                                    title={autoSyncRunning && !autoSyncPaused ? 'Manual sync disabled while auto-sync is active' : ''}
                                >
                                    {isSyncing ? 'Syncing...' : 'Sync'}
                                </button>
                            </div>
                            {expandedCategory === key && (
                                <SimpleDiffViewer
                                    masterData={masterSettings[key]}
                                    replicaData={targetSettings[key]}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
  };

  const LogViewerModal = ({ title, logs, show, onClose }: { title: string, logs: string[], show: boolean, onClose: () => void }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    if (!show) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-primary-dark rounded-lg shadow-lg w-full max-w-4xl h-[70vh] flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl">&times;</button>
          </div>
          <div className="bg-black flex-grow rounded-md p-4 overflow-y-auto font-mono text-sm text-gray-300">
            {logs.map((log, index) => (
              <div key={index} className={log.startsWith('ERROR') || log.startsWith('FATAL') ? 'text-danger' : ''}>{`> ${log}`}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    );
  };

  const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatNextSync = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    const seconds = Math.floor((timestamp - Date.now()) / 1000);
    if (seconds < 0) return 'Any moment now';
    if (seconds < 60) return `in ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `in ${hours}h`;
  };

  const filteredAutoSyncLogs = autoSyncLogs.filter(log => {
    if (filterReplica !== 'all' && log.replicaId !== filterReplica) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  const AutoSyncHistoryView = () => {
    if (!autoSyncConfig) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading auto-sync configuration...</p>
        </div>
      );
    }

    if (!autoSyncConfig.enabled) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Auto-sync is currently disabled.</p>
          <p className="text-sm text-gray-500">Enable auto-sync in Settings to start automatic synchronization.</p>
        </div>
      );
    }

    const uniqueReplicas = Array.from(new Set(autoSyncLogs.map(log => log.replicaId)));
    const uniqueCategories = Array.from(new Set(autoSyncLogs.map(log => log.category)));
    
    const successCount = autoSyncLogs.filter(log => log.status === 'success').length;
    const errorCount = autoSyncLogs.filter(log => log.status === 'error').length;
    const successRate = autoSyncLogs.length > 0 ? ((successCount / autoSyncLogs.length) * 100).toFixed(1) : '0';

    return (
      <div className="space-y-6">
        {/* Auto-Sync Status Card */}
        <div className="adguard-card">
          <h2 className="font-semibold mb-4 card-title">Auto-Sync Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Status</p>
              <p className="text-primary font-bold text-lg">
                {autoSyncPaused ? '⏸ Paused' : autoSyncRunning ? '✓ Active' : '○ Inactive'}
              </p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Interval</p>
              <p className="text-primary font-bold text-lg capitalize">
                {autoSyncConfig.interval.replace('min', ' min').replace('hour', ' hr')}
              </p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Last Sync</p>
              <p className="text-primary font-bold text-lg">
                {formatTimeAgo(autoSyncConfig.lastSync || null)}
              </p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Next Sync</p>
              <p className="text-primary font-bold text-lg">
                {formatNextSync(nextSyncTime)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-gray-900 p-3 rounded-lg text-center">
              <p className="text-gray-400 text-xs">Success Rate</p>
              <p className="text-primary font-bold text-xl">{successRate}%</p>
            </div>
            <div className="bg-gray-900 p-3 rounded-lg text-center">
              <p className="text-gray-400 text-xs">Successful</p>
              <p className="text-primary font-bold text-xl">{successCount}</p>
            </div>
            <div className="bg-gray-900 p-3 rounded-lg text-center">
              <p className="text-gray-400 text-xs">Failed</p>
              <p className="text-danger font-bold text-xl">{errorCount}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-gray-400 text-sm mb-2">Active Categories:</p>
            <div className="flex flex-wrap gap-2">
              {autoSyncConfig.categories.map(cat => (
                <span key={cat} className="px-3 py-1 bg-primary-dark text-primary rounded-full text-xs">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Trigger Now Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={triggerAutoSync}
              disabled={!autoSyncConfig.enabled || isTriggering}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                !autoSyncConfig.enabled || isTriggering
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-black hover:bg-green-400 hover:shadow-lg hover:shadow-primary/50'
              }`}
            >
              {isTriggering ? (
                <>
                  <span className="inline-block animate-spin mr-2">⟳</span>
                  Triggering...
                </>
              ) : (
                <>
                  <span className="mr-2">▶</span>
                  Trigger Sync Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="adguard-card">
          <h3 className="font-semibold mb-4 text-primary">Filter Logs</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Replica</label>
              <select
                value={filterReplica}
                onChange={(e) => setFilterReplica(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary"
              >
                <option value="all">All Replicas</option>
                {uniqueReplicas.map(replica => (
                  <option key={replica} value={replica}>{replica}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'success' | 'error')}
                className="w-full px-3 py-2 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sync History */}
        <div className="adguard-card">
          <h3 className="font-semibold mb-4 text-primary">
            Sync History ({filteredAutoSyncLogs.length} entries)
          </h3>
          {filteredAutoSyncLogs.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No sync logs match the current filters.</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredAutoSyncLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    log.status === 'success'
                      ? 'bg-gray-900 border-primary-dark'
                      : 'bg-danger-dark border-danger'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xl ${log.status === 'success' ? 'text-primary' : 'text-danger'}`}>
                        {log.status === 'success' ? '✓' : '✗'}
                      </span>
                      <div>
                        <p className="text-primary font-semibold">
                          {log.category} → {log.replicaId}
                        </p>
                        <p className="text-gray-400 text-sm">{log.message}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                      {log.duration && (
                        <p className="text-gray-500 text-xs">
                          {log.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-8 relative">
      {notification && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg text-white z-50 ${notification.type === 'success' ? 'bg-primary-dark text-primary' : 'bg-danger-dark text-danger'}`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-4 font-bold">X</button>
        </div>
      )}
      <LogViewerModal
        show={showLogModal}
        title={logModalTitle}
        logs={syncLogs}
        onClose={() => setShowLogModal(false)}
      />
      <NavMenu />
      <h1 className="text-3xl font-extrabold mb-4 text-center dashboard-title">Sync Status</h1>
      <div className="text-center text-gray-400 mb-6">
        Comparing all servers against master: <strong className="text-primary font-mono">{masterServerIp || 'Not Set'}</strong>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            activeTab === 'status'
              ? 'text-primary border-2 border-neon shadow-neon'
              : 'text-gray-400 border-2 border-gray-600 hover:border-gray-500'
          }`}
        >
          Manual Sync Status
        </button>
        <button
          onClick={() => setActiveTab('auto-sync')}
          className={`px-6 py-3 rounded-lg font-bold transition-all ${
            activeTab === 'auto-sync'
              ? 'text-primary border-2 border-neon shadow-neon'
              : 'text-gray-400 border-2 border-gray-600 hover:border-gray-500'
          }`}
        >
          Auto-Sync History
          {autoSyncRunning && (
            <span className="ml-2 inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'status' && (
        <>
          {/* Warning banner when auto-sync is active */}
          {autoSyncRunning && !autoSyncPaused && (
            <div className="mb-6 p-4 bg-yellow-900/30 border-2 border-yellow-500 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="text-yellow-500 font-semibold mb-1">Auto-Sync is Active - Manual Sync Disabled</h3>
                  <p className="text-gray-300 text-sm">
                    Manual synchronization is disabled while auto-sync is running to prevent conflicts. 
                    To use manual sync, please pause or disable auto-sync in Settings first.
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Next auto-sync: {nextSyncTime ? formatNextSync(nextSyncTime) : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info banner when auto-sync is paused */}
          {autoSyncConfig?.enabled && autoSyncPaused && (
            <div className="mb-6 p-4 bg-blue-900/30 border-2 border-blue-500 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-2xl">ℹ️</span>
                <div className="flex-1">
                  <h3 className="text-blue-500 font-semibold mb-1">Auto-Sync is Paused - Manual Sync Available</h3>
                  <p className="text-gray-300 text-sm">
                    Auto-sync is currently paused. Manual synchronization is available. 
                    You can resume auto-sync in Settings when ready.
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Auto-sync will resume at the next scheduled interval ({autoSyncConfig.interval}) after you click Resume.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoading && <p className="text-center text-primary">Loading all server settings for comparison...</p>}
          {error && <p className="text-center text-danger p-4 bg-danger-dark rounded-lg">{error}</p>}

          {!isLoading && !error && (
            <div className="space-y-8">
                {Object.entries(replicaSettings).map(([ip, settings]) => (
                    <ComparisonCard key={ip} ip={ip} settings={settings} />
                ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'auto-sync' && <AutoSyncHistoryView />}
    </div>
  );
}
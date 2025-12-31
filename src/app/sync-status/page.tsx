"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";
import { components } from "../../types/adguard";
import { SyncLogEntry, AutoSyncConfig } from "@/types/auto-sync";
import { getConnectionId, type Connection } from "@/lib/connectionUtils";
import { RefreshCw, GitCompare, History, ChevronDown, ChevronRight, Check, AlertCircle, Clock, Filter, Play, X, Pause } from "lucide-react";

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
  if ((a === null && Array.isArray(b) && b.length === 0) || (b === null && Array.isArray(a) && a.length === 0)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    const isFilterList = (arr: SettingsValue[]): arr is FilterListItem[] => {
      if (arr.length === 0) return false;
      const item = arr[0];
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
        if ('id' in item) return [...arr].sort((x, y) => ((x as { id: number }).id - (y as { id: number }).id));
        if ('url' in item) return [...arr].sort((x, y) => String((x as { url: string }).url).localeCompare(String((y as { url: string }).url)));
        if ('domain' in item) return [...arr].sort((x, y) => String((x as { domain: string }).domain).localeCompare(String((y as { domain: string }).domain)));
      }
      return [...arr].sort();
    };
    const sortedA = sortKey(a);
    const sortedB = sortKey(b);
    for (let i = 0; i < sortedA.length; i++) {
      if (!areSettingsEqual(sortedA[i], sortedB[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const IGNORED_COMPARISON_KEYS = ['id', 'last_updated', 'rules_count', 'default_local_ptr_upstreams'];
  for (const key of keysA) {
    if (IGNORED_COMPARISON_KEYS.includes(key)) continue;
    if (!keysB.includes(key) || !areSettingsEqual((a as Record<string, SettingsValue>)[key], (b as Record<string, SettingsValue>)[key])) return false;
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
  const [replicaSettings, setReplicaSettings] = useState<Record<string, { settings?: Settings; errors?: Record<string, string> }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
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
      showNotification('Auto-sync is currently paused.', 'error');
      return;
    }

    setIsTriggering(true);
    try {
      const response = await fetch('/api/auto-sync-trigger', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to trigger auto-sync');
      }
      showNotification('Auto-sync triggered successfully!', 'success');
      setTimeout(() => fetchAutoSyncStatus(), 2000);
    } catch (error) {
      const err = error as Error;
      showNotification(`Failed to trigger auto-sync: ${err.message}`, 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSync = async (replicaIp: string, category: string) => {
    if (autoSyncRunning && !autoSyncPaused) {
      showNotification('Manual sync is disabled while auto-sync is active.', 'error');
      return;
    }

    const syncKey = `${replicaIp}:${category}`;
    setSyncing(syncKey);
    setSyncLogs([]);
    setLogModalTitle(`Syncing '${category}' to ${replicaIp}...`);
    setShowLogModal(true);

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
        const errorData = await response.json().catch(() => ({ message: 'Sync failed.' }));
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
            try {
              const data = JSON.parse(line.substring(6));
              setSyncLogs(prev => [...prev, data.message]);
            } catch { }
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
      if (!response.ok) throw new Error('Failed to fetch connection settings.');
      const config = await response.json();

      if (!config.connections || !config.masterServerIp) {
        setError("Master server or connections not configured.");
        setIsLoading(false);
        return;
      }

      const allConnections: Connection[] = config.connections;
      const masterConn = allConnections.find(c => getConnectionId(c) === config.masterServerIp);
      const replicaConns = allConnections.filter(c => getConnectionId(c) !== (config.masterServerIp || ''));

      setConnections(allConnections);
      setMasterServerIp(config.masterServerIp);

      if (!masterConn) {
        setError("Configured master server not found.");
        setIsLoading(false);
        return;
      }

      const fetchSettingsFor = async (conn: Connection) => {
        let decrypted = "";
        try {
          decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
        } catch { }
        const response = await fetch('/api/get-all-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...conn, password: decrypted }),
        });
        if (!response.ok) throw new Error(`Failed to fetch settings for ${conn.ip}`);
        return response.json();
      };

      const masterResult = await fetchSettingsFor(masterConn);
      setMasterSettings(masterResult.settings);

      const replicaPromises = replicaConns.map(conn =>
        fetchSettingsFor(conn).then(data => ({
          id: getConnectionId(conn),
          settings: data.settings,
          errors: data.errors
        }))
      );

      const allReplicas = await Promise.all(replicaPromises);
      const replicaData = allReplicas.reduce((acc, current) => {
        acc[current.id] = { settings: current.settings, errors: current.errors };
        return acc;
      }, {} as Record<string, { settings?: Settings; errors?: Record<string, string> }>);
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
    const interval = setInterval(fetchAutoSyncStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchAllSettings, fetchAutoSyncStatus]);

  const LogViewerModal = ({ title, logs, show, onClose }: { title: string, logs: string[], show: boolean, onClose: () => void }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);
    if (!show) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#181A20] border border-[#2A2D35] rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-[#2A2D35]">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-gray-300 bg-[#0F1115]">
            {logs.map((log, index) => (
              <div key={index} className={log.startsWith('ERROR') || log.startsWith('FATAL') ? 'text-red-400' : ''}>{`> ${log}`}</div>
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
    return `${Math.floor(hours / 24)}d ago`;
  };

  const formatNextSync = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    const seconds = Math.floor((timestamp - Date.now()) / 1000);
    if (seconds < 0) return 'Any moment';
    if (seconds < 60) return `in ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `in ${minutes}m`;
    return `in ${Math.floor(minutes / 60)}h`;
  };

  const filteredAutoSyncLogs = autoSyncLogs.filter(log => {
    if (filterReplica !== 'all' && log.replicaId !== filterReplica) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    return true;
  });

  const ComparisonCard = ({ ip, settings }: { ip: string, settings: { settings?: Settings; errors?: Record<string, string> } }) => {
    const expandedCategory = expandedCategories[ip] || null;
    const setExpandedCategory = (value: string | null) => {
      setExpandedCategories(prev => ({ ...prev, [ip]: value }));
    };

    if (!masterSettings) return null;

    const SYNCABLE_KEYS = ['filtering', 'querylogConfig', 'statsConfig', 'dnsSettings', 'rewrites', 'blockedServices', 'accessList'];

    if (!settings || (!settings.settings && settings.errors)) {
      return (
        <div className="adguard-card border-yellow-500/30">
          <h3 className="font-mono text-white text-lg mb-2">{ip}</h3>
          <p className="text-red-400 font-medium mb-2">Error fetching settings</p>
          <div className="text-xs text-gray-500">
            {settings.errors ? Object.entries(settings.errors).map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>) : 'No details.'}
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

    return (
      <div className={`adguard-card ${isSynced ? 'border-[var(--primary)]/30' : 'border-red-500/30'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-white text-lg">{ip}</h3>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isSynced
            ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
            {isSynced ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {isSynced ? 'In Sync' : 'Out of Sync'}
          </span>
        </div>

        {!isSynced && (
          <div className="space-y-2">
            {differences.map(key => {
              const syncKey = `${ip}:${key}`;
              const isSyncing = syncing === syncKey;
              const isExpanded = expandedCategory === key;
              return (
                <div key={key} className="rounded-lg border border-[#2A2D35] overflow-hidden">
                  <div className="flex justify-between items-center p-3 bg-[#0F1115]">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : key)}
                      className="flex-grow text-left flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-medium">{key}</span>
                    </button>
                    <button
                      onClick={() => handleSync(ip, key)}
                      disabled={isSyncing || (autoSyncRunning && !autoSyncPaused)}
                      className="px-3 py-1.5 text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg hover:bg-[var(--primary)]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-[#0F1115]/50 text-xs">
                      <div>
                        <h4 className="font-bold text-gray-500 mb-2">Master</h4>
                        <pre className="text-gray-400 whitespace-pre-wrap break-all">{JSON.stringify(masterSettings[key], null, 2)}</pre>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-500 mb-2">This Server</h4>
                        <pre className="text-gray-400 whitespace-pre-wrap break-all">{JSON.stringify(targetSettings[key], null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const uniqueReplicas = Array.from(new Set(autoSyncLogs.map(log => log.replicaId)));
  const uniqueCategories = Array.from(new Set(autoSyncLogs.map(log => log.category)));
  const successCount = autoSyncLogs.filter(log => log.status === 'success').length;
  const successRate = autoSyncLogs.length > 0 ? ((successCount / autoSyncLogs.length) * 100).toFixed(1) : '0';

  return (
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative">
      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 ${notification.type === 'success'
          ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      <LogViewerModal show={showLogModal} title={logModalTitle} logs={syncLogs} onClose={() => setShowLogModal(false)} />

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">Sync Status</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comparing all servers against master: <span className="text-[var(--primary)] font-mono">{masterServerIp || 'Not Set'}</span>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === 'status'
            ? 'text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30'
            : 'text-gray-400 border border-[#2A2D35] hover:border-gray-500'
            }`}
        >
          <GitCompare className="w-4 h-4" />
          Manual Sync Status
        </button>
        <button
          onClick={() => setActiveTab('auto-sync')}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === 'auto-sync'
            ? 'text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30'
            : 'text-gray-400 border border-[#2A2D35] hover:border-gray-500'
            }`}
        >
          <History className="w-4 h-4" />
          Auto-Sync History
          {autoSyncRunning && <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse" />}
        </button>
      </div>

      {/* Manual Sync Tab */}
      {activeTab === 'status' && (
        <>
          {/* Warning Banner */}
          {autoSyncRunning && !autoSyncPaused && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
              <Pause className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-yellow-500 font-medium">Auto-Sync Active - Manual Sync Disabled</h3>
                <p className="text-gray-400 text-sm mt-1">Pause or disable auto-sync in Settings to use manual sync.</p>
              </div>
            </div>
          )}

          {isLoading && <div className="text-center py-12 text-[var(--primary)]">Loading server settings...</div>}
          {error && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">{error}</div>}

          {!isLoading && !error && (
            <div className="space-y-6">
              {Object.entries(replicaSettings).map(([ip, settings]) => (
                <ComparisonCard key={ip} ip={ip} settings={settings} />
              ))}
              {Object.keys(replicaSettings).length === 0 && (
                <div className="text-center py-12 text-gray-500">No replica servers found.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Auto-Sync History Tab */}
      {activeTab === 'auto-sync' && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="adguard-card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Auto-Sync Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <p className="text-[var(--primary)] font-bold text-lg">
                  {autoSyncPaused ? '⏸ Paused' : autoSyncRunning ? '✓ Active' : '○ Inactive'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Last Sync</p>
                <p className="text-[var(--primary)] font-bold text-lg">{formatTimeAgo(autoSyncConfig?.lastSync || null)}</p>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Next Sync</p>
                <p className="text-[var(--primary)] font-bold text-lg">{formatNextSync(nextSyncTime)}</p>
              </div>
              <div className="p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</p>
                <p className="text-[var(--primary)] font-bold text-lg">{successRate}%</p>
              </div>
            </div>

            <button
              onClick={triggerAutoSync}
              disabled={!autoSyncConfig?.enabled || isTriggering || autoSyncPaused}
              className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${!autoSyncConfig?.enabled || isTriggering || autoSyncPaused
                ? 'bg-[#2A2D35] text-gray-500 cursor-not-allowed'
                : 'bg-[var(--primary)] text-black hover:bg-[var(--primary-dark)]'
                }`}
            >
              {isTriggering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isTriggering ? 'Triggering...' : 'Trigger Sync Now'}
            </button>
          </div>

          {/* Filters */}
          <div className="adguard-card">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter Logs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Replica</label>
                <select value={filterReplica} onChange={(e) => setFilterReplica(e.target.value)} className="w-full">
                  <option value="all">All Replicas</option>
                  {uniqueReplicas.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full">
                  <option value="all">All Categories</option>
                  {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'success' | 'error')} className="w-full">
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sync History */}
          <div className="adguard-card">
            <h3 className="text-white font-medium mb-4">
              Sync History ({filteredAutoSyncLogs.length} entries)
            </h3>
            {filteredAutoSyncLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sync logs match the current filters.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredAutoSyncLogs.map((log, index) => (
                  <div key={index} className={`p-3 rounded-lg border flex items-center justify-between ${log.status === 'success'
                    ? 'bg-[#0F1115] border-[var(--primary)]/30'
                    : 'bg-red-500/5 border-red-500/30'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl ${log.status === 'success' ? 'text-[var(--primary)]' : 'text-red-400'}`}>
                        {log.status === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </span>
                      <div>
                        <p className="text-white font-medium">{log.category} → {log.replicaId}</p>
                        <p className="text-gray-500 text-sm">{log.message}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{new Date(log.timestamp).toLocaleString()}</p>
                      {log.duration && <p>{log.duration}ms</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
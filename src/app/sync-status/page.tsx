"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback, useRef } from "react";
import CryptoJS from "crypto-js";
import { components } from "../../types/adguard";

// Types
type Connection = {
  ip: string;
  port: number;
  username: string;
  password: string; // encrypted
    url?: string;
    allowInsecure?: boolean;
};

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
    const IGNORED_COMPARISON_KEYS = ['id', 'last_updated', 'rules_count'];

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
  const [syncAllProgress, setSyncAllProgress] = useState<string | null>(null);
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSync = async (replicaIp: string, category: string, bulkMode: boolean = false) => {
    const syncKey = `${replicaIp}:${category}`;
    if (!bulkMode) {
      setSyncing(syncKey);
      setSyncLogs([]);
      setLogModalTitle(`Syncing '${category}' to ${replicaIp}...`);
      setShowLogModal(true);
    }

    // Resolve connections by either ip or url (url stored without trailing slash)
    const masterConn = connections.find(c => (c.url && c.url.replace(/\/$/, '') === masterServerIp) || c.ip === masterServerIp);
    const replicaConn = connections.find(c => (c.url && c.url.replace(/\/$/, '') === replicaIp) || c.ip === replicaIp);

    if (!masterConn || !replicaConn) {
        const errorMsg = "Error: Master or replica connection not found.";
        if (bulkMode) {
          setSyncLogs(prev => [...prev, `${replicaIp}:${category} - ${errorMsg}`]);
        } else {
          setSyncLogs(prev => [...prev, errorMsg]);
        }
        if (!bulkMode) setSyncing(null);
        return;
    }

    try {
    const sourceDecrypted = CryptoJS.AES.decrypt(masterConn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
    const destDecrypted = CryptoJS.AES.decrypt(replicaConn.password, encryptionKey).toString(CryptoJS.enc.Utf8);

        console.log(`[SYNC] Starting sync: ${category} from ${masterConn.ip || masterConn.url} to ${replicaConn.ip || replicaConn.url}`);

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
        let pendingLogs: string[] = [];

        const flushLogs = () => {
          if (pendingLogs.length > 0) {
            setSyncLogs(prev => [...prev, ...pendingLogs]);
            pendingLogs = [];
          }
        };

        // Flush logs every 100ms for better performance
        const flushInterval = setInterval(flushLogs, 100);

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                clearInterval(flushInterval);
                flushLogs(); // Final flush
                if (!bulkMode) setLogModalTitle(prev => prev.replace('Syncing', 'Synced'));
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
                        const logMsg = bulkMode ? `${replicaIp}:${category} - ${data.message}` : data.message;
                        pendingLogs.push(logMsg);
                    } catch {
                        console.error("Failed to parse log line:", jsonStr);
                    }
                }
            }
        }
        if (!bulkMode) setTimeout(() => fetchAllSettings(), 1000);
        console.log(`[SYNC] Completed sync: ${category} from ${masterConn.ip || masterConn.url} to ${replicaConn.ip || replicaConn.url}`);

    } catch (e: unknown) {
        const errorMessage = `FATAL: ${e instanceof Error ? e.message : String(e)}`;
        const logMsg = bulkMode ? `${replicaIp}:${category} - ${errorMessage}` : errorMessage;
        setSyncLogs(prev => [...prev, logMsg]);
        if (!bulkMode) {
          setLogModalTitle(prev => prev.replace('Syncing', 'Failed'));
          showNotification(errorMessage, 'error');
        }
        console.error(`[SYNC] Failed sync: ${category} from ${masterConn?.ip || masterConn?.url} to ${replicaConn?.ip || replicaConn?.url}:`, e);
    } finally {
        if (!bulkMode) setSyncing(null);
    }
  };

    const handleSyncAll = async () => {
    if (!masterSettings) {
      showNotification('Master settings not loaded yet.', 'error');
      return;
    }

    setSyncAllProgress('Starting sync all...');
    setSyncLogs([]);
    setLogModalTitle('Syncing All...');
    setShowLogModal(true);

    const SYNCABLE_KEYS = ['filtering', 'querylogConfig', 'statsConfig', 'rewrites', 'blockedServices', 'accessList'];

    const replicas = Object.keys(replicaSettings);
    const totalTasks = replicas.length * SYNCABLE_KEYS.length;
    let completedTasks = 0;

    // Add initial progress log
    setSyncLogs(prev => [...prev, `Starting bulk sync of ${totalTasks} tasks across ${replicas.length} servers...`]);
    console.log(`[SYNC-ALL] Starting bulk sync: ${totalTasks} tasks across ${replicas.length} servers`);

    for (const replicaIp of replicas) {
      for (const category of SYNCABLE_KEYS) {
        setSyncAllProgress(`Syncing ${category} to ${replicaIp}... (${completedTasks + 1}/${totalTasks})`);
        try {
          await handleSync(replicaIp, category, true);
        } catch (error) {
          console.error(`[SYNC-ALL] Failed to sync ${category} to ${replicaIp}:`, error);
        }
        completedTasks++;
      }
    }

    setLogModalTitle('Synced All');
    setSyncAllProgress(null);
    setSyncLogs(prev => [...prev, `Bulk sync completed! Processed ${totalTasks} tasks.`]);
    console.log(`[SYNC-ALL] Bulk sync completed: ${totalTasks} tasks processed successfully`);
    showNotification('Sync all completed.', 'success');
    // Refresh settings after sync all
    setTimeout(() => fetchAllSettings(), 1000);
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
    // Normalize connection id: prefer URL (trimmed) else ip
    const connId = (c: Connection) => (c.url && c.url.length > 0) ? c.url.replace(/\/$/, '') : c.ip;
    const masterConn = allConnections.find(c => connId(c) === config.masterServerIp || c.ip === config.masterServerIp || (c.url && c.url.replace(/\/$/, '') === config.masterServerIp));
    const replicaConns = allConnections.filter(c => connId(c) !== (config.masterServerIp || ''));

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
    const replicaPromises = replicaConns.map(conn => fetchSettingsFor(conn).then(data => ({ id: connId(conn), settings: data.settings, errors: data.errors })));

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
  }, [fetchAllSettings]);

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
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    if (!masterSettings) return null;

    const SYNCABLE_KEYS = ['filtering', 'querylogConfig', 'statsConfig', 'rewrites', 'blockedServices', 'accessList'];

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
                                <button onClick={() => setExpandedCategory(prev => (prev === key ? null : key))} className="flex-grow text-left flex items-center gap-2">
                                    <span>{key}</span>
                                    <span>{expandedCategory === key ? '▼' : '▶'}</span>
                                </button>
                                <button
                                    onClick={() => handleSync(ip, key)}
                                    className="px-3 py-1 text-xs text-primary border border-neon rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                                    disabled={isSyncing}
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
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const lastLogsLengthRef = useRef(logs.length);

    // Handle scroll events to detect if user has scrolled up
    const handleScroll = () => {
      if (logsContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
        // If user is not at the bottom, stop auto-scrolling
        shouldAutoScrollRef.current = scrollTop + clientHeight >= scrollHeight - 50;
      }
    };

    useEffect(() => {
      // Only auto-scroll if logs were added (not just on initial render)
      const logsWereAdded = logs.length > lastLogsLengthRef.current;
      lastLogsLengthRef.current = logs.length;

      if (logsWereAdded && shouldAutoScrollRef.current && logsEndRef.current) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        });
      }
    }, [logs]);

    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-primary-dark rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl leading-none">&times;</button>
          </div>
          <div
            ref={logsContainerRef}
            className="flex-grow p-4 overflow-y-auto font-mono text-sm text-gray-300 bg-gray-950 rounded-b-lg"
            onScroll={handleScroll}
          >
            {logs.length === 0 ? (
              <div className="text-gray-500 italic">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`mb-1 leading-relaxed ${log.includes('ERROR') || log.includes('FATAL') || log.includes('Failed') ? 'text-danger' : log.includes('Successfully') || log.includes('completed') || log.includes('Synced') ? 'text-green-400' : ''}`}>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
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
      <div className="text-center text-gray-400 mb-8">
        Comparing all servers against master: <strong className="text-primary font-mono">{masterServerIp || 'Not Set'}</strong>
      </div>

      {isLoading && <p className="text-center text-primary">Loading all server settings for comparison...</p>}
      {error && <p className="text-center text-danger p-4 bg-danger-dark rounded-lg">{error}</p>}

      {!isLoading && !error && (
        <div className="text-center mb-8">
          <button
            onClick={handleSyncAll}
            className="px-4 py-2 font-bold text-primary bg-gray-800 rounded-lg border-neon border hover:bg-gray-700 transition-all duration-300 shadow-neon disabled:opacity-50"
            disabled={!!syncAllProgress}
          >
            {syncAllProgress || 'Sync All'}
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-8">
            {Object.entries(replicaSettings).map(([ip, settings]) => (
                <ComparisonCard key={ip} ip={ip} settings={settings} />
            ))}
        </div>
      )}
    </div>
  );
}
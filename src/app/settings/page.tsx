"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { useTheme } from "../contexts/ThemeContext";
import { AutoSyncConfig, SyncInterval, SyncCategory } from "@/types/auto-sync";
import { getConnectionId, type Connection } from "@/lib/connectionUtils";

type FormState = {
  target: string;
  port: number;
  username: string;
  password: string;
  allowInsecure: boolean;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [form, setForm] = useState<FormState>({ target: "", port: 80, username: "", password: "", allowInsecure: false });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [masterServerIp, setMasterServerIp] = useState<string | null>(null);
  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig>({
    enabled: false,
    interval: 'disabled',
    categories: [],
  });
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/get-connections');
      if (!response.ok) {
        throw new Error('Failed to fetch settings.');
      }
      const data = await response.json();
      setConnections(data.connections || []);
      setMasterServerIp(data.masterServerIp || null);
    } catch (error) {
      const err = error as Error;
      showNotification(`Error fetching settings: ${err.message}`, 'error');
    }
  }, []);

  const fetchAutoSyncConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-sync-config');
      if (!response || !response.ok) {
        throw new Error('Failed to fetch auto-sync config.');
      }
      const data = await response.json();
      setAutoSyncConfig(data.config);
      setLastSyncTime(data.config?.lastSync || null);
      setNextSyncTime(data.nextSync || null);
      setIsPaused(data.isPaused || false);
    } catch (error) {
      const err = error as Error;
      console.error(`Error fetching auto-sync config: ${err.message}`);
      // Keep default values if fetch fails
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchAutoSyncConfig();
    
    // Refresh auto-sync status every 30 seconds
    const interval = setInterval(fetchAutoSyncConfig, 30000);
    return () => clearInterval(interval);
  }, [fetchSettings, fetchAutoSyncConfig]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const saveSettingsToServer = async (conns: Connection[], masterIp: string | null) => {
    try {
      const response = await fetch('/api/save-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connections: conns, masterServerIp: masterIp }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings.');
      }
    } catch (error) {
        const err = error as Error;
        showNotification(`Error saving settings: ${err.message}`, 'error');
    }
  };

  const saveConnections = (conns: Connection[]) => {
    setConnections(conns);
    saveSettingsToServer(conns, masterServerIp);
  };

  const handleTest = async (conn: Connection, quiet = false): Promise<boolean> => {
    let decrypted = "";
    try {
      decrypted = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
    } catch {
      if (!quiet) showNotification("Failed to decrypt password for testing.", 'error');
      return false;
    }

    try {
    const res = await fetch("/api/check-adguard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...conn, password: decrypted }),
    });
        const data = await res.json();
    if (data.status === 'connected') {
      if (!quiet) showNotification(`Successfully connected to ${conn.url || (conn.ip ? `${conn.ip}:${conn.port}` : 'target')}`, 'success');
            return true;
        } else {
      if (!quiet) showNotification(`Connection failed for ${conn.url || (conn.ip ? `${conn.ip}:${conn.port}` : 'target')}: ${data.response || 'Unknown error'}`, 'error');
            return false;
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (!quiet) showNotification(`Network error testing connection for ${conn.ip}: ${message}`, 'error');
        return false;
    }
  };

  const handleSave = async () => {
    if (!form.target || !form.username) return;

    const isUpdating = editingIndex !== null;
    const connectionDetails: Partial<Connection> = {
      username: form.username,
      allowInsecure: form.allowInsecure,
    };

    if (form.password) {
      connectionDetails.password = CryptoJS.AES.encrypt(form.password, encryptionKey).toString();
    } else if (!isUpdating) {
      showNotification("Password is required for new connections.", 'error');
      return;
    }

    if (typeof form.target === "string" && form.target.startsWith('http')) {
      connectionDetails.url = form.target;
      try {
        const parsed = new URL(form.target);
        connectionDetails.port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
      } catch {
        connectionDetails.port = form.port;
      }
    } else {
      const [host, port] = form.target.split(':');
      if (host && port && !isNaN(parseInt(port, 10))) {
        connectionDetails.ip = host;
        connectionDetails.port = parseInt(port, 10);
      } else {
        connectionDetails.ip = form.target;
        connectionDetails.port = form.port;
      }
    }

    const newConnections = [...connections];
    let newConnection: Connection;

    if (isUpdating) {
      const oldConnection = newConnections[editingIndex as number];
      newConnection = { ...oldConnection, ...connectionDetails } as Connection;
      if (connectionDetails.url) newConnection.ip = undefined;
      if (connectionDetails.ip) newConnection.url = undefined;
      newConnections[editingIndex as number] = newConnection;
    } else {
      newConnection = connectionDetails as Connection;
      newConnections.push(newConnection);
    }

    saveConnections(newConnections);

    showNotification(`Connection ${isUpdating ? 'updated' : 'saved'}. Testing...`, 'success');
    const testSuccess = await handleTest(newConnection, true);

    if(testSuccess) {
      showNotification(`Connection to ${newConnection.url || (newConnection.ip ? `${newConnection.ip}:${newConnection.port}` : 'target')} successful!`, 'success');
    } else {
      showNotification(`Could not connect to ${newConnection.url || (newConnection.ip ? `${newConnection.ip}:${newConnection.port}` : 'target')} after saving. Please check details.`, 'error');
    }

    setEditingIndex(null);
    setForm({ target: "", port: 80, username: "", password: "", allowInsecure: false });
  };

  const handleEdit = (index: number) => {
    const connToEdit = connections[index];
    setForm({
  target: connToEdit.url ? connToEdit.url : (connToEdit.ip || ""),
  port: connToEdit.port || 80,
  username: connToEdit.username,
  password: "", // Keep password field blank for security
  allowInsecure: connToEdit.allowInsecure || false,
    });
    setEditingIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  setForm({ target: "", port: 80, username: "", password: "", allowInsecure: false });
  };

  const handleSetMaster = (conn: Connection) => {
    // Normalize the identifier: prefer URL, fallback to ip:port
    const masterId = getConnectionId(conn);
    
    if (!masterId) {
      showNotification('Cannot set master: connection has no valid identifier', 'error');
      return;
    }
    
    setMasterServerIp(masterId);
    saveSettingsToServer(connections, masterId);
    showNotification(`${masterId} is now the master server for sync.`, 'success');
  };

  const handleDelete = (idx: number) => {
    const newConns = connections.filter((_, i) => i !== idx);
    saveConnections(newConns);
  };

  const handleAutoSyncUpdate = async (updates: Partial<AutoSyncConfig>) => {
    try {
      const response = await fetch('/api/auto-sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update auto-sync config');
      }
      
      const data = await response.json();
      setAutoSyncConfig(data.config);
      showNotification('Auto-sync configuration updated successfully', 'success');
      fetchAutoSyncConfig(); // Refresh to get latest status
    } catch (error) {
      const err = error as Error;
      showNotification(`Error updating auto-sync config: ${err.message}`, 'error');
    }
  };

  const toggleCategory = (category: SyncCategory) => {
    const newCategories = autoSyncConfig.categories.includes(category)
      ? autoSyncConfig.categories.filter(c => c !== category)
      : [...autoSyncConfig.categories, category];
    handleAutoSyncUpdate({ categories: newCategories });
  };

  const handlePauseResume = async () => {
    try {
      const action = isPaused ? 'resume' : 'pause';
      const response = await fetch('/api/auto-sync-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} auto-sync`);
      }

      const data = await response.json();
      setIsPaused(data.paused);
      showNotification(data.message, 'success');
      fetchAutoSyncConfig(); // Refresh status
    } catch (error) {
      const err = error as Error;
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff < 0) {
      const ago = Math.abs(diff);
      const minutes = Math.floor(ago / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return 'Just now';
    } else {
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
      return 'Soon';
    }
  };

  const intervalOptions: { value: SyncInterval; label: string }[] = [
    { value: 'disabled', label: 'Disabled' },
    { value: '5min', label: 'Every 5 minutes' },
    { value: '15min', label: 'Every 15 minutes' },
    { value: '30min', label: 'Every 30 minutes' },
    { value: '1hour', label: 'Every hour' },
    { value: '2hour', label: 'Every 2 hours' },
    { value: '6hour', label: 'Every 6 hours' },
    { value: '12hour', label: 'Every 12 hours' },
    { value: '24hour', label: 'Every 24 hours' },
  ];

  const categoryOptions: { value: SyncCategory; label: string }[] = [
    { value: 'filtering', label: 'Filtering (Blocklists & Rules)' },
    { value: 'querylogConfig', label: 'Query Log Configuration' },
    { value: 'statsConfig', label: 'Statistics Configuration' },
    { value: 'dnsSettings', label: 'DNS Settings' },
    { value: 'rewrites', label: 'DNS Rewrites' },
    { value: 'blockedServices', label: 'Blocked Services' },
    { value: 'accessList', label: 'Access Lists' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-8 dashboard-bg rounded-xl shadow-xl relative">
      {notification && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg text-white z-50
          ${notification.type === 'success' ? 'bg-primary-dark text-primary' : 'bg-danger-dark text-danger'}`}
        >
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-4 font-bold">X</button>
        </div>
      )}
      <NavMenu />
      <h1 className="text-3xl font-extrabold mb-8 text-center dashboard-title">Settings</h1>
      <div className="mb-10 adguard-card">
        <h2 className="font-semibold mb-4 card-title">{editingIndex !== null ? 'Edit Connection' : 'New Connection'}</h2>
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="IP or URL (include http:// or https:// for URLs)"
              value={form.target}
              onChange={e => {
                const val = e.target.value;
                setForm(f => {
                  let newPort = f.port;
                  try {
                    const parsed = new URL(val);
                    if (parsed.port) {
                      newPort = parseInt(parsed.port, 10);
                    } else if (parsed.protocol === 'https:') {
                      newPort = 443;
                    } else if (parsed.protocol === 'http:') {
                      newPort = 80;
                    }
                  } catch {
                    // not a full URL; if user types starting with 'https' assume 443
                    if (String(val).startsWith('https')) {
                      newPort = 443;
                    }
                  }
                  return { ...f, target: val, port: newPort };
                });
              }}
              className="flex-grow px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
            />
            <input
              type="number"
              placeholder="Port"
              value={form.port}
              onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value, 10) || 0 }))}
              className="w-24 px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
            />
          </div>
          {/* Full URL input removed — single 'target' field covers IP or full URL */}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.allowInsecure} onChange={e => setForm(f => ({ ...f, allowInsecure: e.target.checked }))} />
            <span className="text-sm text-primary">Allow insecure SSL (accept self-signed certificates)</span>
          </label>
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            className="px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={editingIndex !== null ? "New Password (optional)" : "Password"}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon w-full"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <div className="flex gap-4">
            {editingIndex !== null && (
                <button onClick={handleCancelEdit} className="px-6 py-3 rounded-lg font-bold text-lg w-full bg-gray-600 hover:bg-gray-700 text-white transition-colors">Cancel</button>
            )}
            <button onClick={handleSave} className="px-6 py-3 rounded-lg font-bold text-lg w-full text-primary border border-neon shadow-neon hover:bg-gray-800 transition-colors">
                {editingIndex !== null ? 'Update' : 'Save'}
            </button>
        </div>
      </div>
      <div className="adguard-card">
        <h2 className="font-semibold mb-4 card-title">Saved Connections</h2>
        <ul className="space-y-4">
          {connections.map((conn, idx) => (
            <li key={idx} className="flex items-center gap-4 bg-gray-900 rounded-lg px-4 py-3 shadow-neon border border-neon">
              <span className="font-mono text-primary">{conn.url && conn.url.length > 0 ? conn.url : `${conn.ip || 'unknown'}:${conn.port || ''}`}</span>
              <span className="text-primary">{conn.username}</span>
              <div className="ml-auto flex gap-2 items-center">
                <button onClick={() => handleSetMaster(conn)} title="Set as master for sync">
                  <svg className={`w-5 h-5 transition-colors ${masterServerIp === getConnectionId(conn) ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
                <button onClick={() => handleEdit(idx)} className="px-3 py-1 rounded text-xs text-primary border border-neon hover:bg-gray-800 transition-colors">Edit</button>
                <button onClick={() => handleTest(conn)} className="px-3 py-1 rounded text-xs text-primary border border-neon hover:bg-gray-800 transition-colors">Test</button>
                <button onClick={() => handleDelete(idx)} className="px-3 py-1 rounded text-xs text-danger border border-danger hover:bg-danger-dark transition-colors">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 adguard-card">
        <h2 className="font-semibold mb-4 card-title">Automatic Sync</h2>
        
        {/* Beta Warning */}
        <div className="mb-4 p-3 bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-yellow-500 font-semibold text-sm">BETA Feature</p>
              <p className="text-gray-300 text-xs mt-1">
                This is a new feature currently in beta testing. Please report any issues you encounter.
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-gray-400 text-sm mb-4">
          Configure automatic synchronization of settings from the master server to all replica servers.
        </p>
        
        <div className="mb-6 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSyncConfig?.enabled || false}
              onChange={(e) => handleAutoSyncUpdate({ enabled: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="text-primary font-semibold">Enable Automatic Sync</span>
          </label>
        </div>

        {autoSyncConfig?.enabled && (
          <div className="space-y-6">
            <div>
              <label className="block text-primary font-semibold mb-2">Sync Interval</label>
              <select
                value={autoSyncConfig.interval}
                onChange={(e) => handleAutoSyncUpdate({ interval: e.target.value as SyncInterval })}
                className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary"
              >
                {intervalOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-primary font-semibold mb-2">Categories to Sync</label>
              <div className="space-y-2">
                {categoryOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={autoSyncConfig.categories.includes(option.value)}
                      onChange={() => toggleCategory(option.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-primary">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Last Sync:</span>
                  <span className="ml-2 text-primary font-semibold">{formatTime(lastSyncTime)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Next Sync:</span>
                  <span className="ml-2 text-primary font-semibold">
                    {autoSyncConfig.interval === 'disabled' ? 'N/A' : formatTime(nextSyncTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pause/Resume Control */}
            {autoSyncConfig?.enabled && autoSyncConfig.interval !== 'disabled' && (
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-primary font-semibold mb-1">Scheduler Control</p>
                    <p className="text-gray-400 text-sm">
                      {isPaused 
                        ? 'Auto-sync is paused. Resume to continue scheduled syncs.'
                        : 'Auto-sync is active. Pause to temporarily stop scheduled syncs.'}
                    </p>
                  </div>
                  <button
                    onClick={handlePauseResume}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all ml-4 ${
                      isPaused
                        ? 'bg-primary text-black hover:bg-green-400 hover:shadow-lg hover:shadow-primary/50'
                        : 'bg-yellow-600 text-white hover:bg-yellow-500 hover:shadow-lg'
                    }`}
                  >
                    {isPaused ? (
                      <>
                        <span className="mr-2">▶</span>
                        Resume
                      </>
                    ) : (
                      <>
                        <span className="mr-2">⏸</span>
                        Pause
                      </>
                    )}
                  </button>
                </div>
                
                {isPaused && (
                  <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                    <p className="text-yellow-400 text-sm flex items-center">
                      <span className="mr-2">⚠️</span>
                      Scheduler is paused - no automatic syncs will occur until resumed
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!autoSyncConfig?.enabled && (
          <p className="text-gray-500 text-sm italic">
            Enable automatic sync to synchronize your master server settings to all replicas on a schedule.
          </p>
        )}
      </div>

      <div className="mt-10 adguard-card">
        <h2 className="font-semibold mb-4 card-title">Theme</h2>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setTheme('green')}
            className={`px-4 py-2 font-bold rounded-lg border transition-all duration-300
              ${theme === 'green' ? 'shadow-neon border-neon text-primary' : 'border-gray-600 text-gray-400'}`}
          >
            Green
          </button>
          <button
            onClick={() => setTheme('purple')}
            className={`px-4 py-2 font-bold rounded-lg border transition-all duration-300
              ${theme === 'purple' ? 'shadow-neon border-neon text-primary' : 'border-gray-600 text-gray-400'}`}
          >
            Purple
          </button>
          <button
            onClick={() => setTheme('orange')}
            className={`px-4 py-2 font-bold rounded-lg border transition-all duration-300
              ${theme === 'orange' ? 'shadow-neon border-neon text-primary' : 'border-gray-600 text-gray-400'}`}
          >
            Orange
          </button>
        </div>
      </div>
    </div>
  );
}
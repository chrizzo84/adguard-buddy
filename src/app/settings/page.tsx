"use client";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { useTheme } from "../contexts/ThemeContext";
import { AutoSyncConfig, SyncInterval, SyncCategory } from "@/types/auto-sync";
import { getConnectionId, type Connection } from "@/lib/connectionUtils";
import { Plus, Edit2, Trash2, TestTube, Star, Eye, EyeOff, Clock, Layers, Play, Pause, AlertTriangle, X, Check } from "lucide-react";

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
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
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
      if (!response.ok) throw new Error('Failed to fetch settings.');
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
      if (!response || !response.ok) throw new Error('Failed to fetch auto-sync config.');
      const data = await response.json();
      setAutoSyncConfig(data.config);
      setLastSyncTime(data.config?.lastSync || null);
      setNextSyncTime(data.nextSync || null);
      setIsPaused(data.isPaused || false);
    } catch (error) {
      console.error(`Error fetching auto-sync config:`, error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchAutoSyncConfig();
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
      if (!quiet) showNotification(`Network error testing connection: ${message}`, 'error');
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

    if (testSuccess) {
      showNotification(`Connection to ${newConnection.url || (newConnection.ip ? `${newConnection.ip}:${newConnection.port}` : 'target')} successful!`, 'success');
    } else {
      showNotification(`Could not connect to ${newConnection.url || (newConnection.ip ? `${newConnection.ip}:${newConnection.port}` : 'target')} after saving.`, 'error');
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
      password: "",
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
      if (!response.ok) throw new Error('Failed to update auto-sync config');
      const data = await response.json();
      setAutoSyncConfig(data.config);
      showNotification('Auto-sync configuration updated successfully', 'success');
      fetchAutoSyncConfig();
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
      if (!response.ok) throw new Error(`Failed to ${action} auto-sync`);
      const data = await response.json();
      setIsPaused(data.paused);
      showNotification(data.message, 'success');
      fetchAutoSyncConfig();
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
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return 'Just now';
    } else {
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `in ${hours}h`;
      if (minutes > 0) return `in ${minutes}m`;
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
    <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full relative">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 ${notification.type === 'success'
          ? 'bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
          {notification.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage connections, auto-sync, and appearance.</p>
      </header>

      {/* Add/Edit Connection Form */}
      <div className="adguard-card mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          {editingIndex !== null ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {editingIndex !== null ? 'Edit Connection' : 'New Connection'}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">IP or URL</label>
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
                      if (parsed.port) newPort = parseInt(parsed.port, 10);
                      else if (parsed.protocol === 'https:') newPort = 443;
                      else if (parsed.protocol === 'http:') newPort = 80;
                    } catch {
                      if (String(val).startsWith('https')) newPort = 443;
                    }
                    return { ...f, target: val, port: newPort };
                  });
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Port</label>
              <input
                type="number"
                placeholder="Port"
                value={form.port}
                onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value, 10) || 0 }))}
                className="w-full"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allowInsecure}
              onChange={e => setForm(f => ({ ...f, allowInsecure: e.target.checked }))}
              className="w-4 h-4 rounded border-[#2A2D35] bg-[#0F1115] text-[var(--primary)]"
            />
            Allow insecure SSL (accept self-signed certificates)
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Username</label>
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                {editingIndex !== null ? "New Password (optional)" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={editingIndex !== null ? "Leave blank to keep existing" : "Password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {editingIndex !== null && (
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-3 rounded-lg font-medium text-gray-400 bg-[#0F1115] border border-[#2A2D35] hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 rounded-lg font-medium text-black bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-colors"
            >
              {editingIndex !== null ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Saved Connections */}
      <div className="adguard-card mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Saved Connections
        </h2>
        {connections.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No connections configured yet.</p>
        ) : (
          <div className="space-y-3">
            {connections.map((conn, idx) => {
              const connId = getConnectionId(conn);
              const isMaster = masterServerIp === connId;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${isMaster
                    ? 'bg-[var(--primary)]/5 border-[var(--primary)]/30'
                    : 'bg-[#0F1115] border-[#2A2D35]'
                    }`}
                >
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-300 truncate">
                        {conn.url && conn.url.length > 0 ? conn.url : `${conn.ip || 'unknown'}:${conn.port || ''}`}
                      </span>
                      {isMaster && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                          Master
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{conn.username}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleSetMaster(conn)}
                      title="Set as master for sync"
                      className={`p-2 rounded-lg transition-colors ${isMaster
                        ? 'text-yellow-400'
                        : 'text-gray-500 hover:text-yellow-400 hover:bg-white/5'
                        }`}
                    >
                      <Star className="w-5 h-5" fill={isMaster ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => handleEdit(idx)}
                      className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleTest(conn)}
                      className="p-2 rounded-lg text-gray-500 hover:text-[var(--primary)] hover:bg-white/5 transition-colors"
                    >
                      <TestTube className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-Sync Configuration */}
      <div className="adguard-card mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Automatic Sync
        </h2>

        {/* Beta Warning */}
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium text-sm">BETA Feature</p>
            <p className="text-gray-400 text-xs mt-1">This is a new feature currently in beta testing.</p>
          </div>
        </div>

        <p className="text-gray-500 text-sm mb-4">
          Configure automatic synchronization from the master server to all replicas.
        </p>

        <label className="flex items-center gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSyncConfig?.enabled || false}
            onChange={(e) => handleAutoSyncUpdate({ enabled: e.target.checked })}
            className="w-5 h-5 rounded border-[#2A2D35] bg-[#0F1115] text-[var(--primary)]"
          />
          <span className="text-white font-medium">Enable Automatic Sync</span>
        </label>

        {autoSyncConfig?.enabled && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Sync Interval</label>
              <select
                value={autoSyncConfig.interval}
                onChange={(e) => handleAutoSyncUpdate({ interval: e.target.value as SyncInterval })}
                className="w-full md:w-64"
              >
                {intervalOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Categories to Sync</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {categoryOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={autoSyncConfig.categories.includes(option.value)}
                      onChange={() => toggleCategory(option.value)}
                      className="w-4 h-4 rounded border-[#2A2D35] bg-[#0F1115] text-[var(--primary)]"
                    />
                    <span className="text-gray-300 text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Last Sync</span>
                <p className="text-[var(--primary)] font-semibold">{formatTime(lastSyncTime)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Next Sync</span>
                <p className="text-[var(--primary)] font-semibold">
                  {autoSyncConfig.interval === 'disabled' ? 'N/A' : formatTime(nextSyncTime)}
                </p>
              </div>
            </div>

            {autoSyncConfig.interval !== 'disabled' && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#0F1115] border border-[#2A2D35]">
                <div>
                  <p className="text-white font-medium">Scheduler Control</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {isPaused ? 'Auto-sync is paused.' : 'Auto-sync is active.'}
                  </p>
                </div>
                <button
                  onClick={handlePauseResume}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${isPaused
                    ? 'bg-[var(--primary)] text-black hover:bg-[var(--primary-dark)]'
                    : 'bg-yellow-600 text-white hover:bg-yellow-500'
                    }`}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theme Selection */}
      <div className="adguard-card">
        <h2 className="text-lg font-semibold text-white mb-4">Theme</h2>
        <div className="flex gap-3">
          {(['green', 'purple', 'orange'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-6 py-3 rounded-lg font-medium capitalize transition-all ${theme === t
                ? 'text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30 shadow-[0_0_15px_var(--primary-light)]'
                : 'text-gray-400 border border-[#2A2D35] hover:border-gray-500'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
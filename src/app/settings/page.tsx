"use client";
import NavMenu from "../components/NavMenu";
import { useState, useEffect, useCallback } from "react";
import CryptoJS from "crypto-js";
import { useTheme } from "../contexts/ThemeContext";

type Connection = {
  ip?: string;
  url?: string; // full URL including scheme (http/https)
  port?: number;
  username: string;
  password: string; // encrypted
  allowInsecure?: boolean;
};

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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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

    let newConnection: Connection;
    const isUpdating = editingIndex !== null;

    if (isUpdating) {
      const updatedConnections = [...connections];
      const connectionToUpdate = { ...updatedConnections[editingIndex as number] };

      // store either url or ip depending on target
      if (form.target && String(form.target).startsWith('http')) {
        connectionToUpdate.url = form.target;
        connectionToUpdate.ip = undefined;
      } else {
        connectionToUpdate.ip = form.target;
        connectionToUpdate.url = undefined;
      }
      connectionToUpdate.port = form.port;
      connectionToUpdate.username = form.username;
      connectionToUpdate.allowInsecure = form.allowInsecure;

      if (form.password) {
        connectionToUpdate.password = CryptoJS.AES.encrypt(form.password, encryptionKey).toString();
      }
      updatedConnections[editingIndex as number] = connectionToUpdate;
      newConnection = connectionToUpdate;
      saveConnections(updatedConnections);
    } else {
      if (!form.password) {
        showNotification("Password is required for new connections.", 'error');
        return;
      }
      const encrypted = CryptoJS.AES.encrypt(form.password, encryptionKey).toString();
      if (form.target && String(form.target).startsWith('http')) {
        // extract port from URL if present
        let usePort = form.port;
        try {
          const parsed = new URL(form.target);
          if (parsed.port) usePort = parseInt(parsed.port, 10);
          else usePort = parsed.protocol === 'https:' ? 443 : 80;
        } catch {
          // ignore
        }
        newConnection = { url: form.target, port: usePort, username: form.username, password: encrypted, allowInsecure: form.allowInsecure } as Connection;
      } else {
        newConnection = { ip: form.target, port: form.port, username: form.username, password: encrypted, allowInsecure: form.allowInsecure } as Connection;
      }
      saveConnections([...connections, newConnection]);
    }

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

  const handleSetMaster = (ip: string) => {
    setMasterServerIp(ip);
    saveSettingsToServer(connections, ip);
    showNotification(`${ip} is now the master server for sync.`, 'success');
  };

  const handleDelete = (idx: number) => {
    const newConns = connections.filter((_, i) => i !== idx);
    saveConnections(newConns);
  };

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
                <button onClick={() => handleSetMaster(conn.ip || conn.url || '')} title="Set as master for sync">
                  <svg className={`w-5 h-5 transition-colors ${masterServerIp === conn.ip ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`} viewBox="0 0 20 20" fill="currentColor">
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
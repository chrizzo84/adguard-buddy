"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, PlugZap, Star, Eye, EyeOff, Clock, Layers,
  Play, Pause, Palette, Server, Check,
} from "lucide-react";
import { AutoSyncConfig, SyncInterval, SyncCategory } from "@/types/auto-sync";
import { useTheme, THEMES } from "../contexts/ThemeContext";
import { connectionLabel, useConnections, type PublicConnection } from "../contexts/ConnectionsContext";
import {
  Alert, Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, EmptyState,
  Field, IconButton, PageHeader, useToast,
} from "../components/ui";

type FormState = {
  target: string;
  port: number;
  username: string;
  password: string;
  allowInsecure: boolean;
};

const EMPTY_FORM: FormState = { target: "", port: 80, username: "", password: "", allowInsecure: false };

/** Strips the client-side `id` so the payload matches what the API stores. */
function withoutId(conn: PublicConnection) {
  return {
    ip: conn.ip,
    url: conn.url,
    port: conn.port,
    username: conn.username,
    allowInsecure: conn.allowInsecure,
    color: conn.color,
  };
}

const INTERVALS: { value: SyncInterval; label: string }[] = [
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

const CATEGORIES: { value: SyncCategory; label: string; description: string }[] = [
  { value: 'filtering', label: 'Filtering', description: 'Blocklists, allowlists and custom rules' },
  { value: 'querylogConfig', label: 'Query log', description: 'Retention and logging behaviour' },
  { value: 'statsConfig', label: 'Statistics', description: 'Statistics retention window' },
  { value: 'dnsSettings', label: 'DNS settings', description: 'Upstreams, bootstrap and cache' },
  { value: 'rewrites', label: 'DNS rewrites', description: 'Custom domain to address mappings' },
  { value: 'blockedServices', label: 'Blocked services', description: 'Service-level blocks' },
  { value: 'accessList', label: 'Access lists', description: 'Allowed and disallowed clients' },
  { value: 'clients', label: 'Persistent clients', description: 'Named devices with their own settings' },
];

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const diff = timestamp - Date.now();
  const past = diff < 0;
  const minutes = Math.floor(Math.abs(diff) / 60000);
  const hours = Math.floor(minutes / 60);

  if (past) {
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
  if (hours > 0) return `in ${hours}h`;
  if (minutes > 0) return `in ${minutes}m`;
  return 'Soon';
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { connections, masterServerId, reload } = useConnections();
  const { notify } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PublicConnection | null>(null);

  const [autoSync, setAutoSync] = useState<AutoSyncConfig>({ enabled: false, interval: 'disabled', categories: [] });
  const [nextSync, setNextSync] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const fetchAutoSync = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-sync-config');
      if (!response?.ok) return;
      const data = await response.json();
      if (data.config) setAutoSync(data.config);
      setNextSync(data.nextSync ?? null);
      setPaused(Boolean(data.isPaused));
    } catch {
      /* the settings page stays usable without the scheduler */
    }
  }, []);

  useEffect(() => {
    fetchAutoSync();
    const interval = setInterval(fetchAutoSync, 30000);
    return () => clearInterval(interval);
  }, [fetchAutoSync]);

  /**
   * Sends the whole list; entries without a `password` keep the ciphertext the
   * server already holds, so an edit never has to round-trip a secret.
   */
  const persist = async (
    payload: Array<Omit<Partial<PublicConnection>, 'id'> & { password?: string }>,
    master: string | null,
  ): Promise<boolean> => {
    const response = await fetch('/api/save-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connections: payload, masterServerIp: master }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      notify(body.message || 'Failed to save connections.', 'error');
      return false;
    }
    await reload();
    return true;
  };

  const testConnection = async (connectionId: string, quiet = false): Promise<boolean> => {
    setTestingId(connectionId);
    try {
      const response = await fetch('/api/check-adguard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json().catch(() => ({}));
      const ok = response.ok && data.status === 'connected';
      if (!quiet) {
        notify(
          ok ? `Connected to ${connectionId}` : `Connection failed for ${connectionId}: ${data.message || 'unknown error'}`,
          ok ? 'success' : 'error',
        );
      }
      return ok;
    } catch (err) {
      if (!quiet) notify(`Network error: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return false;
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = async () => {
    if (!form.target || !form.username) {
      notify('Target and username are required.', 'error');
      return;
    }
    if (!editingId && !form.password) {
      notify('A password is required for new connections.', 'error');
      return;
    }

    setSaving(true);
    try {
      const isUrl = form.target.startsWith('http://') || form.target.startsWith('https://');
      let details: Partial<PublicConnection>;

      if (isUrl) {
        let port = form.port;
        try {
          const parsed = new URL(form.target);
          port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
        } catch {
          /* keep the entered port when the URL cannot be parsed */
        }
        details = { url: form.target, ip: undefined, port };
      } else {
        const [host, port] = form.target.split(':');
        details = port && !Number.isNaN(parseInt(port, 10))
          ? { ip: host, url: undefined, port: parseInt(port, 10) }
          : { ip: form.target, url: undefined, port: form.port };
      }

      const entry = {
        ...details,
        username: form.username,
        allowInsecure: form.allowInsecure,
        ...(form.password ? { password: form.password } : {}),
      };

      const existing = connections.map(withoutId);

      const index = editingId ? connections.findIndex(c => c.id === editingId) : -1;
      const next = index >= 0
        ? existing.map((conn, i) => (i === index ? { ...conn, ...entry } : conn))
        : [...existing, entry];

      const saved = await persist(next, masterServerId);
      if (!saved) return;

      notify(`Connection ${editingId ? 'updated' : 'added'}.`, 'success');
      setForm(EMPTY_FORM);
      setEditingId(null);

      const targetId = entry.url ? entry.url.replace(/\/$/, '') : `${entry.ip}${entry.port ? `:${entry.port}` : ''}`;
      const ok = await testConnection(targetId, true);
      notify(
        ok ? `Verified connection to ${targetId}.` : `Saved, but could not reach ${targetId}.`,
        ok ? 'success' : 'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (conn: PublicConnection) => {
    setForm({
      target: conn.url || conn.ip || '',
      port: conn.port || 80,
      username: conn.username,
      password: '',
      allowInsecure: conn.allowInsecure || false,
    });
    setEditingId(conn.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (conn: PublicConnection) => {
    const remaining = connections.filter(c => c.id !== conn.id).map(withoutId);
    const master = masterServerId === conn.id ? null : masterServerId;
    if (await persist(remaining, master)) {
      notify(`Removed ${conn.id}.`, 'success');
      if (editingId === conn.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
    }
  };

  const handleSetMaster = async (conn: PublicConnection) => {
    const payload = connections.map(withoutId);
    if (await persist(payload, conn.id)) {
      notify(`${connectionLabel(conn)} is now the master server.`, 'success');
    }
  };

  const updateAutoSync = async (updates: Partial<AutoSyncConfig>) => {
    try {
      const response = await fetch('/api/auto-sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update auto-sync configuration');
      const data = await response.json();
      setAutoSync(data.config);
      notify('Auto-sync configuration updated.', 'success');
      fetchAutoSync();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const togglePause = async () => {
    const action = paused ? 'resume' : 'pause';
    try {
      const response = await fetch('/api/auto-sync-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(`Failed to ${action} auto-sync`);
      const data = await response.json();
      setPaused(Boolean(data.paused));
      notify(data.message, 'success');
      fetchAutoSync();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Connections, automatic sync and appearance." />

      <Card>
        <CardHeader
          title={editingId ? 'Edit connection' : 'New connection'}
          description={editingId ? `Editing ${editingId}` : 'Point AdGuard Buddy at an AdGuard Home instance.'}
          icon={editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        />

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Field
              label="IP or URL"
              hint="Use a full URL (with http:// or https://) or a bare host."
              className="md:col-span-3"
            >
              {id => (
                <input
                  id={id}
                  type="text"
                  placeholder="192.168.1.10 or https://adguard.local"
                  value={form.target}
                  onChange={e => {
                    const value = e.target.value;
                    setForm(current => {
                      let port = current.port;
                      try {
                        const parsed = new URL(value);
                        port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
                      } catch {
                        if (value.startsWith('https')) port = 443;
                      }
                      return { ...current, target: value, port };
                    });
                  }}
                />
              )}
            </Field>

            <Field label="Port">
              {id => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value, 10) || 0 }))}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Username">
              {id => (
                <input
                  id={id}
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              )}
            </Field>

            <Field
              label={editingId ? 'New password (optional)' : 'Password'}
              hint={editingId ? 'Leave blank to keep the stored password.' : undefined}
            >
              {id => (
                <div className="relative">
                  <input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="!pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] transition-colors hover:text-[var(--text)]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </Field>
          </div>

          <Checkbox
            checked={form.allowInsecure}
            onChange={allowInsecure => setForm(f => ({ ...f, allowInsecure }))}
            label="Allow insecure TLS"
            description="Accept self-signed certificates for this server."
          />

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? 'Update connection' : 'Add connection'}
            </Button>
            {editingId && (
              <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card flush>
        <div className="px-5 pt-5">
          <CardHeader
            title="Saved connections"
            description="The master server is the source of truth for every sync."
            icon={<Layers className="h-4 w-4" />}
          />
        </div>

        {connections.length === 0 ? (
          <EmptyState
            icon={<Server className="h-5 w-5" />}
            title="No connections yet"
            description="Add your first AdGuard Home instance with the form above."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {connections.map(conn => {
              const isMaster = masterServerId === conn.id;
              return (
                <li key={conn.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[13px] text-[var(--text)]" title={conn.id}>
                        {conn.url || `${conn.ip}${conn.port ? `:${conn.port}` : ''}`}
                      </span>
                      {isMaster && <Badge tone="accent" icon={<Star className="h-3 w-3" />}>Master</Badge>}
                      {conn.allowInsecure && <Badge tone="warning">Insecure TLS</Badge>}
                    </div>
                    <span className="text-[12px] text-[var(--text-subtle)]">{conn.username}</span>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    <IconButton
                      icon={<Star className="h-4 w-4" fill={isMaster ? 'currentColor' : 'none'} />}
                      label={isMaster ? 'Current master server' : `Set ${conn.id} as master`}
                      onClick={() => handleSetMaster(conn)}
                      disabled={isMaster}
                      className={isMaster ? '!text-[var(--accent)]' : ''}
                    />
                    <IconButton
                      icon={<PlugZap className="h-4 w-4" />}
                      label={`Test connection to ${conn.id}`}
                      onClick={() => testConnection(conn.id)}
                      loading={testingId === conn.id}
                    />
                    <IconButton
                      icon={<Pencil className="h-4 w-4" />}
                      label={`Edit ${conn.id}`}
                      onClick={() => handleEdit(conn)}
                    />
                    <IconButton
                      icon={<Trash2 className="h-4 w-4" />}
                      label={`Delete ${conn.id}`}
                      onClick={() => setPendingDelete(conn)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Automatic sync"
          description="Push the master configuration to every replica on a schedule."
          icon={<Clock className="h-4 w-4" />}
          actions={<Badge tone="warning">Beta</Badge>}
        />

        {!masterServerId && (
          <Alert tone="warning" title="No master server selected">
            Auto-sync needs a master server. Mark one of your connections with the star icon.
          </Alert>
        )}

        <Checkbox
          checked={autoSync?.enabled || false}
          onChange={enabled => updateAutoSync({ enabled })}
          label="Enable automatic sync"
          description="Runs in the background on the interval below."
        />

        {autoSync?.enabled && (
          <div className="mt-5 space-y-5">
            <Field label="Interval" className="max-w-xs">
              {id => (
                <select
                  id={id}
                  value={autoSync.interval}
                  onChange={e => updateAutoSync({ interval: e.target.value as SyncInterval })}
                >
                  {INTERVALS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </Field>

            <fieldset>
              <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                Categories to sync
              </legend>
              <div className="grid gap-2.5 md:grid-cols-2">
                {CATEGORIES.map(category => (
                  <Checkbox
                    key={category.value}
                    checked={autoSync.categories.includes(category.value)}
                    onChange={() => updateAutoSync({
                      categories: autoSync.categories.includes(category.value)
                        ? autoSync.categories.filter(c => c !== category.value)
                        : [...autoSync.categories, category.value],
                    })}
                    label={category.label}
                    description={category.description}
                  />
                ))}
              </div>
            </fieldset>

            <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                    Last sync
                  </p>
                  <p className="tabular mt-0.5 text-[13px] text-[var(--text)]">
                    {relativeTime(autoSync.lastSync ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
                    Next sync
                  </p>
                  <p className="tabular mt-0.5 text-[13px] text-[var(--text)]">
                    {autoSync.interval === 'disabled' ? 'Not scheduled' : relativeTime(nextSync)}
                  </p>
                </div>
              </div>

              {autoSync.interval !== 'disabled' && (
                <Button
                  onClick={togglePause}
                  variant={paused ? 'primary' : 'secondary'}
                  icon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                >
                  {paused ? 'Resume' : 'Pause'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Appearance"
          description="AdGuard Buddy is dark-only by design; the theme sets the accent colour."
          icon={<Palette className="h-4 w-4" />}
        />
        <div className="flex flex-wrap gap-2">
          {THEMES.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setTheme(name)}
              aria-pressed={theme === name}
              className={`theme-${name} inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border px-3.5 text-[13px] font-medium capitalize transition-colors`}
              style={
                theme === name
                  ? { borderColor: 'var(--accent-border)', background: 'var(--accent-soft)', color: 'var(--accent)' }
                  : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }
              }
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
              {name}
              {theme === name && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete connection"
        tone="danger"
        confirmLabel="Delete"
        description={
          <>
            Remove <span className="font-mono text-[var(--text)]">{pendingDelete?.id}</span> and its stored
            credentials? This does not change anything on the AdGuard Home server itself.
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const conn = pendingDelete;
          setPendingDelete(null);
          if (conn) handleDelete(conn);
        }}
      />
    </div>
  );
}

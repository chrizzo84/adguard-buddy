"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, GitCompare, History, ChevronDown, ChevronRight, Check,
  AlertCircle, Play, Server, ShieldCheck,
} from "lucide-react";
import type { SyncLogEntry, AutoSyncConfig } from "@/types/auto-sync";
import {
  diffCategory, driftedCategories, type DiffItem, type Settings,
} from "@/lib/settingsDiff";
import { useConnections } from "../contexts/ConnectionsContext";
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, Field, LogConsole,
  Modal, PageHeader, Panel, Segmented, StatTile, CardSkeleton, useToast,
} from "../components/ui";

type ReplicaState = { settings?: Settings; errors?: Record<string, string> };

const DIFF_TONE: Record<DiffItem['type'], 'info' | 'warning' | 'danger' | 'accent'> = {
  setting: 'info',
  missing: 'warning',
  extra: 'danger',
  changed: 'accent',
};

const CATEGORY_LABELS: Record<string, string> = {
  filtering: 'Filtering',
  querylogConfig: 'Query log config',
  statsConfig: 'Statistics config',
  dnsSettings: 'DNS settings',
  rewrites: 'DNS rewrites',
  blockedServices: 'Blocked services',
  accessList: 'Access lists',
  clients: 'Persistent clients',
};

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function untilTime(timestamp: number | null): string {
  if (!timestamp) return 'Not scheduled';
  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds < 0) return 'Any moment';
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  return `in ${Math.floor(minutes / 60)}h`;
}

export default function SyncStatusPage() {
  const { connections, masterServerId, isLoading: connectionsLoading } = useConnections();
  const { notify } = useToast();

  const [tab, setTab] = useState<'status' | 'history'>('status');
  const [masterSettings, setMasterSettings] = useState<Settings | null>(null);
  const [replicas, setReplicas] = useState<Record<string, ReplicaState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, string | null>>({});
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [syncModal, setSyncModal] = useState<{ title: string; running: boolean } | null>(null);

  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig | null>(null);
  const [autoSyncLogs, setAutoSyncLogs] = useState<SyncLogEntry[]>([]);
  const [autoSyncRunning, setAutoSyncRunning] = useState(false);
  const [autoSyncPaused, setAutoSyncPaused] = useState(false);
  const [nextSync, setNextSync] = useState<number | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const [filterReplica, setFilterReplica] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');

  const fetchAutoSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auto-sync-config');
      if (!response?.ok) return;
      const data = await response.json();
      if (!data) return;
      setAutoSyncConfig(data.config ?? null);
      setAutoSyncLogs(data.recentLogs || []);
      setAutoSyncRunning(Boolean(data.isRunning));
      setAutoSyncPaused(Boolean(data.isPaused));
      setNextSync(data.nextSync ?? null);
    } catch {
      /* status polling failures are not worth surfacing */
    }
  }, []);

  const fetchAllSettings = useCallback(async () => {
    if (connections.length === 0 || !masterServerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const master = connections.find(c => c.id === masterServerId);
      if (!master) {
        setError('The configured master server no longer exists. Pick a new one in Settings.');
        return;
      }

      const fetchSettings = async (connectionId: string) => {
        const response = await fetch('/api/get-all-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId }),
        });
        if (!response.ok) throw new Error(`Failed to fetch settings for ${connectionId}`);
        return response.json();
      };

      const masterResult = await fetchSettings(master.id);
      setMasterSettings(masterResult.settings);

      const replicaConnections = connections.filter(c => c.id !== masterServerId);
      const results = await Promise.all(replicaConnections.map(async connection => {
        try {
          const data = await fetchSettings(connection.id);
          return { id: connection.id, state: { settings: data.settings, errors: data.errors } as ReplicaState };
        } catch (err) {
          return {
            id: connection.id,
            state: { errors: { request: err instanceof Error ? err.message : String(err) } } as ReplicaState,
          };
        }
      }));

      setReplicas(Object.fromEntries(results.map(r => [r.id, r.state])));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [connections, masterServerId]);

  useEffect(() => {
    if (!connectionsLoading) fetchAllSettings();
  }, [connectionsLoading, fetchAllSettings]);

  useEffect(() => {
    fetchAutoSyncStatus();
    const interval = setInterval(fetchAutoSyncStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchAutoSyncStatus]);

  const runSync = async (replicaId: string, category: string) => {
    if (autoSyncRunning && !autoSyncPaused) {
      notify('Manual sync is disabled while auto-sync is active.', 'error');
      return;
    }
    if (!masterServerId) return;

    const key = `${replicaId}:${category}`;
    setSyncingKey(key);
    setSyncLog([]);
    setSyncModal({ title: `Syncing ${CATEGORY_LABELS[category] ?? category} to ${replicaId}`, running: true });

    try {
      const response = await fetch('/api/sync-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: masterServerId, destinationId: replicaId, category }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Sync failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            setSyncLog(current => [...current, JSON.parse(line.slice(6)).message]);
          } catch {
            /* ignore malformed frames */
          }
        }
      }

      setSyncModal({ title: `Synced ${CATEGORY_LABELS[category] ?? category} to ${replicaId}`, running: false });
      setTimeout(fetchAllSettings, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncLog(current => [...current, `FATAL: ${message}`]);
      setSyncModal({ title: `Failed to sync to ${replicaId}`, running: false });
      notify(message, 'error');
    } finally {
      setSyncingKey(null);
    }
  };

  const triggerAutoSync = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch('/api/auto-sync-trigger', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to trigger auto-sync');
      }
      notify('Auto-sync triggered.', 'success');
      setTimeout(fetchAutoSyncStatus, 2000);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const replicaEntries = useMemo(() => Object.entries(replicas), [replicas]);
  const inSyncCount = useMemo(() => replicaEntries.filter(([, state]) =>
    state.settings && masterSettings && driftedCategories(masterSettings, state.settings).length === 0
  ).length, [replicaEntries, masterSettings]);

  const filteredLogs = autoSyncLogs.filter(log =>
    (filterReplica === 'all' || log.replicaId === filterReplica) &&
    (filterCategory === 'all' || log.category === filterCategory) &&
    (filterStatus === 'all' || log.status === filterStatus)
  );

  const successRate = autoSyncLogs.length > 0
    ? ((autoSyncLogs.filter(l => l.status === 'success').length / autoSyncLogs.length) * 100).toFixed(0)
    : '—';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sync Status"
        description={
          masterServerId
            ? <>Comparing every replica against <span className="font-mono text-[var(--text-muted)]">{masterServerId}</span>.</>
            : 'No master server selected yet.'
        }
        actions={
          tab === 'status' ? (
            <Button
              size="sm"
              onClick={fetchAllSettings}
              disabled={isLoading}
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          ) : undefined
        }
      />

      <Segmented
        label="Sync view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'status', label: 'Drift', icon: <GitCompare className="h-3.5 w-3.5" /> },
          { value: 'history', label: 'Auto-sync history', icon: <History className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'status' && (
        <>
          {error && <Alert tone="danger">{error}</Alert>}

          {autoSyncRunning && !autoSyncPaused && (
            <Alert tone="warning" title="Auto-sync is active">
              Manual sync is disabled while the scheduler runs. Pause it in Settings to sync by hand.
            </Alert>
          )}

          {!masterServerId && !connectionsLoading && (
            <Card>
              <EmptyState
                icon={<Server className="h-5 w-5" />}
                title="No master server selected"
                description="Mark one connection as master in Settings to compare the others against it."
              />
            </Card>
          )}

          {masterServerId && (
            isLoading && replicaEntries.length === 0 ? (
              <div className="space-y-4">
                <CardSkeleton rows={3} height={120} />
                <CardSkeleton rows={3} height={120} />
              </div>
            ) : replicaEntries.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="No replicas configured"
                  description="Add a second connection in Settings to start comparing configurations."
                />
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatTile
                    label="Replicas"
                    value={replicaEntries.length}
                    icon={<Server className="h-4 w-4" />}
                    tone="neutral"
                  />
                  <StatTile
                    label="In sync"
                    value={inSyncCount}
                    icon={<Check className="h-4 w-4" />}
                    tone="success"
                  />
                  <StatTile
                    label="Out of sync"
                    value={replicaEntries.length - inSyncCount}
                    icon={<AlertCircle className="h-4 w-4" />}
                    tone={replicaEntries.length - inSyncCount > 0 ? 'danger' : 'neutral'}
                  />
                  <StatTile
                    label="Next auto-sync"
                    value={autoSyncConfig?.enabled ? untilTime(nextSync) : 'Off'}
                    icon={<RefreshCw className="h-4 w-4" />}
                    tone="info"
                  />
                </div>

                <div className="space-y-4">
                  {replicaEntries.map(([id, state]) => (
                    <ReplicaCard
                      key={id}
                      id={id}
                      state={state}
                      masterSettings={masterSettings}
                      expandedCategory={expanded[id] ?? null}
                      onExpand={category => setExpanded(current => ({ ...current, [id]: category }))}
                      syncingKey={syncingKey}
                      onSync={runSync}
                      syncDisabled={autoSyncRunning && !autoSyncPaused}
                    />
                  ))}
                </div>
              </>
            )
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Scheduler"
              value={autoSyncPaused ? 'Paused' : autoSyncRunning ? 'Active' : 'Inactive'}
              icon={<Play className="h-4 w-4" />}
              tone={autoSyncPaused ? 'warning' : autoSyncRunning ? 'success' : 'neutral'}
            />
            <StatTile label="Last run" value={relativeTime(autoSyncConfig?.lastSync ?? null)} tone="neutral" />
            <StatTile label="Next run" value={untilTime(nextSync)} tone="neutral" />
            <StatTile
              label="Success rate"
              value={successRate}
              unit={successRate === '—' ? undefined : '%'}
              tone="accent"
            />
          </div>

          <Card>
            <CardHeader
              title="Run now"
              description="Runs the configured categories against every replica immediately."
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={triggerAutoSync}
                  loading={isTriggering}
                  disabled={!autoSyncConfig?.enabled || autoSyncPaused}
                  icon={<Play className="h-4 w-4" />}
                >
                  Trigger sync
                </Button>
              }
            />
            {!autoSyncConfig?.enabled && (
              <p className="text-[13px] text-[var(--text-subtle)]">
                Auto-sync is disabled. Enable it in Settings to use this.
              </p>
            )}
          </Card>

          <Card flush>
            <div className="px-5 pt-5">
              <CardHeader
                title={`Sync history (${filteredLogs.length})`}
                description="Newest first, up to the last 50 runs."
              />
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <Field label="Replica">
                  {id => (
                    <select id={id} value={filterReplica} onChange={e => setFilterReplica(e.target.value)}>
                      <option value="all">All replicas</option>
                      {Array.from(new Set(autoSyncLogs.map(l => l.replicaId))).map(replica => (
                        <option key={replica} value={replica}>{replica}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Category">
                  {id => (
                    <select id={id} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                      <option value="all">All categories</option>
                      {Array.from(new Set(autoSyncLogs.map(l => l.category))).map(category => (
                        <option key={category} value={category}>{CATEGORY_LABELS[category] ?? category}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Status">
                  {id => (
                    <select
                      id={id}
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value as 'all' | 'success' | 'error')}
                    >
                      <option value="all">All statuses</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                  )}
                </Field>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="No sync runs recorded"
                description="Entries appear here once auto-sync has run at least once."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {[...filteredLogs].reverse().map((log, index) => (
                  <li key={index} className="flex items-start justify-between gap-4 px-5 py-3">
                    <div className="flex min-w-0 gap-2.5">
                      {log.status === 'success'
                        ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--success)]" aria-hidden="true" />
                        : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--danger)]" aria-hidden="true" />}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[var(--text)]">
                          {CATEGORY_LABELS[log.category] ?? log.category} → {log.replicaId}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-subtle)]">{log.message}</p>
                      </div>
                    </div>
                    <div className="tabular flex-shrink-0 text-right text-[12px] text-[var(--text-subtle)]">
                      <p>{new Date(log.timestamp).toLocaleString()}</p>
                      {log.duration != null && <p>{log.duration} ms</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={syncModal !== null}
        onClose={() => setSyncModal(null)}
        title={syncModal?.title ?? ''}
        subtitle={
          syncModal?.running
            ? 'Filter syncs can take a few minutes while the server downloads lists.'
            : 'Finished'
        }
        size="lg"
      >
        <LogConsole lines={syncLog} running={syncModal?.running ?? false} />
      </Modal>
    </div>
  );
}

function ReplicaCard({
  id, state, masterSettings, expandedCategory, onExpand, syncingKey, onSync, syncDisabled,
}: {
  id: string;
  state: ReplicaState;
  masterSettings: Settings | null;
  expandedCategory: string | null;
  onExpand: (category: string | null) => void;
  syncingKey: string | null;
  onSync: (replicaId: string, category: string) => void;
  syncDisabled: boolean;
}) {
  if (!state.settings) {
    return (
      <Card>
        <CardHeader
          title={<span className="font-mono">{id}</span>}
          actions={<Badge tone="danger">Unreachable</Badge>}
        />
        <div className="space-y-1 text-[12px] text-[var(--text-subtle)]">
          {state.errors
            ? Object.entries(state.errors).map(([key, message]) => (
                <div key={key}>
                  <span className="text-[var(--text-muted)]">{key}:</span> {message}
                </div>
              ))
            : 'No details available.'}
        </div>
      </Card>
    );
  }

  const drift = masterSettings ? driftedCategories(masterSettings, state.settings) : [];
  const inSync = drift.length === 0;

  return (
    <Card>
      <CardHeader
        title={<span className="font-mono">{id}</span>}
        actions={
          inSync
            ? <Badge tone="success" icon={<Check className="h-3 w-3" />}>In sync</Badge>
            : <Badge tone="danger" icon={<AlertCircle className="h-3 w-3" />}>{drift.length} differences</Badge>
        }
      />

      {inSync ? (
        <p className="text-[13px] text-[var(--text-subtle)]">
          Every syncable category matches the master.
        </p>
      ) : (
        <div className="space-y-2">
          {drift.map(category => {
            const key = `${id}:${category}`;
            const isExpanded = expandedCategory === category;
            const diffs = masterSettings
              ? diffCategory(category, masterSettings[category], (state.settings as Settings)[category])
              : [];

            return (
              <div key={category} className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
                <div className="flex items-center justify-between gap-3 bg-[var(--surface-2)] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onExpand(isExpanded ? null : category)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-medium text-[var(--text)]"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-subtle)]" aria-hidden="true" />
                      : <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-subtle)]" aria-hidden="true" />}
                    <span className="truncate">{CATEGORY_LABELS[category] ?? category}</span>
                    {diffs.length > 0 && <Badge tone="neutral">{diffs.length}</Badge>}
                  </button>
                  <Button
                    size="sm"
                    onClick={() => onSync(id, category)}
                    loading={syncingKey === key}
                    disabled={syncDisabled || syncingKey !== null}
                  >
                    Sync
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-2 p-3">
                    {diffs.length === 0 ? (
                      <p className="text-[12px] text-[var(--text-subtle)]">
                        The category differs but no field-level detail is available.
                      </p>
                    ) : diffs.map((diff, index) => (
                      <Panel key={index} className="!p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="truncate text-[13px] text-[var(--text)]">{diff.name}</span>
                          <Badge tone={DIFF_TONE[diff.type]}>{diff.type}</Badge>
                        </div>
                        <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                          <div className="rounded-[var(--radius-sm)] bg-[var(--bg)] p-2">
                            <span className="text-[var(--text-subtle)]">Master</span>
                            <span className="mt-0.5 block truncate font-mono text-[var(--accent)]" title={diff.masterVal}>
                              {diff.masterVal}
                            </span>
                          </div>
                          <div className="rounded-[var(--radius-sm)] bg-[var(--bg)] p-2">
                            <span className="text-[var(--text-subtle)]">Replica</span>
                            <span className="mt-0.5 block truncate font-mono text-[var(--text-muted)]" title={diff.targetVal}>
                              {diff.targetVal}
                            </span>
                          </div>
                        </div>
                      </Panel>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

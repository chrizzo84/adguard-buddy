"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Power, PowerOff, ServerCog, ShieldCheck, Activity, Timer, Server,
  ChevronDown, ChevronRight, AlertCircle,
} from "lucide-react";
import { components } from "../../types/adguard";
import { connectionLabel, useConnections, type PublicConnection } from "../contexts/ConnectionsContext";
import {
  Alert, Badge, Button, Card, CardHeader, EmptyState, IconButton,
  PageHeader, StatTile, StatTileSkeleton, TableSkeleton, useToast,
} from "../components/ui";
import { Sparkline } from "../components/charts";

type AdGuardServerStatus = components['schemas']['ServerStatus'];
type AdGuardStats = components['schemas']['Stats'];

type ServerResult = {
  connection: PublicConnection;
  status: 'connected' | 'error';
  /** Parsed /control/status payload, or null when the server did not answer. */
  info: AdGuardServerStatus | null;
  stats: AdGuardStats | null;
  code?: number;
  message?: string;
};

const numberFormat = new Intl.NumberFormat();

export default function Dashboard() {
  const { connections, isLoading: connectionsLoading } = useConnections();
  const { notify } = useToast();

  const [results, setResults] = useState<ServerResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'enable' | 'disable' | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (connections.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const next = await Promise.all(connections.map(async (connection): Promise<ServerResult> => {
        try {
          const response = await fetch('/api/check-adguard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: connection.id }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return {
              connection,
              status: 'error',
              info: null,
              stats: null,
              code: response.status,
              message: body.message || `Server error ${response.status}`,
            };
          }

          const data = await response.json();
          let info: AdGuardServerStatus | null = null;
          try {
            info = JSON.parse(data.response);
          } catch {
            info = null;
          }

          return {
            connection,
            status: data.status === 'connected' ? 'connected' : 'error',
            info,
            stats: data.stats ?? null,
            code: data.code,
            message: info ? undefined : data.response,
          };
        } catch (err) {
          return {
            connection,
            status: 'error',
            info: null,
            stats: null,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }));
      setResults(next);
    } catch (err) {
      setError('A network error occurred while fetching statuses.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [connections]);

  useEffect(() => {
    if (!connectionsLoading) fetchAll();
  }, [connectionsLoading, fetchAll]);

  const toggleProtection = async (connectionId: string, enabled: boolean) => {
    setUpdatingId(connectionId);
    try {
      const response = await fetch('/api/adguard-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, protection_enabled: enabled }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        notify(`Failed to update ${connectionId}: ${body.message || 'unknown error'}`, 'error');
        return;
      }
      notify(`Protection ${enabled ? 'enabled' : 'disabled'} on ${connectionId}`, 'success');
      await fetchAll();
    } catch {
      notify('A network error occurred while toggling protection.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleAll = async (enabled: boolean) => {
    setBulkAction(enabled ? 'enable' : 'disable');
    try {
      const responses = await Promise.all(connections.map(connection =>
        fetch('/api/adguard-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: connection.id, protection_enabled: enabled }),
        }).catch(() => null)
      ));

      const failed = responses.filter(response => !response || !response.ok).length;
      if (failed > 0) {
        notify(`Failed to update ${failed} of ${connections.length} servers.`, 'error');
      } else {
        notify(`Protection ${enabled ? 'enabled' : 'disabled'} on all servers.`, 'success');
      }
    } finally {
      setBulkAction(null);
      await fetchAll();
    }
  };

  // Fleet-level figures, so ten servers still fit on one screen.
  const totals = useMemo(() => {
    const online = results.filter(r => r.status === 'connected').length;
    const queries = results.reduce((sum, r) => sum + (r.stats?.num_dns_queries || 0), 0);
    const blocked = results.reduce((sum, r) => sum + (r.stats?.num_blocked_filtering || 0), 0);
    const weightedLatency = results.reduce(
      (sum, r) => sum + (r.stats?.avg_processing_time || 0) * (r.stats?.num_dns_queries || 0), 0,
    );
    const unprotected = results.filter(r => r.info && !r.info.protection_enabled).length;
    return {
      online,
      total: results.length,
      queries,
      blocked,
      blockedShare: queries > 0 ? (blocked / queries) * 100 : 0,
      avgLatencyMs: queries > 0 ? (weightedLatency / queries) * 1000 : 0,
      unprotected,
    };
  }, [results]);

  const showSkeleton = (connectionsLoading || isLoading) && results.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Live status across every configured AdGuard Home instance."
        actions={
          <>
            <Button
              size="sm"
              onClick={fetchAll}
              disabled={isLoading}
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => toggleAll(true)}
              loading={bulkAction === 'enable'}
              disabled={connections.length === 0 || bulkAction !== null}
              icon={<Power className="h-4 w-4" />}
            >
              Enable all
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => toggleAll(false)}
              loading={bulkAction === 'disable'}
              disabled={connections.length === 0 || bulkAction !== null}
              icon={<PowerOff className="h-4 w-4" />}
            >
              Disable all
            </Button>
          </>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {totals.unprotected > 0 && (
        <Alert tone="warning" title="Protection is off">
          {totals.unprotected} of {totals.total} servers currently have DNS protection disabled.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)
        ) : (
          <>
            <StatTile
              label="Servers online"
              value={`${totals.online}/${totals.total}`}
              icon={<Server className="h-4 w-4" />}
              tone={totals.online === totals.total && totals.total > 0 ? 'success' : 'warning'}
            />
            <StatTile
              label="DNS queries"
              value={numberFormat.format(totals.queries)}
              icon={<Activity className="h-4 w-4" />}
              tone="accent"
            />
            <StatTile
              label="Blocked"
              value={numberFormat.format(totals.blocked)}
              hint={`${totals.blockedShare.toFixed(1)}%`}
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="danger"
            />
            <StatTile
              label="Avg. processing"
              value={totals.avgLatencyMs.toFixed(1)}
              unit="ms"
              icon={<Timer className="h-4 w-4" />}
              tone="info"
            />
          </>
        )}
      </div>

      <Card flush>
        <div className="px-5 pt-5">
          <CardHeader
            title="Servers"
            description="Expand a row for version, ports and DNS addresses."
            icon={<ServerCog className="h-4 w-4" />}
          />
        </div>

        {showSkeleton ? (
          <TableSkeleton rows={4} />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={<Server className="h-5 w-5" />}
            title="No connections configured"
            description="Add your AdGuard Home instances in Settings to start monitoring them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="w-8" />
                  <th scope="col">Server</th>
                  <th scope="col">Status</th>
                  <th scope="col">Protection</th>
                  <th scope="col" className="num">Queries</th>
                  <th scope="col" className="num">Blocked</th>
                  <th scope="col">Trend</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map(result => (
                  <ServerRow
                    key={result.connection.id}
                    result={result}
                    expanded={expandedId === result.connection.id}
                    onToggleExpanded={() =>
                      setExpandedId(current => current === result.connection.id ? null : result.connection.id)}
                    updating={updatingId === result.connection.id}
                    onToggleProtection={toggleProtection}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ServerRow({
  result, expanded, onToggleExpanded, updating, onToggleProtection,
}: {
  result: ServerResult;
  expanded: boolean;
  onToggleExpanded: () => void;
  updating: boolean;
  onToggleProtection: (id: string, enabled: boolean) => void;
}) {
  const { connection, info, stats, status } = result;
  const protectionOn = info?.protection_enabled ?? false;
  const queries = stats?.num_dns_queries || 0;
  const blocked = stats?.num_blocked_filtering || 0;
  // Daily buckets when the server keeps statistics for longer than 24h.
  const daily = stats?.time_units === 'days';
  const trend = Array.isArray(stats?.dns_queries) ? stats!.dns_queries!.slice(daily ? -7 : -24) : [];
  const trendSpan = daily ? 'last 7 days' : 'last 24 hours';

  return (
    <>
      <tr>
        <td>
          <IconButton
            icon={expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            label={expanded ? `Collapse ${connection.id}` : `Expand ${connection.id}`}
            onClick={onToggleExpanded}
          />
        </td>
        <td>
          <span className="block max-w-[240px] truncate font-mono text-[13px] text-[var(--text)]" title={connection.id}>
            {connectionLabel(connection)}
          </span>
          <span className="text-[12px] text-[var(--text-subtle)]">{connection.username}</span>
        </td>
        <td>
          {status === 'connected' ? (
            <Badge tone="success" dot pulse>Connected</Badge>
          ) : (
            <Badge tone="danger" dot>Error</Badge>
          )}
        </td>
        <td>
          {info ? (
            <Badge tone={protectionOn ? 'success' : 'danger'}>{protectionOn ? 'Active' : 'Disabled'}</Badge>
          ) : (
            <span className="text-[var(--text-subtle)]">—</span>
          )}
        </td>
        <td className="num text-[var(--text)]">{queries ? numberFormat.format(queries) : '—'}</td>
        <td className="num">
          {blocked ? (
            <>
              <span className="text-[var(--text)]">{numberFormat.format(blocked)}</span>
              <span className="ml-1.5 text-[var(--text-subtle)]">
                {queries > 0 ? `${((blocked / queries) * 100).toFixed(0)}%` : ''}
              </span>
            </>
          ) : '—'}
        </td>
        <td>
          {trend.length > 1 ? (
            <span className="flex items-center gap-2" title={`Queries, ${trendSpan}`}>
              <Sparkline values={trend} ariaLabel={`Query trend for ${connection.id}, ${trendSpan}`} />
              <span className="text-[12px] text-[var(--text-subtle)]">{daily ? '7d' : '24h'}</span>
            </span>
          ) : <span className="text-[var(--text-subtle)]">—</span>}
        </td>
        <td className="text-right">
          {info && (
            <Button
              size="sm"
              variant={protectionOn ? 'danger' : 'secondary'}
              loading={updating}
              onClick={() => onToggleProtection(connection.id, !protectionOn)}
            >
              {protectionOn ? 'Disable' : 'Enable'}
            </Button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} style={{ background: 'var(--surface-2)' }}>
            {info ? <ServerDetails info={info} httpCode={result.code} /> : (
              <div className="flex items-start gap-2 py-2 text-[13px] text-[var(--danger)]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="break-all">{result.message || 'The server did not return a readable status.'}</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ServerDetails({ info, httpCode }: { info: AdGuardServerStatus; httpCode?: number }) {
  const rows: [string, React.ReactNode][] = [
    ['Version', info.version || '—'],
    ['Language', info.language || '—'],
    ['DNS port', info.dns_port ?? '—'],
    ['HTTP port', info.http_port ?? '—'],
    ['Running', info.running ? 'Yes' : 'No'],
    ['DHCP', info.dhcp_available ? 'Available' : 'Not available'],
    ['HTTP status', httpCode ?? '—'],
  ];

  return (
    <div className="grid gap-5 py-2 lg:grid-cols-2">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-[var(--border)] pb-1.5">
            <dt className="text-[var(--text-subtle)]">{label}</dt>
            <dd className="tabular font-mono text-[var(--text)]">{value}</dd>
          </div>
        ))}
      </dl>

      {Array.isArray(info.dns_addresses) && info.dns_addresses.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">
            DNS addresses
          </p>
          <div className="flex flex-wrap gap-1.5">
            {info.dns_addresses.map((address, index) => (
              <span
                key={index}
                className="select-all rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-[12px] text-[var(--text-muted)]"
              >
                {address}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

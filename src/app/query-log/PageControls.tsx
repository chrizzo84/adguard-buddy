import React from 'react';
import { Server, Users, Clock, Layers } from 'lucide-react';

type Props = {
  mode: 'single' | 'combined';
  setMode: (m: 'single' | 'combined') => void;
  connectionsCount: number;
  selectedId: string;
  onSelectId: (id: string) => void;
  refreshInterval: number;
  onSetRefreshInterval: (n: number) => void;
  concurrency: number;
  setConcurrency: (n: number) => void;
  perServerLimit: number;
  setPerServerLimit: (n: number) => void;
  combinedMax: number;
  setCombinedMax: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  connections: { ip?: string; url?: string; port?: number; username: string }[];
};

const PageControls = React.memo(function PageControls(props: Props) {
  const intervalOptions = [
    { label: '2 Seconds', value: 2000 },
    { label: '5 Seconds', value: 5000 },
    { label: '10 Seconds', value: 10000 },
    { label: '30 Seconds', value: 30000 },
    { label: 'Off', value: 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Main Controls Row */}
      <div className="flex flex-col md:flex-row items-start gap-4">
        {/* Mode Toggle */}
        <div className="flex-shrink-0">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Mode</label>
          <div className="relative flex items-center bg-[#0F1115] p-1 rounded-full border border-[#2A2D35]">
            <button
              onClick={() => props.setMode('single')}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 ${props.mode === 'single'
                ? 'text-black bg-[var(--primary)]'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              <Server className="w-4 h-4" />
              Single
            </button>
            <button
              onClick={() => props.setMode('combined')}
              disabled={props.connectionsCount < 2}
              className={`relative z-10 px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${props.mode === 'combined'
                ? 'text-black bg-[var(--primary)]'
                : 'text-gray-400 hover:text-white'
                }`}
            >
              <Users className="w-4 h-4" />
              Combined
            </button>
          </div>
        </div>

        {/* Server Selection */}
        <div className="flex-1 min-w-0">
          <label htmlFor="server-select" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
            {props.mode === 'single' ? 'Server' : 'Servers'}
          </label>
          {props.mode === 'single' ? (
            <select
              id="server-select"
              value={props.selectedId}
              onChange={(e) => props.onSelectId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)]"
              disabled={props.connectionsCount === 0}
            >
              {props.connections.map((conn, idx) => {
                const id = conn.url && conn.url.length > 0 ? conn.url.replace(/\/$/, '') : `${conn.ip || ''}${conn.port ? ':' + conn.port : ''}`;
                const source = conn.url && conn.url.length > 0 ? conn.url : `${conn.ip || ''}${conn.port ? ':' + conn.port : ''}`;
                const truncate = (s: string, n = 40) => s.length > n ? `${s.slice(0, n - 3)}...` : s;
                const display = source && source.length > 0 ? truncate(source, 48) : (conn.username ? `${conn.username}` : 'Unnamed');
                const label = `${display} (${conn.username})`;
                return <option key={`${id}-${idx}`} value={id}>{label}</option>;
              })}
            </select>
          ) : (
            <div className="px-4 py-2.5 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-400">
              {props.connectionsCount} servers selected
            </div>
          )}
        </div>

        {/* Refresh Interval */}
        <div className="flex-shrink-0 w-40">
          <label htmlFor="refresh-interval" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" /> Refresh
          </label>
          <select
            id="refresh-interval"
            value={props.refreshInterval}
            onChange={(e) => props.onSetRefreshInterval(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)]"
          >
            {intervalOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Options Row */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Per-server limit */}
        <div className="w-36">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3" /> Limit
          </label>
          <select
            value={props.perServerLimit}
            onChange={(e) => props.setPerServerLimit(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)] text-sm"
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} per server</option>)}
          </select>
        </div>

        {props.mode === 'combined' && (
          <>
            <div className="w-36">
              <label htmlFor="concurrency-select" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Concurrency</label>
              <select
                id="concurrency-select"
                value={props.concurrency}
                onChange={(e) => props.setConcurrency(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)] text-sm"
              >
                {[1, 2, 3, 5, 8, 10].map(n => (
                  <option key={n} value={n}>{n} concurrent</option>
                ))}
              </select>
            </div>

            <div className="w-36">
              <label htmlFor="max-total-select" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Max Total</label>
              <select
                id="max-total-select"
                value={props.combinedMax}
                onChange={(e) => props.setCombinedMax(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#2A2D35] bg-[#0F1115] text-gray-300 focus:outline-none focus:border-[var(--primary)] text-sm"
              >
                {[100, 250, 500, 1000].map(n => <option key={n} value={n}>{n} total</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default PageControls;

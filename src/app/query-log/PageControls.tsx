import React from 'react';

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
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-400 mb-2 invisible">Mode</label>
          <div className="w-full">
            <div className="relative flex items-center justify-center bg-gray-900 p-0 rounded-full border border-white/10 h-12">
              <span
                className="absolute top-1 left-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--primary)] transition-transform duration-300 ease-in-out"
                style={{ transform: props.mode === 'single' ? 'translateX(0%)' : 'translateX(100%)' }}
              />
              <button onClick={() => props.setMode('single')} className="relative z-10 w-1/2 h-full text-sm font-bold transition-colors duration-300 rounded-full flex items-center justify-center">
                <span className={props.mode === 'single' ? 'text-gray-900' : 'text-gray-300'}>Single</span>
              </button>
              <button onClick={() => props.setMode('combined')} className="relative z-10 w-1/2 h-full text-sm font-bold transition-colors duration-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center" disabled={props.connectionsCount < 2}>
                <span className={props.mode === 'combined' ? 'text-gray-900' : 'text-gray-300'}>Combined</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {props.mode === 'single' ? (
            <div>
              <label htmlFor="server-select" className="block text-sm font-medium text-gray-400 mb-2">Server</label>
              <select id="server-select" value={props.selectedId} onChange={(e) => props.onSelectId(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon" disabled={props.connectionsCount === 0}>
                {props.connections.map((conn, idx) => {
                  const id = conn.url && conn.url.length > 0 ? conn.url.replace(/\/$/, '') : `${conn.ip || ''}${conn.port ? ':' + conn.port : ''}`;
                  const source = conn.url && conn.url.length > 0 ? conn.url : `${conn.ip || ''}${conn.port ? ':'+conn.port : ''}`;
                  const truncate = (s: string, n = 40) => s.length > n ? `${s.slice(0, n-3)}...` : s;
                  const display = source && source.length > 0 ? truncate(source, 48) : (conn.username ? `${conn.username}` : 'Unnamed');
                  const label = `${display} (${conn.username})`;
                  return <option key={`${id}-${idx}`} value={id}>{label}</option>;
                })}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Servers</label>
              <div className="px-4 py-3 rounded-lg border-2 border-gray-800 bg-gray-900 text-gray-300">{props.connectionsCount} servers</div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <label htmlFor="interval-select" className="block text-sm font-medium text-gray-400 mb-2">Refresh Interval</label>
          <select id="interval-select" value={props.refreshInterval} onChange={(e) => props.onSetRefreshInterval(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon">
            {intervalOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="w-full">
        {props.mode === 'combined' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label htmlFor="concurrency-select" className="block text-sm font-medium text-gray-400 mb-2">Combined concurrency</label>
                <select id="concurrency-select" value={props.concurrency} onChange={(e) => props.setConcurrency(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg border-2 border-neon focus:outline-none bg-gray-900 text-primary placeholder-neon">
                  {[1,2,3,5,8,10].map(n => (
                    <option key={n} value={n}>{n} concurrent</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400 mb-2">Per-server limit</label>
                <select value={props.perServerLimit} onChange={(e) => props.setPerServerLimit(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[25,50,100,200].map(n => <option key={n} value={n}>{n} per server</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400 mb-2">Combined max</label>
                <select value={props.combinedMax} onChange={(e) => props.setCombinedMax(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                  {[100,250,500,1000].map(n => <option key={n} value={n}>{n} total</option>)}
                </select>
              </div>

              {/* Page size removed - infinite scroll used instead */}
            </div>
          </div>
        )}

        {props.mode === 'single' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2">Per-server limit</label>
              <select value={props.perServerLimit} onChange={(e) => props.setPerServerLimit(Number(e.target.value))} className="w-full px-4 py-3 rounded-lg bg-gray-900 border-2 border-neon text-primary">
                {[25,50,100,200].map(n => <option key={n} value={n}>{n} per server</option>)}
              </select>
            </div>

            {/* Page size removed - infinite scroll used instead */}
          </div>
        )}
      </div>
    </div>
  );
});

export default PageControls;

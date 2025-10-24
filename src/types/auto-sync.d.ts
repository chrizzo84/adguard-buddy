export type SyncInterval = '5min' | '15min' | '30min' | '1hour' | '2hour' | '6hour' | '12hour' | '24hour' | 'disabled';

export type SyncCategory = 'filtering' | 'querylogConfig' | 'statsConfig' | 'rewrites' | 'blockedServices' | 'accessList' | 'dnsSettings';

export interface AutoSyncConfig {
  enabled: boolean;
  interval: SyncInterval;
  categories: SyncCategory[];
  lastSync?: number; // timestamp
  nextSync?: number; // timestamp
  paused?: boolean; // true if scheduler is paused (enabled but temporarily stopped)
}

export interface SyncLogEntry {
  timestamp: number;
  replicaId: string;
  category: string;
  status: 'success' | 'error';
  message: string;
  duration?: number; // in milliseconds
}

export interface AutoSyncStatus {
  isRunning: boolean;
  config: AutoSyncConfig;
  recentLogs: SyncLogEntry[];
  lastSyncPerReplica: Record<string, number>; // replicaId -> timestamp
}

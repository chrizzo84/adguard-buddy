import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { AutoSyncConfig, SyncLogEntry, SyncInterval } from '@/types/auto-sync';
import logger from '../api/logger';
import CryptoJS from 'crypto-js';
import { getConnectionId, type Connection } from '@/lib/connectionUtils';

const CONFIG_FILE = path.join(process.cwd(), 'auto-sync-config.json');
const LOGS_FILE = path.join(process.cwd(), 'logs', 'auto-sync-logs.json');
const MAX_LOG_ENTRIES = 500;
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

class AutoSyncScheduler {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private config: AutoSyncConfig = {
    enabled: false,
    interval: 'disabled',
    categories: ['filtering', 'querylogConfig', 'statsConfig', 'rewrites', 'blockedServices', 'accessList'],
    paused: false,
  };
  private syncLogs: SyncLogEntry[] = [];
  private isCurrentlySyncing = false;

  constructor() {
    this.loadConfig();
    this.loadLogs();
    this.startScheduler();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.config = JSON.parse(data);
        logger.info(`Auto-sync config loaded: ${JSON.stringify(this.config)}`);
      }
    } catch (error) {
      logger.error(`Failed to load auto-sync config: ${error}`);
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      logger.info('Auto-sync config saved');
    } catch (error) {
      logger.error(`Failed to save auto-sync config: ${error}`);
    }
  }

  private loadLogs(): void {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const data = fs.readFileSync(LOGS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Ensure we always have an array
        this.syncLogs = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      logger.error(`Failed to load auto-sync logs: ${error}`);
      // Ensure syncLogs is always an array
      this.syncLogs = [];
    }
  }

  private saveLogs(): void {
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Keep only the most recent logs
      const recentLogs = this.syncLogs.slice(-MAX_LOG_ENTRIES);
      fs.writeFileSync(LOGS_FILE, JSON.stringify(recentLogs, null, 2));
      this.syncLogs = recentLogs;
    } catch (error) {
      logger.error(`Failed to save auto-sync logs: ${error}`);
    }
  }

  private intervalToCron(interval: SyncInterval): string | null {
    switch (interval) {
      case '5min': return '*/5 * * * *';
      case '15min': return '*/15 * * * *';
      case '30min': return '*/30 * * * *';
      case '1hour': return '0 * * * *';
      case '2hour': return '0 */2 * * *';
      case '6hour': return '0 */6 * * *';
      case '12hour': return '0 */12 * * *';
      case '24hour': return '0 0 * * *';
      case 'disabled': return null;
      default: return null;
    }
  }

  /**
   * Decrypt password using CryptoJS
   */
  private decryptPassword(encryptedPassword: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted || decrypted.length === 0) {
        logger.error('Password decryption resulted in empty string - possible wrong encryption key');
        return '';
      }
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt password', error);
      return ''; // Return empty string if decryption fails
    }
  }

  private async performSync(): Promise<void> {
    if (this.isCurrentlySyncing) {
      logger.info('Auto-sync already in progress, skipping this run');
      return;
    }

    // Check if paused
    if (this.config.paused) {
      logger.info('Auto-sync is paused, skipping this run');
      return;
    }

    this.isCurrentlySyncing = true;
    const startTime = Date.now();
    
    try {
      logger.info('Starting auto-sync cycle');
      
      // Get connections from file - using the correct path from the API
      const connectionsFile = path.join(process.cwd(), '.data', 'connections.json');
      logger.info(`Looking for connections file at: ${connectionsFile}`);
      
      if (!fs.existsSync(connectionsFile)) {
        logger.warn('No connections configured yet. Skipping auto-sync cycle.');
        return;
      }

      const fileContent = fs.readFileSync(connectionsFile, 'utf-8');
      logger.info(`Connections file read successfully, length: ${fileContent.length}`);
      
      const connectionsData = JSON.parse(fileContent);
      const { connections, masterServerIp } = connectionsData;
      
      logger.info(`Parsed connections: ${connections?.length || 0} servers, master: ${masterServerIp}`);

      if (!connections || connections.length === 0) {
        logger.warn('No connections found. Skipping auto-sync cycle.');
        return;
      }

      if (!masterServerIp) {
        logger.warn('No master server configured. Skipping auto-sync cycle.');
        return;
      }

      // Decrypt passwords for all connections
      const decryptedConnections = connections.map((conn: Connection) => {
        const decryptedPassword = this.decryptPassword(conn.password);
        const connId = getConnectionId(conn);
        
        if (!decryptedPassword || decryptedPassword.length === 0) {
          logger.error(`Failed to decrypt password for connection: ${connId}`);
        } else {
          logger.debug(`Successfully decrypted password for connection: ${connId}`);
        }
        
        return {
          ...conn,
          password: decryptedPassword
        };
      });
      
      logger.info('Password decryption completed for all connections');

      // Filter replica connections (exclude master)
      const replicaConns = decryptedConnections.filter((c: Connection) => getConnectionId(c) !== masterServerIp);

      if (replicaConns.length === 0) {
        logger.info('No replica servers configured for auto-sync');
        return;
      }

      // Dynamically import the sync function
      const { performCategorySync } = await import('@/app/api/sync-category/sync-logic');
      const masterConn = decryptedConnections.find((c: Connection) => getConnectionId(c) === masterServerIp);

      if (!masterConn) {
        logger.error(`Master server connection not found. Looking for: ${masterServerIp}`);
        logger.error(`Available connections: ${decryptedConnections.map((c: Connection) => getConnectionId(c)).join(', ')}`);
        throw new Error('Master server connection not found');
      }

      // Sync each category to each replica
      for (const replica of replicaConns) {
        const replicaId = getConnectionId(replica) || '';
        
        for (const category of this.config.categories) {
          const categoryStartTime = Date.now();
          
          try {
            logger.info(`Auto-syncing ${category} to ${replicaId}`);
            
            await performCategorySync(masterConn, replica, category, (message: string) => {
              // Silent logging during auto-sync
              logger.info(`[Auto-Sync] ${message}`);
            });

            const duration = Date.now() - categoryStartTime;
            const logEntry: SyncLogEntry = {
              timestamp: Date.now(),
              replicaId,
              category,
              status: 'success',
              message: `Successfully synced ${category}`,
              duration,
            };
            
            this.syncLogs.push(logEntry);
            logger.info(`Successfully auto-synced ${category} to ${replicaId} in ${duration}ms`);
            
          } catch (error) {
            const duration = Date.now() - categoryStartTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            const logEntry: SyncLogEntry = {
              timestamp: Date.now(),
              replicaId,
              category,
              status: 'error',
              message: `Failed to sync ${category}: ${errorMessage}`,
              duration,
            };
            
            this.syncLogs.push(logEntry);
            logger.error(`Failed to auto-sync ${category} to ${replicaId}: ${errorMessage}`);
          }
        }
      }

      // Update last sync timestamp
      this.config.lastSync = Date.now();
      this.saveConfig();
      this.saveLogs();

      const totalDuration = Date.now() - startTime;
      logger.info(`Auto-sync cycle completed in ${totalDuration}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Auto-sync cycle failed: ${errorMessage}`);
      
      // Log stack trace for debugging
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      
      const logEntry: SyncLogEntry = {
        timestamp: Date.now(),
        replicaId: 'system',
        category: 'all',
        status: 'error',
        message: `Auto-sync cycle failed: ${errorMessage}`,
      };
      
      this.syncLogs.push(logEntry);
      this.saveLogs();
      
    } finally {
      this.isCurrentlySyncing = false;
    }
  }

  private startScheduler(): void {
    this.stopScheduler();

    if (!this.config.enabled || this.config.interval === 'disabled') {
      logger.info('Auto-sync is disabled');
      return;
    }

    const cronExpression = this.intervalToCron(this.config.interval);
    if (!cronExpression) {
      logger.error('Invalid sync interval');
      return;
    }

    try {
      this.task = cron.schedule(cronExpression, () => {
        this.performSync();
      });

      logger.info(`Auto-sync scheduler started with interval: ${this.config.interval}`);
    } catch (error) {
      logger.error(`Failed to start auto-sync scheduler: ${error}`);
    }
  }

  private stopScheduler(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Auto-sync scheduler stopped');
    }
  }

  public updateConfig(newConfig: Partial<AutoSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.startScheduler(); // Restart with new config
  }

  public getConfig(): AutoSyncConfig {
    return { ...this.config };
  }

  public getLogs(limit?: number): SyncLogEntry[] {
    const logs = [...this.syncLogs].reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  public isRunning(): boolean {
    return this.task !== null && this.config.enabled && !this.config.paused;
  }

  public getNextSyncTime(): number | null {
    if (!this.config.enabled || !this.config.lastSync) {
      return null;
    }

    const intervalMinutes: Record<SyncInterval, number> = {
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '1hour': 60,
      '2hour': 120,
      '6hour': 360,
      '12hour': 720,
      '24hour': 1440,
      'disabled': 0,
    };

    const minutes = intervalMinutes[this.config.interval];
    if (minutes === 0) return null;

    return this.config.lastSync + (minutes * 60 * 1000);
  }

  /**
   * Pause the auto-sync scheduler
   * The scheduler keeps running but skips sync operations
   */
  public pause(): void {
    if (!this.config.enabled) {
      throw new Error('Cannot pause: Auto-sync is not enabled');
    }

    if (this.config.paused) {
      logger.warn('Auto-sync is already paused');
      return;
    }

    this.config.paused = true;
    this.saveConfig();
    logger.info('Auto-sync paused');
  }

  /**
   * Resume the auto-sync scheduler
   * Resumes sync operations at the next scheduled interval
   */
  public resume(): void {
    if (!this.config.enabled) {
      throw new Error('Cannot resume: Auto-sync is not enabled');
    }

    if (!this.config.paused) {
      logger.warn('Auto-sync is not paused');
      return;
    }

    this.config.paused = false;
    this.saveConfig();
    logger.info('Auto-sync resumed');
  }

  /**
   * Get pause status
   */
  public isPaused(): boolean {
    return this.config.paused || false;
  }

  public async triggerManualSync(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Auto-sync is not enabled');
    }
    await this.performSync();
  }
}

// Singleton instance
let schedulerInstance: AutoSyncScheduler | null = null;

export function getAutoSyncScheduler(): AutoSyncScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new AutoSyncScheduler();
  }
  return schedulerInstance;
}

// Export class for testing
export { AutoSyncScheduler };

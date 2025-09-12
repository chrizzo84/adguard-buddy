import { syncAll } from './sync';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';

const dataDir = path.join(process.cwd(), '.data');
const autosyncConfigFile = path.join(dataDir, 'autosync.json');

let cronJob: cron.ScheduledTask | null = null;

const getAutosyncSettings = async () => {
  try {
    const data = await fs.readFile(autosyncConfigFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return { enabled: false, interval: '15m' };
  }
};

const getCronExpression = (interval: string): string => {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1), 10);

    if (unit === 'm') {
        return `*/${value} * * * *`;
    }
    if (unit === 'h') {
        return `0 */${value} * * *`;
    }
    // default to every 15 minutes
    return '*/15 * * * *';
};

export const startAutosyncScheduler = async () => {
  console.log('Attempting to start autosync scheduler...');
  if (cronJob) {
    console.log('Stopping existing cron job.');
    cronJob.stop();
  }

  const settings = await getAutosyncSettings();
  console.log('Autosync settings:', settings);
  if (settings.enabled) {
    const cronExpression = getCronExpression(settings.interval);
    cronJob = cron.schedule(cronExpression, () => syncAll());
    console.log(`Autosync scheduler started with cron expression ${cronExpression}.`);
  } else {
    console.log('Autosync scheduler is disabled.');
  }
};

export const stopAutosyncScheduler = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('Autosync scheduler stopped.');
  }
};

export const restartAutosyncScheduler = async () => {
    stopAutosyncScheduler();
    await startAutosyncScheduler();
};
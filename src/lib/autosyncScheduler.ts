import { syncAll } from './sync';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), '.data');
const autosyncConfigFile = path.join(dataDir, 'autosync.json');

let timer: NodeJS.Timeout | null = null;

const getAutosyncSettings = async () => {
  try {
    const data = await fs.readFile(autosyncConfigFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return { enabled: false, interval: '15m' };
  }
};

const getIntervalMilliseconds = (interval: string): number => {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1), 10);
  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000; // default to 15 minutes
  }
};

export const startAutosyncScheduler = async () => {
  if (timer) {
    clearInterval(timer);
  }

  const settings = await getAutosyncSettings();
  if (settings.enabled) {
    const interval = getIntervalMilliseconds(settings.interval);
    timer = setInterval(syncAll, interval);
    console.log(`Autosync scheduler started with interval ${settings.interval}.`);
  } else {
    console.log('Autosync scheduler is disabled.');
  }
};

export const stopAutosyncScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('Autosync scheduler stopped.');
  }
};

export const restartAutosyncScheduler = async () => {
    stopAutosyncScheduler();
    await startAutosyncScheduler();
};

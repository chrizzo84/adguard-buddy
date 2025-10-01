import { NextRequest, NextResponse } from 'next/server';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';

export async function GET() {
  try {
    const scheduler = getAutoSyncScheduler();
    const config = scheduler.getConfig();
    const isRunning = scheduler.isRunning();
    const isPaused = scheduler.isPaused();
    const nextSync = scheduler.getNextSyncTime();
    const recentLogs = scheduler.getLogs(50);

    return NextResponse.json({
      config,
      isRunning,
      isPaused,
      nextSync,
      recentLogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const updates = await req.json();
    const scheduler = getAutoSyncScheduler();
    scheduler.updateConfig(updates);

    return NextResponse.json({ success: true, config: scheduler.getConfig() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

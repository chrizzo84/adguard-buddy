import { NextResponse } from 'next/server';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';

export async function POST() {
  try {
    const scheduler = getAutoSyncScheduler();
    
    // Trigger manual sync
    await scheduler.triggerManualSync();

    return NextResponse.json({ success: true, message: 'Manual auto-sync triggered successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

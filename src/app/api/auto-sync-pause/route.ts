import { NextRequest, NextResponse } from 'next/server';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';
import logger from '../logger';

/**
 * POST /api/auto-sync-pause
 * Pause or resume the auto-sync scheduler
 */
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (!action || (action !== 'pause' && action !== 'resume')) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 }
      );
    }

    const scheduler = getAutoSyncScheduler();

    if (action === 'pause') {
      scheduler.pause();
      logger.info('Auto-sync paused via API');
      return NextResponse.json({ 
        success: true, 
        message: 'Auto-sync paused successfully',
        paused: true 
      });
    } else {
      scheduler.resume();
      logger.info('Auto-sync resumed via API');
      return NextResponse.json({ 
        success: true, 
        message: 'Auto-sync resumed successfully',
        paused: false 
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to pause/resume auto-sync: ${errorMessage}`);
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

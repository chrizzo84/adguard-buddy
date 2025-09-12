import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const logFile = path.join(process.cwd(), 'logs', 'autosync.log');

export async function GET() {
  try {
    const data = await fs.readFile(logFile, 'utf8');
    const lines = data.trim().split('\n');
    console.log('Log file lines:', lines.slice(-5)); // Log last 5 lines for debugging
    // Find the last line that indicates the sync finished to mark completion time
    let lastLine: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('Autosync finished') || 
          lines[i].includes('SYNC: Process finished successfully') || 
          lines[i].includes('Done.') ||
          lines[i].includes('SYNC ERROR:')) { 
        lastLine = lines[i]; 
        console.log('Found matching line:', lastLine);
        break; 
      }
    }
    if (!lastLine && lines.length > 0) {
      lastLine = lines[lines.length - 1];
      console.log('Using last line as fallback:', lastLine);
    }

    // Log format: [ISO_TIMESTAMP] [run:xyz] message OR [ISO_TIMESTAMP] message (old)
    let lastSyncTime: string | null = null;
    let runId: string | null = null;
    if (lastLine) {
      const tsMatch = lastLine.match(/^\[(.*?)\]/); // first bracket is timestamp
      if (tsMatch) {
        lastSyncTime = tsMatch[1];
        console.log('Extracted timestamp:', lastSyncTime);
      }
      const runMatch = lastLine.match(/\[run:([a-z0-9]+)\]/i);
      if (runMatch) {
        runId = runMatch[1];
        console.log('Extracted run ID:', runId);
      }
    }
    const result = { log: lines, lastSyncTime, runId };
    console.log('Returning result:', result);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return NextResponse.json({ log: [], lastSyncTime: null });
    }
    return new NextResponse(JSON.stringify({ message: 'Failed to read sync log.' }), { status: 500 });
  }
}

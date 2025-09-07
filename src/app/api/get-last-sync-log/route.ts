import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const logFile = path.join(process.cwd(), 'logs', 'autosync.log');

export async function GET() {
  try {
    const data = await fs.readFile(logFile, 'utf8');
    const lines = data.trim().split('\n');
    const lastSyncTime = lines.length > 0 ? lines[lines.length - 1].match(/.*\[(.*?)].*/)?.[1] : null;
    return NextResponse.json({ log: lines, lastSyncTime });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ log: [], lastSyncTime: null });
    }
    return new NextResponse(JSON.stringify({ message: 'Failed to read sync log.' }), { status: 500 });
  }
}

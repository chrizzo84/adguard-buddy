import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const dataDir = path.join(process.cwd(), '.data');
const autosyncConfigFile = path.join(dataDir, 'autosync.json');

export async function GET() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const data = await fs.readFile(autosyncConfigFile, 'utf8');
    const settings = JSON.parse(data);
    return NextResponse.json(settings);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default settings
      return NextResponse.json({ enabled: false, interval: '15m' });
    }
    return new NextResponse(JSON.stringify({ message: 'Failed to read autosync settings.' }), { status: 500 });
  }
}

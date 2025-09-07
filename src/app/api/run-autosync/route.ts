import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { syncAll } from '../../../lib/sync';

const dataDir = path.join(process.cwd(), '.data');
const autosyncConfigFile = path.join(dataDir, 'autosync.json');

export async function GET() {
  try {
    const data = await fs.readFile(autosyncConfigFile, 'utf8');
    const settings = JSON.parse(data);

    if (settings.enabled) {
      await syncAll();
      return NextResponse.json({ message: 'Autosync run successfully.' });
    } else {
      return NextResponse.json({ message: 'Autosync is disabled.' });
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ message: 'Autosync not configured.' });
    }
    return new NextResponse(JSON.stringify({ message: 'Failed to run autosync.' }), { status: 500 });
  }
}

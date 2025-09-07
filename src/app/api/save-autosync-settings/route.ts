import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { restartAutosyncScheduler } from '../../../lib/autosyncScheduler';

const dataDir = path.join(process.cwd(), '.data');
const autosyncConfigFile = path.join(dataDir, 'autosync.json');

export async function POST(request: Request) {
  try {
    const settings = await request.json();
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(autosyncConfigFile, JSON.stringify(settings, null, 2));
    await restartAutosyncScheduler();
    return NextResponse.json({ message: 'Autosync settings saved.' });
  } catch {
    return new NextResponse(JSON.stringify({ message: 'Failed to save autosync settings.' }), { status: 500 });
  }
}
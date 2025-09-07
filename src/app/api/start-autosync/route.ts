import { NextResponse } from 'next/server';
import { startAutosyncScheduler } from '../../../lib/autosyncScheduler';

export async function GET() {
    await startAutosyncScheduler();
    return NextResponse.json({ message: 'Autosync scheduler started.' });
}

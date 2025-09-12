import { NextResponse } from 'next/server';
import { startAutosyncScheduler } from '../../../lib/autosyncScheduler';

export async function GET() {
    console.log('Received request to start autosync scheduler.');
    await startAutosyncScheduler();
    return NextResponse.json({ message: 'Autosync scheduler started.' });
}
import { getConnections } from '../../../lib/connections';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const data = await getConnections();
        return NextResponse.json(data);
    } catch (error) {
        const err = error as Error & { originalMessage?: string };
        return NextResponse.json({ message: err.message, error: err.originalMessage }, { status: 500 });
    }
}
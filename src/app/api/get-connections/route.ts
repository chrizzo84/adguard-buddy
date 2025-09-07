import { getConnections } from '../../../lib/connections';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const data = await getConnections();
        return NextResponse.json(data);
    } catch (error) {
        const err = error as Error;
        return NextResponse.json({ message: err.message }, { status: 500 });
    }
}
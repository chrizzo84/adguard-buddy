import { getAllSettings } from '../../../lib/settings';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const connection = await req.json();
    const data = await getAllSettings(connection);
    return NextResponse.json(data);
}

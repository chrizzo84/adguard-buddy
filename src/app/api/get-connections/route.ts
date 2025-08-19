
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');

export async function GET() {
    try {
        await fs.stat(dataFilePath);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            // File doesn't exist, return default empty state
            return NextResponse.json({ connections: [], masterServerIp: null });
        } else {
            // Other errors
            return NextResponse.json({ message: 'Failed to read connections file.', error: err.message }, { status: 500 });
        }
    }

    try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return NextResponse.json(data);
    } catch (error) {
        const err = error as Error;
        // Handle JSON parsing errors or other read errors
        return NextResponse.json({ message: 'Failed to parse connections data.', error: err.message }, { status: 500 });
    }
}

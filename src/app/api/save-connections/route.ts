
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');

async function ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    try {
        await fs.stat(dirname);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            await fs.mkdir(dirname, { recursive: true });
        } else {
            throw error;
        }
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        await ensureDirectoryExists(dataFilePath);
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
        return NextResponse.json({ message: 'Connections saved successfully.' });
    } catch (error) {
        const err = error as Error;
        return NextResponse.json({ message: 'Failed to save connections.', error: err.message }, { status: 500 });
    }
}

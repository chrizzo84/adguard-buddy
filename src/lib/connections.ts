import { promises as fs } from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');

interface ConnectionsError extends Error {
    originalMessage?: string;
}

export async function getConnections() {
    try {
        await fs.stat(dataFilePath);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return { connections: [], masterServerIp: null };
        }
        const wrapped: ConnectionsError = new Error('Failed to read connections file.');
        wrapped.originalMessage = err.message;
        throw wrapped;
    }

    try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data;
    } catch (error) {
        const err = error as Error;
        const wrapped: ConnectionsError = new Error('Failed to parse connections data.');
        wrapped.originalMessage = err.message;
        throw wrapped;
    }
}

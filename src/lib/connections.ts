import { promises as fs } from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');

export async function getConnections() {
    try {
        await fs.stat(dataFilePath);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            // File doesn't exist, return default empty state
            return { connections: [], masterServerIp: null };
        } else {
            // Other errors
            throw new Error('Failed to read connections file.');
        }
    }

    try {
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data;
    } catch {
        // Handle JSON parsing errors or other read errors
        throw new Error('Failed to parse connections data.');
    }
}

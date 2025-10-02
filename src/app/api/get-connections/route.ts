
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');

type Connection = {
    ip?: string;
    url?: string;
    port?: number;
    username: string;
    password: string;
    allowInsecure?: boolean;
};

// Helper to normalize connection IDs consistently
const getConnectionId = (conn: Connection): string => {
    if (conn.url && conn.url.length > 0) {
        return conn.url.replace(/\/$/, '');
    }
    if (conn.ip) {
        return `${conn.ip}${conn.port ? ':' + conn.port : ''}`;
    }
    return '';
};

// Migrate and normalize old data format
const migrateConnectionsData = (data: { connections: Connection[], masterServerIp: string | null }) => {
    const { connections, masterServerIp } = data;
    
    // If masterServerIp is set but doesn't match any connection ID, try to fix it
    if (masterServerIp && connections.length > 0) {
        const masterExists = connections.some(conn => getConnectionId(conn) === masterServerIp);
        
        if (!masterExists) {
            // Try to find a matching connection by checking legacy formats
            const matchedConn = connections.find(conn => {
                // Check if masterServerIp matches just the IP (old format)
                if (conn.ip === masterServerIp) return true;
                // Check if masterServerIp matches just the URL without normalization
                if (conn.url === masterServerIp) return true;
                // Check if it's an IP:port that matches
                if (conn.ip && masterServerIp === `${conn.ip}:${conn.port || ''}`) return true;
                return false;
            });
            
            if (matchedConn) {
                // Update to normalized format
                const normalizedMasterId = getConnectionId(matchedConn);
                console.log(`Migrating master server ID from "${masterServerIp}" to "${normalizedMasterId}"`);
                return { connections, masterServerIp: normalizedMasterId, migrated: true };
            }
        }
    }
    
    return { connections, masterServerIp, migrated: false };
};

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
        
        // Migrate data if needed
        const migratedData = migrateConnectionsData(data);
        
        // If migration occurred, save the updated data back to file
        if (migratedData.migrated) {
            try {
                await fs.writeFile(dataFilePath, JSON.stringify({
                    connections: migratedData.connections,
                    masterServerIp: migratedData.masterServerIp
                }, null, 2));
                console.log('Successfully migrated and saved connections data');
            } catch (writeError) {
                console.error('Failed to save migrated data:', writeError);
                // Continue anyway - return the migrated data even if save failed
            }
        }
        
        return NextResponse.json({
            connections: migratedData.connections,
            masterServerIp: migratedData.masterServerIp
        });
    } catch (error) {
        const err = error as Error;
        // Handle JSON parsing errors or other read errors
        return NextResponse.json({ message: 'Failed to parse connections data.', error: err.message }, { status: 500 });
    }
}

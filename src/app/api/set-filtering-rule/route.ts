import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { httpRequest } from '../../lib/httpRequest';

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');
const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

type Connection = {
  ip: string;
  port: number;
  username: string;
  password: string; // encrypted
    url?: string;
    allowInsecure?: boolean;
};

async function getConnections(): Promise<{ connections: Connection[], masterServerIp: string | null }> {
    try {
        await fs.stat(dataFilePath);
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return { connections: [], masterServerIp: null };
        }
        throw error;
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    const { domain, action } = body;

    if (!domain || !action) {
        return NextResponse.json({ message: 'Domain and action are required.' }, { status: 400 });
    }

    const rule = action === 'block' ? `||${domain}^` : `@@||${domain}^`;

    const { connections } = await getConnections();

    const readableStream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const sendEvent = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}

`));
            };

            sendEvent({ message: `Starting to ${action} domain ${domain} on all servers...` });

            for (const conn of connections) {
                try {
                    const decryptedPassword = CryptoJS.AES.decrypt(conn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
                    if (!decryptedPassword) {
                        throw new Error('Failed to decrypt password.');
                    }

                    sendEvent({ message: `Processing server: ${conn.ip}` });

                        const base = conn.url && conn.url.length > 0 ? conn.url.replace(/\/$/, '') : `http://${conn.ip}:${conn.port}`;
                        const url = `${base}/control/filtering/set_rules`;
                        const headers: Record<string,string> = {
                            'Content-Type': 'application/json',
                        };
                        if (conn.username) headers['Authorization'] = 'Basic ' + Buffer.from(`${conn.username}:${decryptedPassword}`).toString('base64');
                        const r = await httpRequest({ method: 'POST', url, headers, body: JSON.stringify({ rules: [rule] }), allowInsecure: conn.allowInsecure });
                        const response = { ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, text: async () => r.body } as Response;

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: response.statusText }));
                        throw new Error(`AdGuard API error: ${errorData.message}`);
                    }

                    sendEvent({ message: `Successfully applied rule on ${conn.ip}` });

                } catch (e) {
                    const err = e as Error;
                    sendEvent({ message: `Failed to apply rule on ${conn.ip}: ${err.message}` });
                }
            }

            sendEvent({ message: 'Finished.' });
            controller.close();
        }
    });

    return new Response(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
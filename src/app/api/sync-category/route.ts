import { NextRequest } from "next/server";
import logger from "../logger";
import { doSync } from "../../../lib/sync";
import fs from 'fs/promises';
import path from 'path';

const logFile = path.join(process.cwd(), 'logs', 'autosync.log');

// Helper to create a streamable response
const createStreamingResponse = (
    cb: (log: (message: string, level?: 'info' | 'warn' | 'error') => Promise<void>) => Promise<void>
) => {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            // Unified log function: logs to Winston, autosync.log, and to stream
            const log = async (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
                if (level === 'info') logger.info(message);
                else if (level === 'warn') logger.warn(message);
                else if (level === 'error') logger.error(message);
                
                // Also write to autosync.log for UI updates
                const timestamp = new Date().toISOString();
                try {
                    await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
                } catch (err) {
                    console.error('Failed to write to autosync.log:', err);
                }
            };

            log("SYNC: Process started", 'info');
            try {
                await cb(log);
                await log("SYNC: Process finished successfully", 'info');
                await log("Done.", 'info');
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                await log(`SYNC ERROR: ${message}`, 'error');
                await log(`ERROR: ${message}`, 'error');
                console.error("Stream Error:", e);
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
};

export async function POST(req: NextRequest) {
    try {
        const {
            sourceConnection,
            destinationConnection,
            category
        } = await req.json();

        if (!sourceConnection || !destinationConnection || !category) {
            return new Response(
                JSON.stringify({ message: "Missing source, destination, or category" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return createStreamingResponse(async (log) => {
            // Generate a run ID for this sync operation
            const runId = Date.now().toString(36);
            
            // Create a synchronous wrapper for the async log function
            const syncLog = (message: string) => {
                // Fire and forget - we don't await here to keep it synchronous
                log(`[run:${runId}] ${message}`).catch(err => console.error('Failed to write to autosync log:', err));
            };
            await doSync(syncLog, sourceConnection, destinationConnection, category);
        });

    } catch (error) {
        let errorMessage = "An unknown error occurred during request setup.";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        // This part won't stream, it's for initial request parsing errors
        return new Response(
          JSON.stringify({ message: `Internal server error: ${errorMessage}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

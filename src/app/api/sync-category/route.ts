import { NextRequest } from "next/server";
import logger from "../logger";
import { performCategorySync } from "./sync-logic";
import { resolveConnection } from "@/lib/serverConnections";
import { asObject, requireEnum, requireString, ValidationError } from "@/lib/validation";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const SYNC_CATEGORIES = [
    'filtering', 'querylogConfig', 'statsConfig', 'dnsSettings',
    'rewrites', 'blockedServices', 'accessList', 'clients',
] as const;

const createStreamingResponse = (
    cb: (log: (message: string) => void) => Promise<void>
) => {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const log = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
                if (level === 'info') logger.info(message);
                else if (level === 'warn') logger.warn(message);
                else if (level === 'error') logger.error(message);
            };

            log("SYNC: Process started", 'info');
            try {
                await cb(log);
                log("SYNC: Process finished successfully", 'info');
                log("Done.", 'info');
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                log(`SYNC ERROR: ${message}`, 'error');
                log(`ERROR: ${message}`, 'error');
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

const jsonError = (message: string, status: number) =>
    new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Syncs one settings category from the master to a replica.
 * Body: { sourceId: string, destinationId: string, category: string }
 */
export async function POST(req: NextRequest) {
    let sourceId: string;
    let destinationId: string;
    let category: string;

    try {
        const body = asObject(await req.json());
        sourceId = requireString(body, 'sourceId');
        destinationId = requireString(body, 'destinationId');
        category = requireEnum(body, 'category', SYNC_CATEGORIES);
    } catch (error) {
        const message = error instanceof ValidationError
            ? error.message
            : "Missing source, destination, or category";
        return jsonError(message, 400);
    }

    if (sourceId === destinationId) {
        return jsonError("Source and destination must be different servers", 400);
    }

    try {
        const [sourceConnection, destinationConnection] = await Promise.all([
            resolveConnection(sourceId),
            resolveConnection(destinationId),
        ]);

        if (!sourceConnection) return jsonError(`Unknown source connection: ${sourceId}`, 404);
        if (!destinationConnection) return jsonError(`Unknown destination connection: ${destinationId}`, 404);

        return createStreamingResponse(async (log) => {
            await performCategorySync(sourceConnection, destinationConnection, category, log);
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during request setup.";
        logger.error(`Internal server error in /sync-category: ${errorMessage}`);
        return jsonError(`Internal server error: ${errorMessage}`, 500);
    }
}

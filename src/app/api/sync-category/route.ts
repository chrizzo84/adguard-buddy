import { NextRequest } from "next/server";
import logger from "../logger";
import { performCategorySync } from "./sync-logic";

// Helper to create a streamable response
const createStreamingResponse = (
    cb: (log: (message: string) => void) => Promise<void>
) => {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            // Unified log function: logs to Winston and to stream
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
            await performCategorySync(sourceConnection, destinationConnection, category, log);
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
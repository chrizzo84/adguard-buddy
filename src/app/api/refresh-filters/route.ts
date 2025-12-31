import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from '../../lib/httpRequest';

/**
 * Trigger filter list refresh on an AdGuard server
 * POST body: { url?, ip, port?, username, password, allowInsecure? }
 * This calls /control/filtering/refresh on the target server
 */
export async function POST(req: NextRequest) {
    try {
        const { ip, url: connUrl, port = 80, username, password, allowInsecure = false } = await req.json();
        logger.info(`POST /refresh-filters called for: ${connUrl || ip}`);

        const headers: Record<string, string> = {};
        if (username && password) {
            headers["Authorization"] = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        }
        headers["User-Agent"] = "curl/8.0.1";
        headers["Accept"] = "*/*";
        headers["Content-Type"] = "application/json";

        const base = connUrl && connUrl.length > 0 ? connUrl.replace(/\/$/, '') : `http://${ip}:${port}`;
        const refreshUrl = `${base}/control/filtering/refresh`;

        // The refresh endpoint accepts a body with 'whitelist' (boolean) parameter
        // If not specified, it refreshes all filter lists
        const response = await httpRequest({
            method: 'POST',
            url: refreshUrl,
            headers,
            body: JSON.stringify({ whitelist: false }), // Refresh blocklists, not whitelists
            allowInsecure,
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
            logger.info(`Filter refresh triggered successfully on ${connUrl || ip}`);

            let responseData;
            try {
                responseData = JSON.parse(response.body || '{}');
            } catch {
                responseData = { message: 'Refresh triggered' };
            }

            return NextResponse.json({
                success: true,
                message: 'Filter lists refresh triggered',
                data: responseData,
            });
        } else {
            logger.error(`Filter refresh failed on ${connUrl || ip}: ${response.statusCode}`);
            return NextResponse.json({
                success: false,
                error: `Failed with status ${response.statusCode}`,
                body: response.body,
            }, { status: response.statusCode });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error refreshing filters: ${errorMessage}`);
        return NextResponse.json({
            success: false,
            error: errorMessage,
        }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from '../../lib/httpRequest';

export async function POST(req: NextRequest) {
  try {
    const { ip, url, username, password, port = 80, allowInsecure = false } = await req.json();
    logger.info(`POST /statistics called for target: ${url || ip}`);
    const base = url && url.length > 0 ? url.replace(/\/$/, '') : `http://${ip}:${port}`;
    const statsUrl = `${base}/control/stats`;
    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    try {
      const r = await httpRequest({ method: 'GET', url: statsUrl, headers, allowInsecure });
      if (r.statusCode < 200 || r.statusCode >= 300) {
        logger.warn(`AdGuard Home responded with status ${r.statusCode} for ${statsUrl}`);
        return NextResponse.json({ message: 'Failed to fetch stats from server', status: 'error' }, { status: 502 });
      }
      const data = JSON.parse(r.body || '{}');
      logger.info(`Statistics fetched successfully for target: ${url || ip}`);
      return NextResponse.json(data);
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home statistics: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return new NextResponse(
        JSON.stringify({
          message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /statistics: ${errorMessage}`);
    return new NextResponse(
      JSON.stringify({
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from '../../lib/httpRequest';

export async function POST(req: NextRequest) {
  try {
    const {
      ip,
      url,
      username,
      password,
      port = 80,
      limit = 100,
      offset = 0,
      response_status = 'all',
      allowInsecure = false,
    } = await req.json();

    const base = url && url.length > 0 ? url.replace(/\/$/, '') : `http://${ip}:${port}`;
    logger.info(`POST /query-log called for target: ${base}, limit: ${limit}, offset: ${offset}, response_status: ${response_status}`);

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      response_status: response_status,
    });

    const fullUrl = `${base}/control/querylog?${params.toString()}`;

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    try {
      const res = await httpRequest({ method: 'GET', url: fullUrl, headers, allowInsecure });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        logger.warn(`AdGuard Home responded with status ${res.statusCode} for ${fullUrl}`);
        return NextResponse.json({ status: 'error', message: 'Failed to fetch query log from AdGuard Home' }, { status: 502 });
      }
      const data = JSON.parse(res.body || '{}');
      logger.info(`Query log fetched successfully for target: ${base}`);
      return NextResponse.json(data);
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home query-log: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return NextResponse.json({ status: 'error', message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}` }, { status: 502 });
    }

  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /query-log: ${errorMessage}`);
    return NextResponse.json({ status: 'error', message: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}

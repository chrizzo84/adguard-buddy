import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";

export async function POST(req: NextRequest) {
  try {
    const {
      ip,
      username,
      password,
      port = 80,
      limit = 100,
      offset = 0,
      response_status = 'all'
    } = await req.json();

    logger.info(`POST /query-log called for IP: ${ip}, limit: ${limit}, offset: ${offset}, response_status: ${response_status}`);

    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        response_status: response_status,
    });

    const url = `http://${ip}:${port}/control/querylog?${params.toString()}`;

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
      });
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home query-log: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return new NextResponse(
        JSON.stringify({
          status: "error",
          message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`AdGuard Home responded with error in query-log: ${errorText}`);
      return new NextResponse(
        JSON.stringify({
          status: "error",
          message: `Failed to fetch query log from AdGuard Home: ${errorText}`,
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    logger.info(`Query log fetched successfully for IP: ${ip}`);
    return NextResponse.json(data);

  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /query-log: ${errorMessage}`);
    return new NextResponse(
      JSON.stringify({
        status: "error",
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

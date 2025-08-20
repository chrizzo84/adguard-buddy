import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";

export async function POST(req: NextRequest) {
  try {
    const { ip, username, password, port = 80 } = await req.json();
    logger.info(`POST /statistics called for IP: ${ip}`);
    const statsUrl = `http://${ip}:${port}/control/stats`;
    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
    let response;
    try {
      response = await fetch(statsUrl, {
        method: "GET",
        headers,
      });
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home statistics: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return new NextResponse(
        JSON.stringify({
          message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`AdGuard Home responded with error in statistics: ${errorText}`);
      return new NextResponse(
        JSON.stringify({
          message: `Failed to fetch stats from AdGuard Home: ${errorText}`,
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const data = await response.json();
    logger.info(`Statistics fetched successfully for IP: ${ip}`);
    return NextResponse.json(data);
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

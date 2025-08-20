import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";

export async function POST(req: NextRequest) {
  try {
    const { ip, username, password, port = 80 } = await req.json();
  logger.info(`POST /check-adguard called for IP: ${ip}`);
    const url = `http://${ip}:${port}/control/status`;
    const statsUrl = `http://${ip}:${port}/control/stats`;
    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
    // Status abfragen
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
      });
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home status: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return NextResponse.json({
        status: "error",
        message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      }, { status: 502 });
    }
    const text = await response.text();
    // Statistiken abfragen
    let stats = null;
    try {
      const statsRes = await fetch(statsUrl, {
        method: "GET",
        headers,
      });
      if (statsRes.ok) {
        stats = await statsRes.json();
      }
    } catch {
      stats = null;
    }
    logger.info(`Status fetched for IP: ${ip}, status: ${response.ok ? "connected" : "error"}`);
    return NextResponse.json({
      status: response.ok ? "connected" : "error",
      response: text,
      code: response.status,
      stats,
    });
  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /check-adguard: ${errorMessage}`);
    return NextResponse.json({
      status: "error",
      message: `Internal server error: ${errorMessage}`
    }, { status: 500 });
  }
}

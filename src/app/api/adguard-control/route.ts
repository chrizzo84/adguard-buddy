import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";

export async function POST(req: NextRequest) {
  try {
    const { ip, username, password, port = 80, protection_enabled } = await req.json();
    const url = `http://${ip}:${port}/control/dns_config`;

    logger.info(`POST /adguard-control called for IP: ${ip}, protection_enabled: ${protection_enabled}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ protection_enabled }),
      });
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
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
      logger.warn(`AdGuard Home responded with error: ${errorText}`);
      return new NextResponse(
        JSON.stringify({
          status: "error",
          message: `Failed to update AdGuard Home protection status: ${errorText}`,
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info(`Protection status updated successfully for IP: ${ip}`);
    return NextResponse.json({
      status: "success",
      message: "Protection status updated successfully.",
    });
  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /adguard-control: ${errorMessage}`);
    return new NextResponse(
      JSON.stringify({
        status: "error",
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
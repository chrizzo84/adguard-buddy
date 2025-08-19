import { NextRequest, NextResponse } from "next/server";

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

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(
        JSON.stringify({
          status: "error",
          message: `Failed to fetch query log from AdGuard Home: ${errorText}`,
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new NextResponse(
      JSON.stringify({
        status: "error",
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

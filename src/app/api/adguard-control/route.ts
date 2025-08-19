import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ip, username, password, port = 80, protection_enabled } = await req.json();
    const url = `http://${ip}:${port}/control/dns_config`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ protection_enabled }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return new NextResponse(
            JSON.stringify({
                status: "error",
                message: `Failed to update AdGuard Home protection status: ${errorText}`,
            }),
            { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // The response from dns_config might be empty on success, or it might return the new config.
    // Let's just return a success message.
    return NextResponse.json({
      status: "success",
      message: "Protection status updated successfully.",
    });

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

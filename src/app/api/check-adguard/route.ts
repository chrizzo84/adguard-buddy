import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ip, username, password, port = 80 } = await req.json();
    const url = `http://${ip}:${port}/control/status`;
    const statsUrl = `http://${ip}:${port}/control/stats`;
    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
    // Status abfragen
    const response = await fetch(url, {
      method: "GET",
      headers,
    });
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
    return NextResponse.json({
      status: response.ok ? "connected" : "error",
      response: text,
      code: response.status,
      stats,
    });
  } catch {
    return NextResponse.json({
      status: "error",
      response: "Error fetching data.",
      code: 500,
      stats: null,
    });
  }
}

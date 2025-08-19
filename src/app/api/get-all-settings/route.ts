import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ip, port = 80, username, password } = await req.json();

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const fetchOptions = { method: "GET", headers };

    const endpoints = {
        status: `/control/status`,
        profile: `/control/profile`,
        dns: `/control/dns_info`,
        filtering: `/control/filtering/status`,
        safebrowsing: `/control/safebrowsing/status`,
        parental: `/control/parental/status`,
        safesearch: `/control/safesearch/status`,
        accessList: `/control/access/list`,
        blockedServices: `/control/blocked_services/get`,
        rewrites: `/control/rewrite/list`,
        tls: `/control/tls/status`,
        querylogConfig: `/control/querylog/config`,
        statsConfig: `/control/stats/config`,
    };

    const requests = Object.entries(endpoints).map(([key, endpoint]) => {
        const url = `http://${ip}:${port}${endpoint}`;
        return fetch(url, fetchOptions).then(res => {
            if (!res.ok) {
                // Return a specific error object for this endpoint
                return { key, error: `Failed with status ${res.status}` };
            }
            return res.json().then(data => ({ key, data }));
        }).catch(e => {
            return { key, error: e.message };
        });
    });

    const results = await Promise.all(requests);

    const allSettings: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    results.forEach(result => {
        if (result.error) {
            errors[result.key] = result.error;
        } else {
            allSettings[result.key] = result.data;
        }
    });

    if (Object.keys(errors).length > 0) {
        // Decide if we should return partial data or a full error
        // For a sync comparison, partial data might be okay, with errors listed
        return NextResponse.json({ settings: allSettings, errors });
    }

    return NextResponse.json({ settings: allSettings });

  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new NextResponse(
      JSON.stringify({
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

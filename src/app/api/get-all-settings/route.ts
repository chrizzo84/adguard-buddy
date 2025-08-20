import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";

export async function POST(req: NextRequest) {
  try {
    const { ip, port = 80, username, password } = await req.json();
    logger.info(`POST /get-all-settings called for IP: ${ip}`);

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

    type EndpointResult = { key: string; data?: any; error?: string };

    const requests = Object.entries(endpoints).map(([key, endpoint]) => {
      const url = `http://${ip}:${port}${endpoint}`;
      return fetch(url, fetchOptions)
        .then(async res => {
          if (!res.ok) {
            logger.warn(`Endpoint ${endpoint} responded with error: status ${res.status}`);
            return { key, error: `Failed with status ${res.status}` };
          }
          try {
            const data = await res.json();
            return { key, data };
          } catch (jsonError) {
            logger.error(`JSON parse error for endpoint ${endpoint}: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
            return { key, error: 'Failed to parse JSON' };
          }
        })
        .catch(e => {
          logger.error(`Fetch error for endpoint ${endpoint}: ${e.message}`);
          return { key, error: e.message };
        });
    });

    const results: EndpointResult[] = await Promise.all(requests);

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
      logger.warn(`Some endpoints failed for IP: ${ip}: ${JSON.stringify(errors)}`);
      return NextResponse.json({ settings: allSettings, errors });
    }

    logger.info(`All settings fetched for IP: ${ip}`);
    return NextResponse.json({ settings: allSettings });

  } catch (error) {
    let errorMessage = "An unknown error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    logger.error(`Internal server error in /get-all-settings: ${errorMessage}`);
    return new NextResponse(
      JSON.stringify({
        message: `Internal server error: ${errorMessage}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

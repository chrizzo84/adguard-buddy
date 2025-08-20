import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";



export async function POST(req: NextRequest) {
    const { ip, port = 80, username, password } = await req.json();
    logger.info(`POST /get-all-settings called for IP: ${ip}`);

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
    headers["User-Agent"] = "curl/8.0.1";
    headers["Accept"] = "*/*";
    headers["Connection"] = "close";

    const fetchOptions = { method: "GET", headers };
    // Alle Endpunkte seriell abfragen
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

    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const [key, endpoint] of Object.entries(endpoints)) {
      const url = `http://${ip}:${port}${endpoint}`;
      try {
        const res = await fetch(url, fetchOptions);
        const text = await res.text();
        logger.info(`[DEBUG] Endpoint '${key}' status: ${res.status}, response: ${text}`);
        if (res.ok) {
          try {
            results[key] = JSON.parse(text);
          } catch {
            results[key] = text;
          }
        } else {
          errors[key] = `Failed with status ${res.status}`;
        }
      } catch (error) {
        errors[key] = error instanceof Error ? error.message : String(error);
      }
    }

    return NextResponse.json({ settings: results, errors });
}
import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from '../../lib/httpRequest';

export async function POST(req: NextRequest) {
    const { ip, url: connUrl, port = 80, username, password, allowInsecure = false } = await req.json();
    logger.info(`POST /get-all-settings called for target: ${connUrl || ip}`);

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }
    headers["User-Agent"] = "curl/8.0.1";
    headers["Accept"] = "*/*";
    headers["Connection"] = "close";

    // Alle Endpunkte seriell abfragen
    const endpoints: Record<string, string> = {
      status: `/control/status`,
      profile: `/control/profile`,
      dnsSettings: `/control/dns_info`,
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

    // Build base: prefer provided URL, otherwise ip:port
    const base = connUrl && connUrl.length > 0 ? connUrl.replace(/\/$/, '') : `http://${ip}:${port}`;

    for (const [key, endpoint] of Object.entries(endpoints)) {
      const fullUrl = `${base}${endpoint}`;
      try {
        const r = await httpRequest({ method: 'GET', url: fullUrl, headers, allowInsecure });
        logger.info(`[DEBUG] Endpoint '${key}' status: ${r.statusCode}, response length: ${String(r.body).length}`);
        if (r.statusCode >= 200 && r.statusCode < 300) {
          try {
            let data = JSON.parse(r.body || '{}');
            // Normalize rewrites by removing 'enabled' field which may be present in newer AdGuard versions
            if (key === 'rewrites' && Array.isArray(data)) {
              data = data.map((r: Record<string, unknown>) => {
                const normalized = { ...r };
                delete normalized.enabled;
                return normalized;
              });
            }
            results[key] = data;
          } catch {
            results[key] = r.body;
          }
        } else {
          errors[key] = `Failed with status ${r.statusCode}`;
        }
      } catch (error) {
        errors[key] = error instanceof Error ? error.message : String(error);
      }
    }

    return NextResponse.json({ settings: results, errors });
}
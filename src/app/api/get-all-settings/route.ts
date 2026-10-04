import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import { httpRequest } from "@/lib/httpRequest";
import { authHeaders, buildBaseUrl } from "@/lib/serverConnections";
import { connectionFromBody, errorResponse } from "@/lib/apiConnection";
import { normalizeRewrites } from '../rewriteUtils';
import { normalizeClients } from '../clientUtils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENDPOINTS: Record<string, string> = {
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
  clients: `/control/clients`,
};

/**
 * Collects every settings endpoint for one stored connection.
 * Body: { connectionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { connection, error } = await connectionFromBody(await req.json());
    if (error) return error;

    const base = buildBaseUrl(connection);
    logger.info(`POST /get-all-settings called for target: ${base}`);

    const headers = authHeaders(connection, {
      "User-Agent": "curl/8.0.1",
      "Accept": "*/*",
      "Connection": "close",
    });

    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // Queried in parallel: a full settings sweep against several servers is the
    // slowest thing the sync view does, and these endpoints are independent.
    await Promise.all(Object.entries(ENDPOINTS).map(async ([key, endpoint]) => {
      const fullUrl = `${base}${endpoint}`;
      try {
        const r = await httpRequest({ method: 'GET', url: fullUrl, headers, allowInsecure: connection.allowInsecure });
        if (r.statusCode >= 200 && r.statusCode < 300) {
          try {
            let data = JSON.parse(r.body || '{}');
            if (key === 'rewrites' && Array.isArray(data)) {
              data = normalizeRewrites(data);
            } else if (key === 'clients') {
              data = normalizeClients(data);
            }
            results[key] = data;
          } catch {
            results[key] = r.body;
          }
        } else {
          errors[key] = `Failed with status ${r.statusCode}`;
        }
      } catch (err) {
        errors[key] = err instanceof Error ? err.message : String(err);
      }
    }));

    return NextResponse.json({ settings: results, errors });
  } catch (error) {
    logger.error(`Internal server error in /get-all-settings: ${error instanceof Error ? error.message : String(error)}`);
    return errorResponse(error, 'Internal server error');
  }
}

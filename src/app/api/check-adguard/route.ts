import { NextRequest, NextResponse } from "next/server";
import logger from "../logger";
import http, { RequestOptions as HttpRequestOptions } from "http";
import https, { RequestOptions as HttpsRequestOptions } from "https";
import { URL } from "url";

function httpRequest(opts: { method: 'GET' | 'POST', url: string, headers?: Record<string,string>, body?: string | null, allowInsecure?: boolean }) : Promise<{ statusCode: number, headers: http.IncomingHttpHeaders, body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(opts.url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const requestOptions: HttpRequestOptions | HttpsRequestOptions = {
        method: opts.method,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: opts.headers || {},
      };

      if (isHttps && opts.allowInsecure) {
        (requestOptions as HttpsRequestOptions).rejectUnauthorized = false;
      }

      const req = lib.request(requestOptions, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: data }));
      });

      req.on('error', (err) => reject(err));

      if (opts.body) {
        req.write(opts.body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const { ip, url, username, password, port = 80, allowInsecure = false } = await req.json();
    const base = url && url.length > 0 ? url : `http://${ip}:${port}`;
    logger.info(`POST /check-adguard called for target: ${base}`);

    const headers: Record<string, string> = {};
    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    // Status abfragen
    let statusRes;
    try {
      statusRes = await httpRequest({ method: 'GET', url: `${base.replace(/\/$/, '')}/control/status`, headers, allowInsecure });
    } catch (fetchError) {
      logger.error(`Fetch error for AdGuard Home status: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      return NextResponse.json({
        status: "error",
        message: `Failed to reach AdGuard Home: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      }, { status: 502 });
    }

    const text = statusRes.body;
    // Statistiken abfragen
    let stats = null;
    try {
      const statsRes = await httpRequest({ method: 'GET', url: `${base.replace(/\/$/, '')}/control/stats`, headers, allowInsecure });
      if (statsRes.statusCode >= 200 && statsRes.statusCode < 300) {
        try { stats = JSON.parse(statsRes.body); } catch { stats = null; }
      }
    } catch {
      stats = null;
    }

    logger.info(`Status fetched for target: ${base}, status: ${statusRes.statusCode}`);
    return NextResponse.json({
      status: statusRes.statusCode >= 200 && statusRes.statusCode < 300 ? "connected" : "error",
      response: text,
      code: statusRes.statusCode,
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

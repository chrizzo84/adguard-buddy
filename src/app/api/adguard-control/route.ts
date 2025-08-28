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
        // Narrow to HttpsRequestOptions to set TLS option without using `any`
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
    const { ip, url, username, password, port = 80, protection_enabled, allowInsecure = false } = await req.json();
    const base = url && url.length > 0 ? url : `http://${ip}:${port}`;

    logger.info(`POST /adguard-control called for target: ${base}, protection_enabled: ${protection_enabled}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (username && password) {
      headers["Authorization"] =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    let response;
    try {
      response = await httpRequest({ method: 'POST', url: `${base.replace(/\/$/, '')}/control/dns_config`, headers, body: JSON.stringify({ protection_enabled }), allowInsecure });
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

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const errorText = response.body;
      logger.warn(`AdGuard Home responded with error: ${errorText}`);
      return new NextResponse(
        JSON.stringify({
          status: "error",
          message: `Failed to update AdGuard Home protection status: ${errorText}`,
        }),
        { status: response.statusCode, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info(`Protection status updated successfully for target: ${base}`);
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
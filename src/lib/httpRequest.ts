import http from 'http';
import https from 'https';
import { RequestOptions } from 'http';

export async function httpRequest(opts: { method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, headers?: Record<string,string>, body?: string | null, allowInsecure?: boolean }) : Promise<{ statusCode: number, headers: http.IncomingHttpHeaders, body: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(opts.url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const requestOptions: RequestOptions = {
        method: opts.method,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: opts.headers || {},
      };

      if (isHttps && opts.allowInsecure) {
        (requestOptions as RequestOptions & { rejectUnauthorized?: boolean }).rejectUnauthorized = false;
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

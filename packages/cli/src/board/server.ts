import http from 'node:http';
import { boardCss, boardFavicon, boardHtml, boardJs } from './assets.js';
import type { BoardObservation } from './types.js';

export interface BoardServer {
  listen(): Promise<{ host: '127.0.0.1'; port: number; url: string }>;
  close(): Promise<void>;
}

export function createBoardServer(input: { repositoryRoot: string; changeId: string; observe: () => Promise<BoardObservation> }): BoardServer {
  const server = http.createServer(async (request, response) => {
    const host = request.headers.host ?? '';
    if (!(host === '127.0.0.1' || /^127\.0\.0\.1:\d+$/.test(host))) { response.writeHead(400).end(); return; }
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }).end(); return; }
    const headers = { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    if (request.url === '/') { response.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }).end(boardHtml); return; }
    if (request.url === '/assets/board.css') { response.writeHead(200, { ...headers, 'Content-Type': 'text/css; charset=utf-8' }).end(boardCss); return; }
    if (request.url === '/assets/board.js') { response.writeHead(200, { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' }).end(boardJs); return; }
    if (request.url === '/assets/favicon.svg') { response.writeHead(200, { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8' }).end(boardFavicon); return; }
    if (request.url === '/api/observation') {
      try {
        const observation = await input.observe();
        if (!observation || observation.repositoryRoot !== input.repositoryRoot || observation.changeId !== input.changeId) {
          response.writeHead(500, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ availability: 'unavailable', hostLiveStatus: 'unknown', blocker: { code: 'OBSERVER_INVALID', message: 'Fixed observation binding was invalid' } })); return;
        }
        response.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(observation)); return;
      } catch {
        response.writeHead(503, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ availability: 'unavailable', hostLiveStatus: 'unknown', blocker: { code: 'OBSERVER_FAILED', message: 'Observation refresh failed' } })); return;
      }
    }
    response.writeHead(404, headers).end();
  });
  return {
    listen: async () => await new Promise((resolve, reject) => {
      server.once('error', reject); server.listen(0, '127.0.0.1', () => {
        server.off('error', reject); const address = server.address();
        if (!address || typeof address === 'string') { reject(new Error('Board server did not report a TCP address')); return; }
        resolve({ host: '127.0.0.1', port: address.port, url: `http://127.0.0.1:${address.port}/` });
      });
    }),
    close: async () => await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

import http from 'node:http';
import { describe, expect, test } from 'vitest';
import { createBoardServer } from '../../packages/cli/src/board/server.js';
import type { BoardObservation } from '../../packages/cli/src/board/types.js';

const observation: BoardObservation = {
  schemaVersion: 1, observedAt: '2026-09-16T00:00:00.000Z', repositoryRoot: '/fixed/repo', changeId: 'fixed-change',
  availability: 'available', hostLiveStatus: 'unknown', change: { state: 'executing', revision: 1, revisionId: 'r1', blockers: [] },
  tasks: [{ id: '<img src=x onerror=alert(1)>', title: 'safe text', revision: 1, state: 'implementing', column: 'active', blocked: false, requirements: ['must remain text'], runId: 'run-1', assignmentSession: 'fixture', runState: 'running', leaseActive: true, lastActivity: null, blockers: [], gate: null, review: null }],
  recordedTeam: null,
};

function request(port: number, path: string, method = 'GET', host = '127.0.0.1'): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers: { Host: host } }, (response) => {
      let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }));
    });
    req.on('error', reject); req.end();
  });
}

describe('local board server', () => {
  test('serves only fixed assets and an explicitly bound observation', async () => {
    const board = await createBoardServer({ repositoryRoot: '/fixed/repo', changeId: 'fixed-change', observe: async () => observation });
    const address = await board.listen();
    try {
      const page = await request(address.port, '/');
      expect(page.status).toBe(200);
      expect(page.headers['content-security-policy']).toContain("script-src 'self'");
      expect(page.body).toContain('/assets/board.js');
      expect(page.body).toContain('/assets/favicon.svg');
      expect(page.body).not.toContain('alert(1)');
      expect((await request(address.port, '/assets/favicon.svg')).status).toBe(200);
      expect(await request(address.port, '/api/observation')).toMatchObject({ status: 200, body: expect.stringContaining('fixed-change') });
      expect((await request(address.port, '/api/observation', 'POST')).status).toBe(405);
      expect((await request(address.port, '/other')).status).toBe(404);
      expect((await request(address.port, '/', 'GET', 'example.test')).status).toBe(400);
    } finally { await board.close(); }
  });

  test('returns an explicit unavailable response when its fixed observer fails', async () => {
    const board = await createBoardServer({ repositoryRoot: '/fixed/repo', changeId: 'fixed-change', observe: async () => { throw new Error('read failed'); } });
    const address = await board.listen();
    try {
      const response = await request(address.port, '/api/observation');
      expect(response.status).toBe(503);
      expect(response.body).toContain('unavailable');
    } finally { await board.close(); }
  });
});

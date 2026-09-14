/**
 * One-shot launcher source executed with `node --eval`.  Keeping the launcher
 * self-contained avoids requiring built JavaScript before the TypeScript CLI
 * can run.  The reviewed command and its environment are transferred only
 * over IPC after the durable release decision; neither is written to a
 * controller artifact.
 */
export const gateLauncherSource = String.raw`
'use strict';
const fs = require('node:fs');
const { spawn } = require('node:child_process');

let gate;
let released = false;
let finishing = false;
let timedOut = false;
let capped = false;
let outputBytes = 0;
const outputStreams = {
  stdout: { observedBytes: 0, forwardedBytes: 0, omittedPrefix: [] },
  stderr: { observedBytes: 0, forwardedBytes: 0, omittedPrefix: [] },
};
let timer;
let drainTimer;
let gateExit;
let stdoutClosed = false;
let stderrClosed = false;
let pendingWrites = 0;
const drainTimeoutMs = 2000;

function fail(message, code = 125) {
  if (finishing) return;
  finishing = true;
  try { if (process.connected) process.send({ type: 'launcher-error', message }); } catch {}
  if (gate && gate.exitCode === null && gate.signalCode === null) {
    try { gate.kill('SIGKILL'); } catch {}
  }
  process.exitCode = code;
  if (!gate) process.exit();
}

function verifiedRelease(message) {
  let raw;
  try { raw = fs.readFileSync(message.journalPath, 'utf8'); } catch { return false; }
  if (!raw.endsWith('\n')) return false;
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length === 0) return false;
  let event;
  try { event = JSON.parse(lines[lines.length - 1]); } catch { return false; }
  const payload = event && event.payload;
  return event.eventHash === message.releaseEventHash
    && event.type === 'gate.attempt.released'
    && payload && payload.attemptId === message.attemptId
    && payload.startedEventHash === message.startedEventHash
    && payload.processGroupId === process.pid;
}

function reportGateExit(drainComplete) {
  if (finishing || !gateExit) return;
  finishing = true;
  clearTimeout(drainTimer);
  const message = { type: 'gate-exit', ...gateExit, timedOut, capped, drainComplete, observedOutputBytes: outputBytes, outputStreams };
  try {
    if (process.connected) process.send(message);
    else process.kill(-process.pid, 'SIGKILL');
  } catch { process.kill(-process.pid, 'SIGKILL'); }
}

function finishDrainWhenReady() {
  if (gateExit && stdoutClosed && stderrClosed && pendingWrites === 0) reportGateExit(true);
}

process.once('disconnect', () => {
  // The Gate leader may have exited while ordinary descendants remain in the
  // group.  Keep disconnect containment armed until the launcher itself is
  // gone; the finishing flag only suppresses duplicate protocol work.
  try { process.kill(-process.pid, 'SIGKILL'); }
  catch { fail('controller disconnected before launcher containment'); }
});

process.on('message', (message) => {
  if (!message || message.type !== 'release' || released || finishing) return fail('invalid or duplicate launcher decision');
  if (!verifiedRelease(message)) return fail('durable release decision could not be verified');
  released = true;
  try {
    gate = spawn(message.command, message.args, {
      cwd: message.cwd,
      env: message.env,
      shell: false,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  const forward = (streamName, destination, chunk) => {
    const stream = outputStreams[streamName];
    const buffer = Buffer.from(chunk);
    const remaining = Math.max(0, message.maxOutputBytes - outputBytes);
    const forwarded = buffer.subarray(0, remaining);
    const omitted = buffer.subarray(forwarded.byteLength);
    if (forwarded.byteLength > 0) {
      pendingWrites += 1;
      try {
        destination.write(forwarded, (error) => {
          pendingWrites -= 1;
          if (error) return fail(error.message || String(error));
          finishDrainWhenReady();
        });
      } catch (error) {
        pendingWrites -= 1;
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
    stream.forwardedBytes += forwarded.byteLength;
    if (omitted.byteLength > 0 && stream.omittedPrefix.length < 3) {
      const proofBytes = omitted.subarray(0, 3 - stream.omittedPrefix.length);
      stream.omittedPrefix.push(...proofBytes);
    }
    stream.observedBytes += buffer.byteLength;
    outputBytes += buffer.byteLength;
    if (outputBytes > message.maxOutputBytes && !capped) {
      capped = true;
      try { gate.kill('SIGKILL'); } catch {}
    }
  };
  gate.stdout.on('data', (chunk) => forward('stdout', process.stdout, chunk));
  gate.stderr.on('data', (chunk) => forward('stderr', process.stderr, chunk));
  gate.stdout.once('close', () => { stdoutClosed = true; finishDrainWhenReady(); });
  gate.stderr.once('close', () => { stderrClosed = true; finishDrainWhenReady(); });
  timer = setTimeout(() => {
    timedOut = true;
    try { gate.kill('SIGKILL'); } catch {}
  }, message.timeoutMs);
  gate.once('error', (error) => fail(error.message));
  gate.once('exit', (code, signal) => {
    clearTimeout(timer);
    if (finishing) return;
    gateExit = { code, signal };
    drainTimer = setTimeout(() => reportGateExit(false), drainTimeoutMs);
    finishDrainWhenReady();
  });
});

if (!process.send) fail('launcher IPC is unavailable');
else process.send({ type: 'launcher-ready', pid: process.pid, processGroupId: process.pid });
`;

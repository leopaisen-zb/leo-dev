# Consumer preflight

Codex 0.154.0 standalone app-server initialized and returned skills/list with an isolated child CODEX_HOME and a scrubbed environment. User .agents skills remain visible; the isolated home separates Codex installation/configuration, not all user skills. No candidate was installed in this probe.

Normal-auth sandboxed startup exited before initialization. A scoped approved fresh standalone CLI process then initialized and returned model/list, including the requested Terra/medium, Terra/high and Sol/high profiles. No model turn ran; this proves catalog availability only. No GUI connection, login flow, credential copy or live plugin change occurred. Both successful owned servers shut down with exit 0 and joined readers.

The task-local client now waits for observed terminal turns before an operator shutdown and discards stderr/private reasoning items. Its requests file is deliberate operator control, not a security enforcement layer. It does not auto-answer approval requests. Actual interruption requires a matching turn/completed status, not server exit.

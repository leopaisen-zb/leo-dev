# Independent local release verifier

Root launches this actual independent session only after M5 Full review has been accepted and the public controller has entered release-evidence. You are distinct from M5 producer and primary reviewer. No source edits, receipts, controller mutations, Git, new agents or global changes. You are not alone; own only the assigned verifier evidence directory. Read mochi-config.json for the retained fixture, verified CLI and fixed Node22. Obtain fresh public status and require the current archiveContext.

Execute the complete frozen HTTP acceptance test on the active source using Node22, with normal scoped loopback permission. Check the frozen oracle and dirty sentinel hashes against mochi-config.json. Independently compare the current six application-source files with the accepted M4/M5 records and the exact files in the coordinator-provided artifact. Record actual argv/exit results and hashes; don't infer a pass from another agent's prose. Check the existing integration Gate binding and accepted distinct Full review evidence in public state. Runtime/controller release projections can change the full raw tree after integration; use the controller's current valid release proof and exact application entries, not a false assertion that a post-release raw tree equals the earlier candidate hash.

The final same-specification plan revision is 3, following a real M5 rejection for future import → edit → restart failure. The original seven-group oracle is unchanged. Also run the three separately frozen `tests/clock-skew.test.mjs` regressions (SHA-256 `2e8ee60e33467f3ec07d6275a78d626d85fb18ea4386bb6d45ad5867c98f3790`). Run both files explicitly with Node's test runner and require ten passing tests. The current artifact is `mochi-board-0.2.0-v3.tar.gz`, with its complete thirteen-file inventory in `mochi-public-example-v3-binding.json`; the older twelve-file artifact is retained as a prior candidate. Check the final artifact against that inventory, reject unexpected/symlink/escaping entries, and execute the same ten HTTP tests from a private extracted copy to establish standalone behavior. Keep all source, artifact and verifier outputs outside the fixture's controlled source.

After actual success write a JSON report with exactly the useful evidence fields:

```json
{
  "schemaVersion": 1,
  "changeId": "mochi-board",
  "specHash": "<actual archiveContext value>",
  "candidateTreeHash": "<actual archiveContext value>",
  "sessionId": "<actual host-provided verifier identity>",
  "verifierRunId": "<new recorded identifier for this real verification run>",
  "provider": "local-verifier",
  "status": "passed",
  "checks": [{"name": "frozen HTTP acceptance", "argv": ["<actual Node>", "--test", "tests/acceptance.test.mjs"], "exitCode": 0, "gateDefinitionHash": "<actual integration Gate definition hash>"}]
}
```

The actual outer session ID may be supplied by root after launch; wait for that host binding or report completion for root to bind transparently. Never invent identity or successful checks. Add a concise human report with exact scope, commands, artifact comparison and limitations. This is local verifier evidence, not GitHub Actions. If any required check fails, retain its output and return NEEDS_FIXES without a passed JSON report. Close only owned test processes. Root archives using the actual report, artifact and retrospective after verifying them.

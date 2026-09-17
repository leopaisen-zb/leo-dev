# Repair nested writes during board observation

The installed browser check rejected read-only acceptance: a Refresh changed
the change-runtime directory mtime while preserving regular-file bytes. The
root's separate `observe` invocation reproduced that exact metadata change in
`installed-reproducer.json`. Its first filesystem-watcher probe failed with
`EMFILE`; the retained successful reproducer uses nanosecond metadata and
content snapshots without watchers.

Source inspection identifies a nested locking read. `Controller.observe`
supplies a read-only journal observation to `readEvents`, but historical Gate
verification calls `GateRunner.inspectSettlement`, whose prepared-attempt read
uses `Journal.replayStrict`. That method creates and removes a lock. The
indeterminate Gate path shares this reader and must also remain read-only.

This is an in-scope correction of W3's already approved no-write contract.
Preserve all frame, history, authority, Gate, receipt and launcher validation.
Propagate the validated observation or an explicit read-only inspection path
through nested verification. Keep ordinary mutation/recovery locking unchanged
and retain the final observation identity/digest check. No new CLI, schema,
completion authority or task state is required.

A Terra/high worker owns minimal Gate/controller plumbing and focused tests.
It captures before-images, demonstrates RED with a real completed Gate, and
checks directory metadata as well as file bytes. A different reviewer checks
the exact delta, including unknown/recovered histories and integrity refusals.
The root freezes a new installed package only after acceptance. A browser
reviewer then repeats actual Refresh and before/after preservation checks.

The frozen A/B development packages and running B observations do not change.
This repair is a separate runtime delta after those method conditions. Preserve
their results and disclose that final held-out acceptance uses the repaired
runtime. Held-out staging remains pending; its frozen cases and schedule cannot
be used to tune this fix.

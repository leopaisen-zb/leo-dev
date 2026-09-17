# W3 observation-lock repair — independent code review

## Verdict

**ACCEPT.** I found no blocking correctness, integrity, or scope issue in the reviewed five-file delta.

This verdict applies only to the source and tests identified below. It does not amend or erase the retained `w2-installed-board/REPORT.md` verdict: that installed package remains a recorded **FAIL**. Packaging and installed-browser re-acceptance of this repaired runtime remain separate work owned by the root thread.

## Reviewed boundary

The repository has no usable `HEAD` baseline for this review, so I compared each current file with its explicit flat before-image in `before/`. The before-images match `before/SHA256SUMS`.

| File | Before SHA-256 | Reviewed SHA-256 |
| --- | --- | --- |
| `packages/cli/src/controller/controller.ts` | `29e2d420697cd8645bdb794b89b1dc356fbbef913c7968d5cf903645d4263abf` | `3f36a9719604e925cd1fcef166fe1415adc1d33a2b154711f3a62df581012e15` |
| `packages/cli/src/gates/runner.ts` | `cd7caa9d8facdc128b2fd2ed903914af11c49886ab318fad0c01fd28ce6bbf0c` | `f9ce3a6e8d22bed6e91291c54dd70dbf35620b3ec2be0e1109f4094bcac20895` |
| `tests/cli/board.test.ts` | `6ae7b5cd263a5dfa625a1c47dccbd4616dac8a294ebd70f00621e59c3615f0e7` | `d629950f5de9a74760b971d5aeb731d85a44dcf585b8f2f4d26b870524d4f850` |
| `tests/gates/runner.test.ts` | `0935f30f2d8c56990121ef9954aa2cdb382720afd9ba1a1f32a6363abf89624d` | `84142821c54cc2cbfb69c512d74c77b3bb0337cf26c6b41541986772e77a8bd1` |
| `tests/cli/vertical-slice.test.ts` | `033de566fb422a9431bc898b3227d4d73ba03fee5d017b99422dac5e33d3eae1` | `8a56a8dfa1a0e1338d5359b6129d7223b67bc3095ca1bc00ab2f0f2ccc527c0a` |

The production delta is limited to propagating the `JournalObservation` already obtained by `Controller.observe()` through `readEvents()`, terminal Gate history verification, and standalone unknown-attempt verification. `GateRunner.inspectPreparedAttempt()` uses that supplied snapshot instead of invoking `replayStrict()` a second time. No CLI, journal event, lifecycle state, schema, or persistence format changed.

## Correctness and integrity review

- The sole production caller that supplies the new optional observation is `Controller.observe()`. It obtains the snapshot from the requested change journal with `Journal.observe()`, whose decoder still verifies frame shape, sequence, previous-event hashes, payload hashes, and event hashes.
- `Controller.observe()` retains its second journal observation and compares device, inode, size, modified time, and full-content digest before returning an available result. Concurrent ordinary journal changes therefore still turn the observation unavailable.
- The snapshot substitution occurs only where the old nested `replayStrict()` caused lock creation/removal. Gate definition, repository identity, task/run/lease scope, prepared/started/released/terminal ordering, launcher fingerprints, immutable evidence, outcome reduction, historical authority, candidate, receipt, and handoff checks are unchanged.
- All other production inspection callers omit the observation. Mutation, recovery, resume, and reconciliation paths continue to read with `replayStrict()` and retain their lock behavior. The recovery implementation itself is untouched.
- Standalone unknown history receives the same observation and still requires an exact durable phase-hash list plus matching attempt, operation, input-tree, lease, route, and controller-batch authority. The change does not turn an indeterminate attempt into a terminal settlement.
- No nested write remains on the reviewed observation branches. The completed-settlement branch reads current gate/evidence data; the unknown branch reads gate authority; neither calls append, recovery, evidence publication, directory creation, or lock acquisition when the observation is supplied.

## Test quality and verification

The new completed-history regression uses the public compiled CLI, produces a real successful Gate and submission, invokes `observe` twice, and compares a recursive snapshot containing directory and file inode/mode/link-count/size/mtime/ctime metadata plus regular-file SHA-256 values. The public forged-candidate regression retains the unavailable integrity result and the same recursive metadata invariant.

The unknown regression uses the public CLI on the existing thrown-indeterminate vertical slice, verifies the observed approval-required state, and checks journal bytes and runtime-directory nanosecond mtime/ctime. The focused runner test also accepts the correct prepared-only phase hash, rejects a forged phase hash, and confirms that inspection does not change journal bytes or runtime-directory mtime/ctime. These are real journal and CLI paths rather than method stubs.

I independently ran the following narrow check with Node 22.22.2, without rebuilding or running the broad suite:

```text
vitest: 3 files passed
4 selected tests passed; 133 skipped
- completed Gate history metadata invariance
- forged claim-input integrity refusal and metadata invariance
- public thrown-indeterminate observation and reconciliation reachability
- prepared-only observation phase binding and no-lock metadata invariance
```

The implementation record additionally reports: board focal tests 4/4, unknown vertical slice 1/1, Gate runner 86/86, journal observation/recovery 24/24, build passed, and typecheck passed. I did not independently repeat those broader commands.

## Remaining acceptance boundary

This source review establishes the repair's code and focused regression quality. It does not claim that the previously installed package was repaired. A newly frozen package and independent installed browser refresh must still demonstrate byte and metadata invariance before the earlier installed-board failure can be superseded.

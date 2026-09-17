# Independent review: W4 index-0 progression amendment

## Verdict

Accept the amendment's scope for continuing the fixed W4 schedule. It is a
narrow sequencing correction for one retained process failure, not a product,
score, or actor-quality criterion change.

The amendment preserves the decisive constraints:

- Index 0 consumes its original opportunity and remains `UNKNOWN`,
  `child-turns-active`, unscored, unaccepted, and product-unverified.
- The original manifest and event log remain unchanged. No rerun, replacement,
  repair, placeholder score, or scorer invocation is allowed for index 0.
- The process-group attestation is used only to establish that no index-0 actor
  can still run. It does not erase the historical active turn or make index 0
  score-eligible.
- Index 1 and all later entries retain the frozen inputs, packages, requested
  model/effort, tools, limits, permission policy, oracle, scorer, and thresholds.
  The schedule still has exactly 22 original opportunities and gains no rescue
  attempt.
- The exception is explicitly one-case. Any later unscored active-child or
  exceptional cleanup outcome stops again for a new disposition.

The timing disclosure is accurate and necessary. The root disposition file was
written at 13:19:47Z and authorized index 1 before the recorded runner/model
starts at 13:20:41Z/13:20:45Z. The dedicated amendment file was written later.
It states that fact, records the late HOLD, and forbids claiming that either the
dedicated file or corrected independent review was frozen before index 1. The
proper final process verdict should therefore record a coordination deviation,
while leaving the running actor and result untouched.

## Evidence binding

- Amendment SHA-256:
  `9be2086ac601f77efcad00fd75360a0ed9ab06d42a10f9e5fbe49e4a45c17c0a`.
- Frozen readiness SHA-256:
  `be9e1c6d0269bfc2e36539e8f57295a707d755c45710f2eb28a0049ca0712eac`.
- Root disposition SHA-256:
  `5464830d44e5f18f85d9def8c089c0707be6c1315a211434a3ee5452aa144834`.
- Cleanup attestation SHA-256:
  `3f73dcf100b16e3f68545e2695f2442b4cf997a553a6148b368476e0cbace424`.
- Retained manifest/events SHA-256:
  `538d7e144d249bcfcbce426862cf18ea28932f2669e314e73b8012373b1c3a83`
  and
  `b33f7536062c802f189c4f406ff36b0f19e17c12947dde6c05cb6c1e22415b03`.
- Initial independent review SHA-256:
  `54684470360bdf04ead33fbf361f735a04f816ea9c65a2494715167a46facb93`;
  corrected review SHA-256:
  `dae5ba4567b270de912848220c3d7c610b165c2442f9b0bf3afcfcbefc20d468`.

## Concrete provenance concern

The prelaunch root disposition links `index-0-process-failure.md` while naming
the initial review hash `54684470...`. That path now contains the corrected
review with hash `dae5ba45...`; the exact initial bytes were preserved later as
`index-0-process-failure.initial.md` with the stated `54684470...` hash. The
amendment records both the initial hash and the subsequent correction and binds
the current corrected file correctly, so this discrepancy does not broaden the
exception or invalidate safe progression. It must remain disclosed in final
process evidence; the immutable source records should not be silently rewritten.

No product/oracle conclusion follows from this review. No evidence supports a
model, effort, RAG, or multi-agent-routing change.

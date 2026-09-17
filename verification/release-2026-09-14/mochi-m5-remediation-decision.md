# Same-specification repair after M5 rejection

The independent primary review reproduced future import → update → invalid durable timestamps → restart failure on candidate `4cfc6ce…09bcd`. The existing v2 requirements already accept those valid timestamps, preserve createdAt, require updates and restart persistence. The design requires complete candidate validation before publication. No product scope, date limit, authority source or architecture changes are needed.

M5 is verification only and M4 is terminal. Root will record the real Full rejection first, then use the public conservative revision command with the **unchanged v2 specification, constitution and design**, and a new task-plan revision. All existing task IDs, ownership and dependencies remain; revisions advance once and failure counts are retained. M2 receives an explicit supplemental regression obligation for the already required cross-feature behavior. Revalidation begins at M1; the store repair is written only under a new M2 claim. No journal or lease is edited manually.

The timestamp fix may use wall-clock ISO only when it is at least as late as the previous timestamp; otherwise it preserves the already valid previous timestamp string. This retains accepted time-zone representations and avoids turning valid four-digit dates near the calendar boundary into an expanded-year string. Shared persistence validates the complete candidate before file writes, as the existing design requires.

The original frozen seven-group HTTP oracle stays byte-identical. A separate regression test and independent original-probe rerun must fail before and pass after the repair. Original reports/artifact/public copy are retained as prior candidates; replacement publication bytes will be explicitly recorded after acceptance.

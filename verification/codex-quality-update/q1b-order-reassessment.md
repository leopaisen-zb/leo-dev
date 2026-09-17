# Q1b acquisition-boundary reassessment

The repeated findings are concentrated at one seam: the extraction combined path validation and receipt reading even though the old callers used different path bases and different sequencing. Root checked the accepted Q1a source before authorizing another repair.

| Entry | Accepted Q1a sequence |
| --- | --- |
| Request design review | Non-Lite route → current authority → required CLI options → capture current design source |
| Ordinary design approval | Non-Lite route → current authority/context/source → read the supplied receipt relative to caller cwd (absolute readable references also supported) → schema/expiry → receipt reuse/binding/independence |
| Existing approved design | Non-Lite route → decode context and receipt/current authority → current source → current-time receipt validation |
| Fresh claim receipt | Non-Lite route → prior approval event exists → canonicalize repository-relative receipt path and contain it → ordinary design authority/context/source checks → read/capture once → receipt checks → reservation and source binding |

Ordinary receipt containment and caller-CWD resolution now have passing regressions. A separate Sol/high evaluator found that fresh-claim path validation was moved later. That finding was derived from code; a public collision must establish the old and current observable outcomes before a new regression oracle is accepted. Earlier controller guards must not be assumed away.

The bounded repair may expose separate path preparation and deferred reading through narrow callbacks. Both I/O stages remain in Controller; the service retains admission decisions. No new security policy, receipt schema, source reread, lock owner or journal owner is authorized. Existing failure reports and the accidentally duplicated test run remain preserved. Q2 waits for the resulting independent acceptance.

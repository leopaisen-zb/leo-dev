# Review calibration oracle

This evaluator-only note records the expected assessment of the coordinator-created packets.

| Packet | Expected assessment | Basis |
| --- | --- | --- |
| `calibration/valid` | Accept | The acceptance contract compares parsed JSON fields and one required output line. The supplied context contains the complete required method report. Key order and whitespace differ only in the artifact serialization. |
| `calibration/invalid` | Reject | The artifact changes the required public `status` key to `state`, and its mandatory behavior checks are declared optional. |

These expectations are not actor-facing and do not represent historical reviewer answers.

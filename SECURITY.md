# Security

## Boundary

Leo Dev is a development workflow and lifecycle controller, not a security sandbox. A process with the same filesystem permissions can edit local state or bypass the controller. Platform permission prompts, sandboxes, independent CI, protected branches, and repository permissions remain authoritative.

## Secrets

- Do not place credentials in Skill files, manifests, fixtures, change artifacts, or committed evidence.
- Raw command output and runtime journals belong under `.leo-dev/runtime/` and are ignored by Git.
- Redaction and secret scans reduce accidental persistence but cannot guarantee that arbitrary project commands never expose unknown secrets.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not open a public issue containing exploit details or credentials.

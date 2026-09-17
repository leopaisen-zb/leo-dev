# Platform capability matrix

Verified locally on 2026-09-04. “Supported” means documented by the client; it does not mean the Leo Dev adapter has passed its smoke test. Smoke status is recorded separately.

| Capability | Codex 0.153.0 | Claude Code 2.1.220 | Cursor Agent 2026.08.31-4057e58 |
|---|---|---|---|
| Product entry | `$develop` | `/leo-dev:develop` | Native Skill invocation; exact display to verify |
| Native manifest | `.codex-plugin/plugin.json` | `.claude-plugin/plugin.json` | `.cursor-plugin/plugin.json` |
| Agent Skills | Supported | Supported | Supported |
| Plugin subagents | Client-specific; schema to verify | Supported, client-specific | Supported, client-specific |
| Hooks | Client-specific; not enabled in v1 | Supported; full user permissions | Supported; deny/transform/fail-closed options |
| Local test route | Staging local marketplace/plugin ID | `claude --plugin-dir <path>` | Local plugin directory + reload |
| Headless provider contract | Deferred/unknown for Leo Dev | Deferred/unknown for Leo Dev | Deferred/unknown for Leo Dev |
| Controller runtime | External Node.js 20+ | External Node.js 20+ | External Node.js 20+ |

## Sources

- Codex: <https://github.com/openai/plugins> and <https://learn.chatgpt.com/docs/build-plugins>
- Claude Code: <https://code.claude.com/docs/en/plugins> and <https://code.claude.com/docs/en/skills>
- Cursor: <https://cursor.com/docs/reference/plugins> and <https://cursor.com/docs/skills>
- Portable core: <https://agentskills.io/specification> and <https://agent-plugins.org/specification>

## Product boundary

Leo Dev promises one workflow concept, not identical command spelling or platform powers. Unknown or untested capabilities remain unavailable to the portable workflow until a dated smoke test proves them.


# Install in Codex

Build from an authorized checkout of this private repository. Use Node.js 20 or newer and npm. The recorded release host and CI use macOS; the controller's network-deny Gate policy requires an enforceable host sandbox. A Linux or Windows source build alone does not establish that capability.

```sh
npm ci
npm run build
npm run build:adapters
npm run verify:packages
npm run build:marketplace
```

The generated `dist/codex/leo-dev` directory is a complete plugin: one `develop` skill, its references, the compiled controller and its runtime dependencies. `dist/marketplace` wraps a verified copy in a local marketplace named `leo-dev-release`.

## Register the local marketplace

These commands use the plugin interface inspected in Codex CLI 0.154.0. Check `codex plugin --help` if your installed version differs.

From the repository root:

```sh
codex plugin marketplace add ./dist/marketplace
codex plugin list --marketplace leo-dev-release --available --json
codex plugin add leo-dev@leo-dev-release --json
```

Registration and installation update Codex's local marketplace/plugin configuration and cache. The build commands themselves do not install anything. Keep the marketplace directory available for future updates. An existing `leo-dev@personal` entry has a different marketplace identity; avoid enabling two copies of `develop` in the same working session.

Start a **new Codex session** in the project you want to work on, then invoke:

```text
$develop Continue the approved work in this repository.
Inspect the specification and current state, preserve unrelated edits,
and complete implementation, independent review and verification.
```

Confirm that the session's skill catalog resolves `develop` to the newly installed plugin. If it still shows an older cached path, report that mismatch before calling it a successful installation. See [release evidence](release-evidence.md) for the exact checks performed for this version.

## Use the packaged controller directly

The skill's [lifecycle guide](../skills/develop/references/lifecycle.md) documents the public commands and receipt fields. A package can also be inspected without installation:

```sh
node dist/codex/leo-dev/runtime/packages/cli/dist/index.js --help
```

Use one Node executable consistently for a change. The runtime records executable and candidate identity; changing launchers during recovery can correctly invalidate evidence. Direct invocation verifies packaging and CLI behavior, while a new host session verifies installed discovery.

## Dependencies and permissions

Superpowers remains an external skill dependency. Leo Dev selects available planning, TDD, debugging and review methods from the host catalog. Web, native-mobile and AI projects need their own applicable verification capabilities; a missing tool must be reported, not simulated.

The plugin does not grant network, repository publication or deployment authority. A Gate configured with `network: approval-required` needs a current receipt matching its exact command, working directory, environment and candidate. A receipt does not bypass the host sandbox. Local HTTP acceptance also requires the host to permit loopback sockets.

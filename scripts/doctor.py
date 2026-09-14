#!/usr/bin/env python3
"""Read-only local toolkit checks. Never installs, downloads, or reads credentials."""

import json
from pathlib import Path
import shutil
import subprocess


def plugin_status(payload, plugin_id):
    """Availability is not installation; installation is not enablement."""
    for item in payload.get('installed', []):
        if item.get('pluginId') == plugin_id and item.get('installed') is True:
            return 'passed' if item.get('enabled') is True else 'disabled'
    return 'missing'


def command_output(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=20).stdout.strip()


def inspect_config(config):
    checks = []

    def record(name, passed, detail):
        checks.append({'check': name, 'status': 'passed' if passed else 'failed', 'detail': detail})

    for command in config.get('required_commands', []):
        location = shutil.which(command)
        record('command:' + command, bool(location), location or 'not found')

    for filename in config.get('required_files', []):
        path = Path(filename).expanduser()
        record('file:' + filename, path.is_file(), str(path))

    optional = config.get('optional_dependencies', {})
    if not isinstance(optional, dict):
        raise ValueError('optional_dependencies must be an object')
    for filename in optional.get('paths', []):
        path = Path(filename).expanduser()
        checks.append({'check': 'optional-file:' + filename, 'status': 'passed' if path.is_file() else 'not_run', 'detail': str(path)})

    plugin_ids = optional.get('plugin_ids', [])
    if plugin_ids:
        try:
            payload = json.loads(command_output(['codex', 'plugin', 'list', '--json']))
            if not isinstance(payload, dict) or not isinstance(payload.get('installed'), list):
                raise ValueError('Unexpected plugin list schema')
            for plugin_id in plugin_ids:
                state = plugin_status(payload, plugin_id)
                checks.append({'check': 'plugin:' + plugin_id, 'status': 'passed' if state == 'passed' else 'not_run', 'detail': state})
        except (OSError, ValueError, TypeError, AttributeError, subprocess.SubprocessError) as exc:
            checks.append({'check': 'plugin:list', 'status': 'not_run', 'detail': type(exc).__name__})

    return {
        'ok': all(check['status'] != 'failed' for check in checks),
        'checks': checks,
        'not_run': ['browser interaction', 'native simulator/device', 'business tests', 'AI/RAG evals'],
        'note': 'Only local command and explicitly configured dependency checks; not a business acceptance result.',
    }


def inspect_toolkit(root):
    config = json.loads((root / 'components.json').read_text(encoding='utf-8'))
    return inspect_config(config)


def main():
    try:
        result = inspect_toolkit(Path(__file__).resolve().parents[1])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        result = {'ok': False, 'error': type(exc).__name__}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())

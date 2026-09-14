import importlib.util
from pathlib import Path
import unittest


MODULE = Path(__file__).resolve().parents[1] / 'scripts' / 'doctor.py'
spec = importlib.util.spec_from_file_location('doctor', MODULE)
doctor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(doctor)


class PluginStatusTests(unittest.TestCase):
    def test_enabled_installed_plugin_passes(self):
        payload = {'installed': [{'pluginId': 'leo-dev@personal', 'installed': True, 'enabled': True}]}
        self.assertEqual(doctor.plugin_status(payload, 'leo-dev@personal'), 'passed')

    def test_available_is_not_installed(self):
        self.assertEqual(doctor.plugin_status({'available': [{'pluginId': 'leo-dev@personal'}]}, 'leo-dev@personal'), 'missing')

    def test_disabled_is_not_passed(self):
        payload = {'installed': [{'pluginId': 'leo-dev@personal', 'installed': True, 'enabled': False}]}
        self.assertEqual(doctor.plugin_status(payload, 'leo-dev@personal'), 'disabled')

    def test_same_name_different_marketplace_does_not_match(self):
        payload = {'installed': [{'pluginId': 'leo-dev@other', 'installed': True, 'enabled': True}]}
        self.assertEqual(doctor.plugin_status(payload, 'leo-dev@personal'), 'missing')

    def test_missing_enabled_field_is_not_assumed_true(self):
        payload = {'installed': [{'pluginId': 'leo-dev@personal', 'installed': True}]}
        self.assertEqual(doctor.plugin_status(payload, 'leo-dev@personal'), 'disabled')

    def test_non_installed_entry_is_not_passed(self):
        payload = {'installed': [{'pluginId': 'leo-dev@personal', 'installed': False, 'enabled': True}]}
        self.assertEqual(doctor.plugin_status(payload, 'leo-dev@personal'), 'missing')


class PortableConfigTests(unittest.TestCase):
    def test_omitted_optional_dependencies_do_not_block_source_readiness(self):
        checks = doctor.inspect_config({'required_commands': []})
        self.assertTrue(checks['ok'])
        self.assertEqual(checks['checks'], [])

    def test_configured_missing_required_input_fails(self):
        checks = doctor.inspect_config({'required_commands': [], 'required_files': ['definitely-not-present']})
        self.assertFalse(checks['ok'])
        self.assertEqual(checks['checks'][0]['status'], 'failed')

    def test_optional_path_is_reported_without_becoming_a_failure(self):
        checks = doctor.inspect_config({'required_commands': [], 'optional_dependencies': {'paths': ['definitely-not-present']}})
        self.assertTrue(checks['ok'])
        self.assertEqual(checks['checks'][0]['status'], 'not_run')


if __name__ == '__main__':
    unittest.main()

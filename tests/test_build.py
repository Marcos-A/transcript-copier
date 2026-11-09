"""Check the packages users load, and that the provisional name has one source of truth."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build", ROOT / "scripts/build.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
NAME = json.loads((ROOT / "_locales/en/messages.json").read_text(encoding="utf-8"))["extName"]["message"]


class PackageTests(unittest.TestCase):
    def build(self, browser, output):
        directory, archive = builder.build(browser, output)
        return json.loads((directory / "manifest.json").read_text(encoding="utf-8")), archive

    def test_every_manifest_file_is_packaged(self):
        with tempfile.TemporaryDirectory() as temp:
            for browser in builder.BROWSERS:
                with self.subTest(browser=browser):
                    manifest, archive = self.build(browser, Path(temp))
                    names = set(ZipFile(archive).namelist())
                    referenced = [*manifest["icons"].values(), *manifest["action"]["default_icon"].values(),
                                  manifest["action"]["default_popup"]]
                    for script in manifest["content_scripts"]:
                        referenced += script["js"] + script["css"]
                    background = manifest["background"]
                    referenced += background.get("scripts", []) + [background[k] for k in ("service_worker",) if k in background]
                    self.assertIn("manifest.json", names)
                    self.assertIn("assets/icon.svg", names)
                    self.assertLessEqual(set(referenced), names)

    def test_firefox_uses_background_scripts_and_stable_id(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, _ = self.build("firefox", Path(temp))
            self.assertNotIn("service_worker", manifest["background"])
            self.assertEqual(manifest["browser_specific_settings"]["gecko"]["id"], "transcript-copier@extensions.local")

    def test_permissions_stay_minimal(self):
        manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(manifest["permissions"]), ["clipboardWrite", "storage"])
        self.assertNotIn("host_permissions", manifest)
        self.assertEqual(manifest["content_scripts"][0]["matches"], ["https://www.youtube.com/*"])

    def test_name_is_centralised(self):
        manifest = (ROOT / "manifest.json").read_text(encoding="utf-8")
        self.assertNotIn(NAME, manifest)
        for document in ("README.md", "PRIVACY.md"):
            self.assertIn(NAME, (ROOT / document).read_text(encoding="utf-8"), document)

    def test_required_icons_exist(self):
        for size in (16, 24, 32, 48, 64, 96, 128, 256, 512):
            self.assertTrue((ROOT / f"assets/icon-{size}.png").is_file(), size)
        self.assertTrue((ROOT / "assets/icon.svg").is_file())


if __name__ == "__main__":
    unittest.main()

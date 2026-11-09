"""Package the shared extension for Chromium and Firefox (Python 3.9+)."""

import argparse
import json
from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
BROWSERS = ("chromium", "firefox")
ASSETS = ("src", "assets", "_locales", "LICENSE")
PACKAGE_NAME = "transcript-copier"


def build(browser, output_root=ROOT / "dist"):
    if browser not in BROWSERS:
        raise ValueError(f"Unsupported browser: {browser}")
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if browser == "firefox":
        manifest.update(json.loads((ROOT / "browsers/firefox.json").read_text(encoding="utf-8")))

    destination = output_root / browser
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for asset in ASSETS:
        source = ROOT / asset
        if source.is_dir():
            shutil.copytree(source, destination / asset)
        else:
            shutil.copy2(source, destination / asset)
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    archive = output_root / f"{PACKAGE_NAME}-{browser}-{manifest['version']}.zip"
    with ZipFile(archive, "w", ZIP_DEFLATED) as package:
        for file in sorted(destination.rglob("*")):
            if file.is_file():
                package.write(file, file.relative_to(destination).as_posix())
    return destination, archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("browser", nargs="?", choices=(*BROWSERS, "all"), default="all")
    args = parser.parse_args()
    for browser in BROWSERS if args.browser == "all" else (args.browser,):
        directory, archive = build(browser)
        print(f"{browser}: {directory}\n  package: {archive}")


if __name__ == "__main__":
    main()

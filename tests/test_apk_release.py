"""Release-level guards against mixed config/image versions and incomplete uploads."""
import hashlib
import json
from pathlib import Path
import unittest

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/releases/apk_2_11_1"
ASSETS = ROOT / "assets/releases/apk_2_11_1"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class ApkReleaseTests(unittest.TestCase):
    def test_all_published_files_match_the_verified_snapshot(self):
        integrity = load("integrity.json")
        self.assertEqual(integrity["release"], "apk_2_11_1")
        actual = {
            str(path.relative_to(ROOT))
            for directory in (DATA, ASSETS)
            for path in directory.iterdir()
            if path.is_file() and path.name != "integrity.json"
        }
        self.assertEqual(actual, set(integrity["files"]))
        for relative, expected in integrity["files"].items():
            with self.subTest(file=relative):
                path = ROOT / relative
                content = path.read_bytes()
                self.assertEqual(len(content), expected["bytes"])
                self.assertEqual(hashlib.sha256(content).hexdigest(), expected["sha256"])

    def test_all_77_config_tables_come_from_the_uploaded_apk(self):
        report = load("source-report.json")
        self.assertEqual(report["table_count"], 77)
        self.assertEqual(len(report["tables"]), 77)
        self.assertEqual(report["archive"]["source_sha256"],
                         "1415ce389e9771769f103eca03f02e10f71603f79f845303a3b0ae30d1a66c6c")
        self.assertFalse(report["server_hot_update_equivalence_claimed"])
        for table in report["tables"]:
            with self.subTest(table=table["name"]):
                self.assertTrue(table["complete_consumption"])
                self.assertTrue(table["byte_exact_round_trip"])
                content = (DATA / table["output_filename"]).read_bytes()
                self.assertEqual(hashlib.sha256(content).hexdigest(), table["output_sha256"])
                self.assertIsInstance(json.loads(content), dict)
        # This APK differs from the public October schema's balancing values.
        # Catch accidental copying of the public JSON in place of APK values.
        bonus = load("AscensionStarsBonusLibrary.json")["1"]["BonusStats"]["Stats"][0]["Value"]
        self.assertEqual(bonus, 0.10000000149011612)
        self.assertEqual(load("EnemyAgeScalingLibrary.json")["0"]["Health"], 70.0)

    def test_every_playable_equipment_has_an_image_and_native_korean_name(self):
        lib = load("ItemBalancingLibrary.json")
        maximum = load("BaseConfig.json")["MaxAge"]
        playable = {key for key, row in lib.items() if 0 <= row["ItemId"]["Age"] <= maximum}
        mapping = load("AutoItemMapping.json")
        self.assertEqual(len(mapping), 231)
        mapped = set()
        for item in mapping.values():
            key = str({"Age": item["Age"], "Type": item["TypeName"], "Idx": item["Idx"]})
            mapped.add(key)
            self.assertIn(key, lib)
            self.assertTrue(item["KoreanName"].strip())
            self.assertTrue((ASSETS / (item["SpriteName"] + ".png")).is_file())
        self.assertEqual(mapped, playable)

    def test_companion_ids_and_atlas_bounds_match_the_same_release(self):
        manual = load("ManualSpriteMapping.json")
        for group, library, field, count in [
            ("pets", "PetLibrary.json", "PetId", 25),
            ("mounts", "MountLibrary.json", "MountId", 15),
        ]:
            expected = {(row[field]["Rarity"], row[field]["Id"]) for row in load(library).values()}
            actual = {(row["rarity"], row["id"]) for row in manual[group]["mapping"].values()}
            self.assertEqual(actual, expected)
            self.assertEqual(len(actual), count)
        self.assertEqual({row["name"] for row in manual["skills"]["mapping"].values()},
                         set(load("SkillLibrary.json")))
        self.assertEqual(len(load("SkillLibrary.json")), 18)
        for group in ("pets", "mounts", "skills"):
            atlas = manual[group]
            with Image.open(ASSETS / atlas["texture"]) as image:
                columns = image.width // atlas["sprite_size"]["width"]
                rows = image.height // atlas["sprite_size"]["height"]
                self.assertLess(max(map(int, atlas["mapping"])), columns * rows)

    def test_all_pngs_decode_with_the_verified_apk_pixels(self):
        report = load("asset-report.json")
        self.assertEqual(report["summary"]["apkSourceCount"], 286)
        self.assertEqual(report["summary"]["supplementalCount"], 1)
        self.assertEqual(len(list(ASSETS.glob("*.png"))), 287)
        entries = report["files"]
        entries = entries.values() if isinstance(entries, dict) else entries
        for entry in entries:
            filename = entry.get("filename") or entry.get("name")
            with self.subTest(image=filename):
                with Image.open(ASSETS / filename) as image:
                    image.load()
                    self.assertEqual(image.format, "PNG")
                    self.assertEqual(hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest(),
                                     entry["rgbaSha256"])


if __name__ == "__main__":
    unittest.main()

"""Guard the coherent 2.12.1 catalog, new rarity art, and battle/skin assets."""
import hashlib
import json
from pathlib import Path
import unittest
import importlib.util

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/releases/live_2_12_1"
ASSETS = ROOT / "assets/releases/live_2_12_1"
COMMIT = "8324dd087250f53fe97dd76b511c1da9b58a758d"
SPEC = importlib.util.spec_from_file_location("build_live_release", ROOT / "scripts/build_live_release.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class LiveReleaseTests(unittest.TestCase):
    def test_all_files_match_the_pinned_release_and_raw_tables_are_unmodified(self):
        release, integrity, report = load("release.json"), load("integrity.json"), load("source-report.json")
        self.assertEqual(release["gameVersion"], "2.12.1")
        self.assertEqual(release["sourceCommit"], COMMIT)
        self.assertFalse(release["configValuesFromApk"])
        self.assertEqual(len(report["tables"]), 78)
        actual = {str(p.relative_to(ROOT)) for folder in (DATA, ASSETS)
                  for p in folder.iterdir() if p.name != "integrity.json"}
        self.assertEqual(actual, set(integrity["files"]))
        for relative, expected in integrity["files"].items():
            with self.subTest(file=relative):
                content = (ROOT / relative).read_bytes()
                self.assertEqual(len(content), expected["bytes"])
                self.assertEqual(hashlib.sha256(content).hexdigest(), expected["sha256"])
        for table in report["tables"]:
            self.assertTrue(table["unmodifiedBytes"])
            content = (DATA / table["outputFilename"]).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), table["sourceSha256"])

    def test_every_item_uses_the_current_identity_and_exact_localization_id(self):
        mapping, localization = load("AutoItemMapping.json"), load("Localization.json")
        library, tiers = load("ItemBalancingLibrary.json"), load("GameTiers.json")
        ages = {row["index"] for row in tiers["ages"]}
        self.assertEqual(ages, set(range(13)))
        self.assertEqual(len(tiers["rarities"]), 9)
        expected = {key for key, value in library.items() if value["ItemId"]["Age"] in ages}
        actual = set()
        for item in mapping.values():
            actual.add(str({"Age": item["Age"], "Type": item["TypeName"], "Idx": item["Idx"]}))
            # New IDs exceed 2**53; coercing them to a JS number corrupts the join.
            self.assertIsInstance(item["LocalizationId"], str)
            self.assertEqual(item["KoreanName"], localization["items"][item["LocalizationId"]]["ko"])
            self.assertTrue((ASSETS / (item["SpriteName"] + ".png")).is_file())
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), 295)
        self.assertEqual(sum(item["Age"] >= 10 for item in mapping.values()), 64)
        # The old APK's positional keys differ here; names must follow localization identity.
        self.assertEqual(mapping["0_0_2"]["ItemName"], "WarMask")
        self.assertEqual(mapping["0_0_3"]["KoreanName"], "페이스 페인트")

    def test_catalog_includes_all_companions_and_ascension_three_icons(self):
        catalog = load("game-data.json")
        self.assertEqual(catalog["counts"], {"equipment": 295, "pets": 34, "mounts": 21,
                                           "skills": 27, "skins": 114, "ages": 13, "rarities": 9})
        for kind, file, field, new_count in (("pets", "PetLibrary.json", "PetId", 9),
                                             ("mounts", "MountLibrary.json", "MountId", 6),
                                             ("skills", "SkillLibrary.json", None, 9)):
            library = load(file)
            expected = {f"{x[field]['Rarity']}_{x[field]['Id']}" for x in library.values()} if field else set(library)
            self.assertEqual({x["key"] for x in catalog[kind]}, expected)
            newest = [x for x in catalog[kind] if x["rarity"] in ("Heroic", "Infinite", "Eternal")]
            self.assertEqual(len(newest), new_count)
            for item in newest:
                with self.subTest(item=item["key"]):
                    self.assertEqual(item["minimumAscension"], 3)
                    self.assertEqual(item["icons"][:3], [None, None, None])
                    icon = item["icons"][3]
                    self.assertTrue(item["KoreanName"])
                    with Image.open(ASSETS / icon["texture"]) as image:
                        self.assertLessEqual(icon["x"] + icon["w"], image.width)
                        self.assertLessEqual(icon["y"] + icon["h"], image.height)
                        crop = image.convert("RGBA").crop((icon["x"], icon["y"],
                                                          icon["x"] + icon["w"], icon["y"] + icon["h"]))
                        self.assertIsNotNone(crop.getchannel("A").getbbox())
            if kind == "skills":
                self.assertEqual({x["icons"][3]["texture"] for x in newest}, {"SkillIcons.png"})

    def test_full_skin_and_battle_art_use_exact_rectangles(self):
        skins, icons, battle = load("SkinsLibrary.json"), load("SkinIcons.json"), load("BattleVisuals.json")
        self.assertEqual({f"{x['SkinId']['Type']}_{x['SkinId']['Idx']}" for x in skins.values()}, set(icons["icons"]))
        self.assertEqual(len(icons["icons"]), 114)
        self.assertIn("Helmet_123", icons["icons"])
        self.assertIn("Weapon_29", icons["icons"])
        self.assertEqual(len(battle["sprites"]), 1418)
        dimensions = {x["filename"]: (x["width"], x["height"]) for x in load("asset-report.json")["files"]}
        for rect in [*icons["icons"].values(), *battle["sprites"].values()]:
            width, height = dimensions[rect["tex"] + ".png"]
            self.assertGreater(rect["w"], 0)
            self.assertGreater(rect["h"], 0)
            self.assertGreaterEqual(rect["x"], 0)
            self.assertGreaterEqual(rect["y"], 0)
            self.assertLessEqual(rect["x"] + rect["w"], width)
            self.assertLessEqual(rect["y"] + rect["h"], height)

    def test_new_progression_is_not_replaced_by_old_default_limits(self):
        for file in ("SkillSummonConfig.json", "EggSummonConfig.json", "MountSummonConfig.json"):
            rows = load(file)["Ascensions"]
            self.assertEqual(len(rows[0]["Levels"]), 100)
            self.assertEqual(rows[1:3], [None, None])
            self.assertEqual(len(rows[3]["Levels"]), 50)
        forge = load("ForgeUpgradeLibrary.json")
        self.assertEqual(len(forge["0"]["ForgeLevelConfigs"]) + len(forge["3"]["ForgeLevelConfigs"]), 49)
        self.assertEqual(len(load("PlayerTechTreeTierLibrary.json")), 6)
        self.assertEqual(load("DungeonBaseConfig.json")["MaxDungeonLevel"], 499)

    def test_every_published_png_decodes_and_keeps_its_source_pixels(self):
        report = load("asset-report.json")
        self.assertEqual(len(report["files"]), 366)
        for entry in report["files"]:
            with self.subTest(image=entry["filename"]):
                with Image.open(ASSETS / entry["filename"]) as image:
                    image.load()
                    self.assertEqual(image.format, "PNG")
                    self.assertEqual(image.size, (entry["width"], entry["height"]))
                    self.assertEqual(hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest(), entry["rgbaSha256"])

    def test_asset_selection_keeps_all_battle_art_without_unreferenced_images(self):
        battle = load("BattleVisuals.json")
        expected = BUILDER.required_textures(battle, load("AutoItemMapping.json"), load("ManualSpriteMapping.json"),
                                             load("SkinIcons.json"), load("GameTiers.json"),
                                             load("TechTreeMapping.json"), load("ClanTechTreeIconsMap.json"))
        actual = {p.name for p in ASSETS.glob("*.png")}
        self.assertEqual(actual, expected)
        self.assertTrue({name + ".png" for name in battle["textures"]}.issubset(actual))
        self.assertNotIn("Icons.png", actual)
        self.assertNotIn("InputFieldBackground.png", actual)
        self.assertFalse(any("SDF" in name for name in actual))

    def test_one_fetch_config_bundle_preserves_all_78_tables_and_skin_sets(self):
        bundled = load("game-configs.json")
        tables = load("source-report.json")["tables"]
        self.assertEqual(set(bundled), {Path(table["outputFilename"]).stem for table in tables})
        self.assertEqual(len(bundled), 78)
        self.assertEqual(len(bundled["SetsLibrary"]), 30)
        self.assertNotIn("Localization", bundled)
        self.assertNotIn("BattleVisuals", bundled)
        for table in tables:
            name = table["outputFilename"]
            self.assertEqual(bundled[Path(name).stem], load(name))


if __name__ == "__main__":
    unittest.main()

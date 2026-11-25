"""Build the pinned public 2.12.1 game snapshot without modifying older releases.

Usage: python scripts/build_live_release.py --source ../forge-master-upstream
The source checkout must be the exact commit below. No network access is used.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image


RELEASE = "live_2_12_1"
GAME_VERSION = "2.12.1"
COMMIT = "8324dd087250f53fe97dd76b511c1da9b58a758d"
SNAPSHOT = "2026_11_16_09_55"
REPOSITORY = "https://github.com/1vcian/fm"
APPLE_RELEASES = "https://apps.apple.com/us/app/forge-master-idle-rpg/id6746636289"
DATA = Path("data/releases") / RELEASE
ASSETS = Path("assets/releases") / RELEASE
MAPPINGS = ("AutoItemMapping.json", "ManualSpriteMapping.json", "TechTreeMapping.json",
            "ClanTechTreeIconsMap.json", "IconsMap.json", "Localization.json")
ASCENSION_SHEETS = {
    "pets": ["Pets.png", "MegaPets.png", "UltraPets.png", "ApexPets.png"],
    "mounts": ["MountIcons.png", "MegaMountIcons.png", "UltraMountIcons.png", "ApexMountIcons.png"],
    "skills": ["SkillIcons.png", "MegaSkillIcons.png", "UltraSkillIcons.png", "ApexSkillIcons.png"],
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=None if compact else 2,
                      separators=(",", ":") if compact else None, allow_nan=False)
    path.write_text(text + "\n", encoding="utf-8")


def decoded(path):
    with Image.open(path) as image:
        image.load()
        if image.format != "PNG":
            raise ValueError(f"Not a PNG: {path}")
        return image.size, image.convert("RGBA").tobytes()


def safe_png_name(name):
    if Path(name).name != name or not name.endswith(".png"):
        raise ValueError(f"Unsafe texture filename: {name}")
    return name


def source_record(source, path, output):
    return {"sourcePath": str(path.relative_to(source)), "sourceSha256": sha(path.read_bytes()),
            "outputSha256": sha(output.read_bytes()), "outputFilename": output.name,
            "unmodifiedBytes": path.read_bytes() == output.read_bytes()}


def icon_rect(icon, atlas, sizes):
    if icon is None:
        return None
    name = safe_png_name(icon["texture"])
    spec = atlas.get("sheets", {}).get(name, atlas)
    w, h = spec["sprite_size"]["width"], spec["sprite_size"]["height"]
    columns = spec["grid"]["columns"]
    cell = icon["cell"]
    return {"texture": name, "cell": cell, "x": (cell % columns) * w,
            "y": (cell // columns) * h, "w": w, "h": h,
            "texW": sizes[name][0], "texH": sizes[name][1]}


def validate_rect(rect, sizes):
    name = rect.get("texture") or (rect["tex"] + ".png")
    width, height = sizes[safe_png_name(name)]
    x, y, w, h = (rect[key] for key in ("x", "y", "w", "h"))
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > width or y + h > height:
        raise ValueError(f"Sprite rectangle outside {name}: {rect}")


def required_textures(battle, item_map, manual, skin_icons, tiers, tech_map, clan_map):
    """Only textures reachable from battle visuals or a published catalog icon."""
    names = {safe_png_name(name + ".png") for name in battle["textures"]}
    names.update(safe_png_name(row["SpriteName"] + ".png") for row in item_map.values())

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("texture", "tex") and isinstance(child, str):
                    names.add(safe_png_name(child if child.endswith(".png") else child + ".png"))
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    for kind in ("pets", "mounts", "skills"):
        atlas = manual[kind]
        for index, item in atlas["mapping"].items():
            icons = item.get("icons")
            if icons is None:
                icons = [{"texture": name, "cell": int(index)} for name in ASCENSION_SHEETS[kind]]
            visit(icons)
    for value in (skin_icons, tiers, tech_map, clan_map):
        visit(value)
    return names


def build_catalog(config, item_map, manual, localization, skin_icons, sizes):
    tiers = config["GameTiers.json"]
    allowed_ages = {age["index"] for age in tiers["ages"]}
    equipment = []
    for key, item in item_map.items():
        item_id = {"Age": item["Age"], "Type": item["TypeName"], "Idx": item["Idx"]}
        definition = config["ItemBalancingLibrary.json"][str(item_id)]
        if item["Age"] not in allowed_ages:
            raise ValueError(f"Item age outside GameTiers: {key}")
        equipment.append({"key": key, **item, "definition": definition})
    catalog = {"schemaVersion": 1, "releaseId": RELEASE, "gameVersion": GAME_VERSION,
               "sourceCommit": COMMIT, "snapshot": SNAPSHOT,
               "assetPath": str(ASSETS), "equipment": equipment,
               "ages": tiers["ages"], "rarities": tiers["rarities"],
               "ageKoreanNames": {k: v.get("ko") for k, v in localization["ages"].items()},
               "rarityKoreanNames": {k: v.get("ko") for k, v in localization["rarities"].items()}}
    for kind, library, id_field in (("pets", "PetLibrary.json", "PetId"),
                                     ("mounts", "MountLibrary.json", "MountId"),
                                     ("skills", "SkillLibrary.json", None)):
        atlas = manual[kind]
        rows = []
        for index, item in atlas["mapping"].items():
            if id_field:
                item_id = {"Rarity": item["rarity"], "Id": item["id"]}
                definition = config[library][str(item_id)]
                key = f"{item['rarity']}_{item['id']}"
                rarity = item["rarity"]
            else:
                definition = config[library][item["name"]]
                key, rarity = item["name"], definition["Rarity"]
            icons = item.get("icons")
            if icons is None:
                icons = [{"texture": name, "cell": int(index)} for name in ASCENSION_SHEETS[kind]]
            rects = [icon_rect(icon, atlas, sizes) for icon in icons]
            for rect in rects:
                if rect is not None:
                    validate_rect(rect, sizes)
            rows.append({"key": key, "name": item["name"], "rarity": rarity,
                         "KoreanName": item.get("KoreanName"), "EnglishName": item.get("EnglishName"),
                         "spriteIndex": int(index), "icons": rects,
                         "minimumAscension": next(i for i, rect in enumerate(rects) if rect is not None),
                         "definition": definition})
        catalog[kind] = rows
    skins = []
    for definition in config["SkinsLibrary.json"].values():
        skin_id = definition["SkinId"]
        key = f"{skin_id['Type']}_{skin_id['Idx']}"
        icon = skin_icons["icons"][key]
        validate_rect(icon, sizes)
        skins.append({"key": key, "type": skin_id["Type"], "id": skin_id["Idx"],
                      "setId": definition["BaseSetId"], "KoreanName": None,
                      "icon": icon, "definition": definition})
    catalog["skins"] = skins
    catalog["counts"] = {key: len(catalog[key]) for key in
                         ("equipment", "pets", "mounts", "skills", "skins", "ages", "rarities")}
    return catalog


def build(source, root, check_only=False):
    head = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    if head != COMMIT:
        raise ValueError(f"Expected source commit {COMMIT}; got {head}")
    subprocess.run(["git", "-C", str(source), "diff", "--quiet", "HEAD", "--",
                    "public/parsed_configs", f"public/Texture2D/{SNAPSHOT}"], check=True)
    parsed = source / "public/parsed_configs"
    texture_dir = source / "public/Texture2D" / SNAPSHOT
    filenames = read_json(parsed / "config_manifest.json")[SNAPSHOT]
    if len(filenames) != 78 or set(filenames) != {p.name for p in (parsed / SNAPSHOT).glob("*.json")}:
        raise ValueError("Pinned configuration manifest is incomplete")
    with tempfile.TemporaryDirectory(prefix="fm-live-release-") as directory:
        stage = Path(directory)
        data, assets = stage / DATA, stage / ASSETS
        data.mkdir(parents=True)
        assets.mkdir(parents=True)
        config, table_sources = {}, []
        for name in filenames:
            original = parsed / SNAPSHOT / name
            config[name] = read_json(original)
            shutil.copyfile(original, data / name)
            table_sources.append(source_record(source, original, data / name))

        localization = read_json(parsed / "Localization.json")
        item_map = read_json(parsed / "AutoItemMapping.json")
        manual = read_json(parsed / "ManualSpriteMapping.json")
        for item in item_map.values():
            # Localization IDs are strings; some exceed JavaScript's safe integer range.
            words = localization["items"].get(str(item["LocalizationId"]), {})
            item["KoreanName"] = words.get("ko") or None
            item["EnglishName"] = words.get("en") or item["ItemName"]
        for kind in ("pets", "mounts", "skills"):
            for item in manual[kind]["mapping"].values():
                key = item["name"] if kind == "skills" else f"{item['rarity']}_{item['id']}"
                words = localization[kind].get(key, {})
                item["KoreanName"] = words.get("ko") or None
                item["EnglishName"] = words.get("en") or item["name"]
        mapping_sources = []
        for name in MAPPINGS:
            original = parsed / name
            if name == "AutoItemMapping.json":
                write_json(data / name, item_map)
            elif name == "ManualSpriteMapping.json":
                write_json(data / name, manual)
            else:
                shutil.copyfile(original, data / name)
            mapping_sources.append(source_record(source, original, data / name))
        for name in ("SkinIcons.json", "BattleVisuals.json"):
            shutil.copyfile(texture_dir / name, data / name)
            mapping_sources.append(source_record(source, texture_dir / name, data / name))

        skin_icons = read_json(data / "SkinIcons.json")
        battle = read_json(data / "BattleVisuals.json")
        names = required_textures(battle, item_map, manual, skin_icons, config["GameTiers.json"],
                                  read_json(data / "TechTreeMapping.json"),
                                  read_json(data / "ClanTechTreeIconsMap.json"))
        sizes, asset_records = {}, []
        pngs = [texture_dir / name for name in sorted(names)]
        for original in pngs:
            name = safe_png_name(original.name)
            source_bytes = original.read_bytes()
            size, pixels = decoded(original)
            chosen, reused = original, None
            for candidate in (root / "assets/game/items" / name, root / "assets/game" / name):
                if candidate.is_file() and decoded(candidate) == (size, pixels):
                    chosen, reused = candidate, str(candidate.relative_to(root))
                    break
            shutil.copyfile(chosen, assets / name)
            sizes[name] = size
            asset_records.append({"filename": name, "sourcePath": str(original.relative_to(source)),
                                  "sourcePngSha256": sha(source_bytes), "pngSha256": sha(chosen.read_bytes()),
                                  "width": size[0], "height": size[1], "rgbaSha256": sha(pixels),
                                  "reusedFrom": reused})

        catalog = build_catalog(config, item_map, manual, localization, skin_icons, sizes)
        if catalog["counts"] != {"equipment": 295, "pets": 34, "mounts": 21, "skills": 27,
                                  "skins": 114, "ages": 13, "rarities": 9}:
            raise ValueError(f"Incomplete catalog: {catalog['counts']}")
        for category in ("equipment", "pets", "mounts", "skills"):
            if not all(row.get("KoreanName") for row in catalog[category]):
                raise ValueError(f"Missing native Korean names in {category}")
        for age in catalog["ages"]:
            validate_rect(age["icon"], sizes)
        for rarity in catalog["rarities"]:
            for icon in rarity["eggIcons"]:
                if icon:
                    validate_rect(icon, sizes)
        for rect in battle["sprites"].values():
            validate_rect(rect, sizes)
        write_json(data / "game-data.json", catalog, compact=True)
        write_json(data / "game-configs.json", {Path(name).stem: table for name, table in config.items()}, compact=True)
        write_json(data / "versions.json", [RELEASE, "apk_2_11_1"])
        write_json(data / "asset-report.json", {
            "release": RELEASE, "sourceCommit": COMMIT, "sourceSnapshot": SNAPSHOT,
            "summary": {"textureCount": len(asset_records), "battleTextureCount": len(battle["textures"]),
                        "selection": "BattleVisuals.textures plus equipment, companion, skin, GameTiers and tech icon references",
                        "pixelIdenticalReusedCount": sum(x["reusedFrom"] is not None for x in asset_records),
                        "allPngsDecoded": True, "allBattleSpriteRectsInBounds": True,
                        "skinIconCount": len(skin_icons["icons"]),
                        "battleSpriteCount": len(battle["sprites"])}, "files": asset_records})
        write_json(data / "source-report.json", {
            "release": RELEASE, "repository": REPOSITORY, "commit": COMMIT, "snapshot": SNAPSHOT,
            "tableCount": len(table_sources), "tables": table_sources, "mappings": mapping_sources,
            "configurationValuesFromApk2111": False,
            "configurationTransformation": "None; all 78 public snapshot JSON files retain exact source bytes.",
            "mappingTransformation": "Add KoreanName/EnglishName using LocalizationId strings for equipment, "
                                     "rarity_id for pets/mounts, and skill ID for skills. No positional joins.",
            "localizationProvenance": "Upstream src/utils/ocr/gameLocalization.ts documents Localization.json "
                                      "as generated from the game's Unity Localization tables.",
            "skinIconProvenance": "SkinIcons.json contains exact asset rects; legacy ManualSpriteMapping.skins "
                                  "grid metadata is preserved for provenance and must not be used for rendering.",
            "skinNameAvailability": "Localization.json contains no skin or set names. Upstream skinReader.ts "
                                    "explicitly documents that individual skin display names are absent. "
                                    "KoreanName remains null rather than borrowing an unrelated item translation.",
            "versionEvidence": [{"url": APPLE_RELEASES, "version": GAME_VERSION,
                                 "description": "Developer release history associates the three new ages and "
                                                "new gear, skills, pets and mounts with 2.12.1, November 16."},
                                {"url": REPOSITORY + "/commit/f58716e5da411e525013344d01082c24522b01d6",
                                 "description": "Upstream commit explicitly identifies the new mount schema as 2.12.1."}]})
        write_json(data / "release.json", {
            "id": RELEASE, "gameVersion": GAME_VERSION,
            "packageName": "com.hariwn.legendofcivilizations",
            "scope": "Pinned public 2.12.1 configuration and game assets; not the uploaded 2.11.1 APK.",
            "sourceRepository": REPOSITORY, "sourceCommit": COMMIT, "sourceSnapshot": SNAPSHOT,
            "configTableCount": len(table_sources), "textureCount": len(asset_records),
            "equipmentCount": 295, "equipmentKoreanNameCount": 295, "petCount": 34, "mountCount": 21,
            "skillCount": 27, "skinCount": 114, "skinIconCount": len(skin_icons["icons"]), "skinKoreanNameCount": 0,
            "ageCount": 13, "rarityCount": 9, "dataPath": str(DATA), "assetPath": str(ASSETS),
            "catalogPath": str(DATA / "game-data.json"), "configValuesFromApk": False,
            "configBundlePath": str(DATA / "game-configs.json"),
            "publicSchema": True, "minimumAscensionForNewTiers": 3,
            "versionEvidence": APPLE_RELEASES,
            "limitations": ["This is a pinned public game-data snapshot, not a live server connection.",
                            "ManualSpriteMapping.skins is legacy metadata; use SkinIcons.json for all 114 skin icons."]})
        files = {}
        for folder in (data, assets):
            for path in sorted(folder.iterdir()):
                content = path.read_bytes()
                files[str(path.relative_to(stage))] = {"bytes": len(content), "sha256": sha(content)}
        write_json(data / "integrity.json", {"release": RELEASE, "sourceCommit": COMMIT, "files": files})
        if not check_only:
            previous_path = root / DATA / "integrity.json"
            previous = read_json(previous_path).get("files", {}) if previous_path.exists() else {}
            prune = []
            for folder in (DATA, ASSETS):
                destination = root / folder
                destination.mkdir(parents=True, exist_ok=True)
                unexpected = {p.name for p in destination.iterdir()} - {p.name for p in (stage / folder).iterdir()}
                for name in unexpected:
                    path = destination / name
                    known = previous.get(str(folder / name))
                    if folder != ASSETS or not known or sha(path.read_bytes()) != known["sha256"]:
                        raise ValueError(f"Unexpected or changed file in new release: {path}")
                    prune.append(path)
            for folder in (DATA, ASSETS):
                for path in (stage / folder).iterdir():
                    shutil.copyfile(path, root / folder / path.name)
            for path in prune:
                path.unlink()
        print(json.dumps({"release": RELEASE, "counts": catalog["counts"],
                          "configTables": len(table_sources), "textures": len(asset_records),
                          "checkOnly": check_only}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    build(args.source.resolve(), args.root.resolve(), args.check_only)

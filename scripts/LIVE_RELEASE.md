# Public game data 2.12.1

`build_live_release.py` creates `data/releases/live_2_12_1` and
`assets/releases/live_2_12_1` from commit
`8324dd087250f53fe97dd76b511c1da9b58a758d` of
[1vcian/fm](https://github.com/1vcian/fm). It never edits `apk_2_11_1`.

```sh
python scripts/build_live_release.py --source ../forge-master-upstream
python -m unittest discover -s tests -p 'test_live_release.py'
```

The source checkout must contain `public/parsed_configs`, the November 16
configuration folder, and its `public/Texture2D/2026_11_16_09_55` folder. The
builder checks the commit, requires clean source files, validates every PNG and
all referenced icon/battle rectangles, stages the complete release, then copies
the result. `--check-only` validates without publishing files. No network access
is required. Output has no changing timestamps and is reproducible with the same
repository inputs.

## Version and provenance

The developer's [App Store version history](https://apps.apple.com/us/app/forge-master-idle-rpg/id6746636289)
attributes Heroic, Infinite and Eternal gear and new skills, pets and mounts to
**2.12.1, November 16**. Its 2.11.1 entry lists bug fixes. The public snapshot is
therefore labeled 2.12.1, separately from the older uploaded APK.

All 78 snapshot JSON tables retain their exact bytes. Root mapping files are
pinned to the same repository commit. Only the equipment and companion mappings
are enriched with `KoreanName` and `EnglishName` from `Localization.json`, which
upstream documents as extracted from Unity Localization tables. Equipment joins
use exact string `LocalizationId`, never an old item index. All 295 equipment,
34 pet, 21 mount and 27 skill records have Korean names. The 114 skins retain
their exact game IDs and set IDs; no unverified localized skin names are invented.

The 366 referenced PNGs from that texture snapshot are included for the playable
sandbox. This is the union of all 364 `BattleVisuals.textures` entries and the
equipment, companion, skin, GameTiers and tech icon references. Unreferenced
loading screens, font atlases and advertising/interface art are excluded.
Existing `assets/game` PNG bytes are reused only after matching dimensions and
every decoded RGBA pixel. `asset-report.json` records both source PNG hashes and
output pixel hashes; `integrity.json` covers every published data/asset file.

## Catalog and rendering contract

`game-configs.json` is a one-fetch bundle of all 78 original configuration tables,
keyed by filename without `.json`, including all 30 `SetsLibrary` entries.
`Localization` and `BattleVisuals` are separate and are not duplicated in that
bundle. The parsed values exactly match the original standalone files.

`game-data.json` is a compact catalog for one-fetch initialization. Its arrays are
`equipment`, `pets`, `mounts`, `skills`, `skins`, `ages`, and `rarities`.

- Equipment retains `Age`, `TypeName`, `Idx`, `LocalizationId`, `SpriteName`,
  `KoreanName`, `EnglishName`, and a stable `key`. `definition` is the exact
  corresponding `ItemBalancingLibrary` record.
- Pets/mounts use `Rarity_Id` keys, and skills use their enum names. Each has
  `definition`, `rarity`, names, `minimumAscension`, and four `icons`. A non-null
  icon has `texture`, `x`, `y`, `w`, `h`, `texW`, and `texH`. The first three icons
  of the new rarities are null; use the icon at `minimumAscension` for a catalog
  preview while making the ascension requirement explicit.
- Skins use `Type_Idx` keys and `icon` rects copied from `SkinIcons.json`. Rects
  use `tex` (without `.png`), `x`, `y`, `w`, `h`, `texW`, and `texH`. Never render
  these using the legacy `ManualSpriteMapping.skins` 800-pixel grid: its geometry
  is stale and omits 14 skins. `SkinIcons.json` covers all 114 with exact rects.
  `KoreanName` is null: this source contains no localized skin or set names;
  upstream `skinReader.ts` documents this limitation. Use a separately labeled
  UI translation of the set/type, or the original ID, for display.
- `BattleVisuals.json` contains 1,418 sprites, 697 prefabs, 253 animation clips,
  154 controllers, 13 ages, all 114 skin visuals, 27 skill visuals, and complete
  pet/mount rarity visual tables. Sprite positions are already in PNG
  coordinates; use their pivots and pixels-per-unit values when composing art.
- All original balancing, weapons, enemies, stages, ascensions, tech trees,
  upgrade and summon files are available alongside the compact catalog.

New skills use the base `SkillIcons.png` even at ascension 3. New pets and mounts
use the two `HeroicEternalInfinite*.png` sheets. Read the supplied icon rects;
choosing a sheet solely from ascension produces blank or incorrect art.

## Progression schema

Use `GameTiers.json` for 13 ages and 9 rarities; `BaseConfig.MaxAge` was removed.
Summon configuration uses `Ascensions`: append the 100 rows from index 0 and
the 50 rows from index 3, carrying earlier rows through null indices. Forge
upgrades similarly append 34 rows from ascension 0 and 15 from ascension 3,
reaching forge level 50. There are six player tech tiers and dungeon indices
0 through 499. These files are preserved as supplied; the sandbox decides how
to expose unlock conditions and editable test values.

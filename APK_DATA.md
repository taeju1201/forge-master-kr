# Forge Master 2.11.1 data release

The default KR app uses the uploaded Forge Master **2.11.1 / versionCode 21101**
APK, package `com.hariwn.legendofcivilizations`. Configurations and images are
published together under the immutable release ID `apk_2_11_1`.

This is the APK's embedded base configuration. It does not claim equivalence to
later server-delivered LiveOps data or current seasonal fairy effects.

## Sources and verification

| Source | SHA-256 |
| --- | --- |
| Uploaded XAPK | `1c4f11cafee2917d77a1164d2bccb1286e0b001d62474169bfefda3f67f96f77` |
| Main APK | `aa9597960e1b8afa7fc93eb4eca844bcf1d46a12752959356d637f44c89ae66f` |
| `assets/SharedGameConfig.mpa` | `1415ce389e9771769f103eca03f02e10f71603f79f845303a3b0ae30d1a66c6c` |

The MCA v5 archive was created on **2026-10-20 at 11:38:07.060 UTC**. All 77
configuration tables were decompressed, decoded to their end, and re-serialized
byte for byte. Published numeric and text values come from those APK payloads.

Field names, enum labels and polymorphic names are correlated with
`1vcian/fm` commit `8324dd087250f53fe97dd76b511c1da9b58a758d`, directory
`public/parsed_configs/2026_10_27_09_45`. Shape and enum consistency checks are
mandatory. APK metadata confirms the special `F1D`/`FD6` numeric wrappers.
The October reference supplies the schema, not replacement balancing values.

Six tables contain 31 numeric differences from that public reference:
AchievementLibrary, AscensionStarsBonusLibrary, GuildBaseConfig,
GuildTechRaceRewardLibrary, MissionRallyTimeLibrary, and WorldIndexConfigLibrary.
For example, this APK has a 0.10000000149011612 per-star bonus where the public
reference has 0.05000000074505806. Those APK differences are preserved.
Nullable text also stays null rather than being converted to an empty string.

The November public snapshot introduces a different schema and different
atlases. It is not silently substituted for this APK release.

## Published content

- 77 decoded config tables, with per-table source and output hashes.
- 231 playable equipment images and exact Korean names from APK `Items_ko`.
- 25 pets, 15 mounts and 18 skills with compatible sprite mappings.
- 286 extracted game textures: 231 equipment, 51 core images and four egg sheets.
- One supplemental `Icons.png` interface atlas retained from the KR app. It is
  explicitly marked as supplemental, not as an APK-extracted texture.

281 texture files reuse existing encoded PNG bytes after dimensions and every
decoded RGBA byte matched the APK extraction. Five use the newly extracted PNG
bytes. All 286 game textures have identical pixels to the APK extraction.

`data/releases/apk_2_11_1/release.json` describes the release.
`source-report.json` records config provenance and differences;
`asset-report.json` records image sources and pixel hashes; `integrity.json`
covers every published config, metadata file and image. The original APK is
not redistributed in this repository.

Reproduce config decoding with the CLI and instructions in
[`scripts/apk_config/README.md`](scripts/apk_config/README.md).

## App behavior

The existing `fmkr_rebuild_v1` storage key and all profiles remain in use. On the
first upgrade from the previous default, the exact original JSON is backed up
as `fmkr_rebuild_v1_backup_before_apk_2_11_1`, then only the release pointer is
changed. Explicitly selected versions stay selected. A failed backup retains
the old state; invalid JSON or an invalid profile envelope is not overwritten.

Equipment calculations now read the configured level growth and complete
Forge ascension multiplier: stages 0/1/2/3 are 1/50/2,500/125,000. The profile,
equipment encyclopedia and optimizer use the same function. Equipment levels
are not capped at an arbitrary 99 or 150 because technology can affect limits.

Summon probability uses the current level row; the next level requirement uses
the following row. The last level displays MAX. Costs use the configured batch
size and round once after applying the discount. Companion encyclopedia inputs
use the configured level cap and integer levels. Equipment names and search
results use the APK's Korean strings.

Profile totals remain equipment Damage/Health, not complete combat totals.
Summon expected amounts hold the selected level's probabilities fixed; they do
not simulate probabilities changing during a long summoning session. Seasonal
fairy effects absent from the APK are not assigned invented bonuses or ranking
weights. Fairy choice, level and per-currency upgrade alternatives remain
available. The removed skins menu remains removed.

The hourly image collector remains enabled for `assets/game`. It does not
modify these pinned release directories. HTML source replacement remains paused
because the historical source uses an incompatible profile storage format.

## Checks

```sh
python -m pip install Pillow==11.3.0
python -m unittest discover -s tests -v
node tests/test_profile_migration.cjs
node tests/test_game_math.cjs
bash -n scripts/publish_sync.sh
```

The release tests check all file hashes, decode all PNGs, verify pixel hashes,
check every playable equipment mapping and Korean name, and validate companion
IDs against their matching atlases. Migration tests cover multiple profiles,
explicit version choices, exact backups, storage failures and invalid saves.

# Forge Master KR TEST WORLD

The main GitHub Pages route is now a playable, independent browser test world. The former calculator is retained at `archive/kr-2.11.1/` as an in-memory, non-persisting historical view. Its original profile and versioned APK files remain intact.

## Data and features

- Fixed game 2.12.1 source snapshot `2026_11_16_09_55`, upstream commit `8324dd087250f53fe97dd76b511c1da9b58a758d`.
- 295 equipment pieces, 34 pets, 21 mounts, 27 skills, 114 skins; 13 equipment ages and 9 companion rarities.
- Eight equipment slots, three pets and active skills, one mount, three cosmetic slots, separate ascensions, personal and clan technologies.
- Equipment level-one Damage/Health overrides and per-slot secondary stats. Mount overrides replace the selected-level table before technology and ascension. Final player overrides apply last. Percent inputs convert to engine fractions.
- Main stages/waves from available enemy configs, selectable difficulty, custom training opponents, seeded real-time attacks, cooldowns, manual skills, speed controls, pause/restart and optional progression.
- Local state `fmkr_test_world_v1` is independent of the historical `fmkr_rebuild_v1`. Invalid stored JSON disables autosave without replacing the original. Valid imports back up the previous raw state before replacement.

## Combat coverage

`game/engine.js` is an original deterministic sandbox engine using public configuration fields, not the original game's executable. A fixed 0.05-second step handles movement, ordinary attacks, critical and double hits, block, lifesteal, regeneration, shields, timed buffs, cooldowns and stage victory/defeat.

Active damage skills use configured total damage and simplified hits against the nearest living target. The original game's exact area collisions, projectile paths, fixed-point rounding, drone AI and particle effects are not reproduced. Pets contribute configured type-based stats and selected secondary options; no separate pet-active library is provided by this snapshot. Economy, crafting waits, account servers, purchases and multiplayer are outside this local battle test world.

Enemy stages exist only for age indices 0–10; equipment from ages 11–12 remains available in any battle. No missing enemy stage values are invented. The custom-opponent mode allows arbitrary tests.

## Files and verification

- `game/main.js`: original UI and battle lifecycle, including validated persistence and state/engine adapter.
- `game/state.js`: catalog-based validation, presets, save/import/export and backup isolation.
- `game/engine.js`: pure browser/CommonJS stat and combat model.
- `game/renderer.js`: sprite rendering and visual adapter; attribution is recorded alongside its source.
- `data/releases/live_2_12_1/game-configs.json`: the same 78 source configs in one browser fetch.
- `data/releases/live_2_12_1/game-data.json`: complete localized selectable catalog.
- `scripts/LIVE_RELEASE.md`: pinned source, asset and catalog details.

Run `npm test` and `python -m unittest discover -s tests -v`. The engine/state tests sweep every current catalog item and the configured battle entries, plus save safety, stat zeros, deterministic combat and cooldown behavior. Browser integration checks must also confirm that UI changes reach the actual battle state.

Run `npm run dev` to serve the repository locally. GitHub Pages serves the root directly; no build or package installation is required.

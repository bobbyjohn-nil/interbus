# Model contract

*Draft v0, written 2026-10-12, for the artist to review and amend. The artist (the co-developer) makes the models the game uses; the owner approves changes to this file, and agreed changes are noted in `docs/DECISIONS.md`. Lesson IDs (RN-07 …) are in [lessons-ledger.md](../history/lessons-ledger.md) and bug IDs (K09 …) in [salvage-matrix.md](../history/salvage-matrix.md). For the Oct 18 review, §3, §3.1, §5, §6 and §10 are the page that matters; the rest is reference.*

**Why this file is short and the pipeline is small.** V1 and V3 both built model pipelines before any model existed, and none ever arrived: V1's drop-in contract and V3's 703-line pipeline still have zero model files in their history ([RN-07](../history/lessons-ledger.md), [X-15](../history/lessons-ledger.md)). This time the pipeline is built in the week the artist's first file lands, and only as far as that file needs. Until then this contract is the only artefact.

## 1. What a model is for

One model drives both views, so 2D and 3D always match:

- **2D and far 3D:** CI renders the model straight down into the bus's map icon. The roof *is* the icon (§5).
- **Near 3D** (zoom ≥ 17, map tilted, where a bus is about 20 px long at true scale; PLAN §6): the model itself, drawn instanced, with one draw call per family. V1 drew 18–33 per bus ([K09](../history/salvage-matrix.md), [X-14](../history/lessons-ledger.md)).
- **In the game, only base colour and emissive show.** Lighting is simple (Lambert) and kept inside a fixed brightness envelope ([RN-06](../history/lessons-ledger.md)). There are no reflections or shadow maps, so time spent on roughness, metal or normal maps is wasted.
- **The game never waits for art.** Every class has a built-in fallback (§10).
- **The Steam build ships the same files.** Nothing here changes for desktop.

## 2. What matters for v1.0

| Priority | Class | Family id (= file name) | Real size | Ships in |
|---|---|---|---|---|
| 1 | Standard bus "Metro 40" (70 riders) | `metro-40` | 12.2 m long (40 ft), 2.55–2.6 m wide, ≤ 3.4 m tall | v1.0 |
| 2 | Minibus "Sparrow" (28 seats) | `sparrow` | 8.5 m, 2.35–2.5 m, ≤ 3.0 m | v1.0 |
| 2 | Articulated "Goliath" (115 riders) | `goliath` | 18.3 m (60 ft), 2.55–2.6 m, ≤ 3.4 m | v1.0 |
| 3 | Depot | `depot` | ≈ 40 × 25 m footprint | v1.0 if the buses are done, else 1.1 |
| later | Stop shelter | `shelter` | ≈ 4 × 1.5 × 2.6 m | 1.1 |
| later | Boston landmarks, replacing their extruded block | `landmark-<osm id>-<slug>` | real footprint | 1.1+ |
| never | People, interiors, a station diorama, Mk tiers | — | — | Out ([SC-05](../history/lessons-ledger.md), PLAN §2) |

Names and rider counts are the plan's ([C01](../history/salvage-matrix.md)). Lengths are checked within ±10%. **Tip:** build the Metro 40 as a kit (front cap, rear cap, window bay, door, wheel, mirror). The Sparrow is then a shorter body, and the Goliath is two bodies plus a joint.

## 3. The delivery contract

| Item | Rule |
|---|---|
| Format | glTF 2.0 binary **`.glb`**, one file per family, everything embedded. Not `.gltf`, `.fbx`, `.obj` or `.blend` |
| Units | **Metres**, true scale. The checker rejects an order-of-magnitude error (a centimetre scene) |
| Axes | **+Y up; the front faces +Z; the bus's left side faces +X** (the glTF convention). In Blender: Z up, **the front faces −Y** (it faces the viewer in *Front* view, numpad 1), and the left side faces +X. The exporter's default *+Y Up* turns Blender (x, y, z) into glTF (x, z, −y) |
| Kerb side | Boston drives on the right, so passenger doors are on the bus's **right, the −X side** |
| Origin | **Ground contact under the centre of the footprint**: lowest wheel point at y = 0, horizontal centre at x = z = 0. Transforms applied |
| Hierarchy | One root node named after the family. Optional child nodes: `Front` and `Rear` for the Goliath (both origins at the joint; a rigid 18 m model is fine for v1.0); `Door_1…n` for later; `<id>_LOD1` only if asked (§4) |
| Materials | Named slots (§3.1); ≤ 8 materials; base colour (and emissive on lights) only |
| Textures | **None on v1.0 models** (V3's rule: livery is recoloured, not painted). From 1.1 on, landmarks may carry one WebP atlas, power of two, ≤ 1024² |
| Not allowed | Cameras, lights, animation, armatures, shape keys, vertex colours, Draco compression, real logos or liveries (§11) |

### 3.1 Material slots: how company and line colours get onto the model

The game repaints by **material name**: exact and case-sensitive. Blender's `.001` suffixes are stripped with a warning. The idea comes from V1's `Brand`/`Stripe` slots (`Intralines@7af45b1:docs/MODELS.md`) and V3's `Body`/`Stripe` (`Intralines_City@dc63602:src/render/three/modelBudgets.ts`).

| Material | Required on | What the game does |
|---|---|---|
| `Body` | buses, depot | Painted in the **company colour** |
| `Stripe` | buses | Painted in the **line colour** of the route the bus is on. **It must be visible from straight above** (§5) |
| `Glass` | recommended | Kept as authored. Use a dark, low-chroma blue-grey |
| `Lights_Front` | recommended on buses | Glows at dusk. The checker uses it to confirm the front is +Z |
| `Lights_Rear` | optional | Glows red at dusk |
| anything else (`Trim`, `Tyre`, …) | — | Kept as authored. Keep these quiet and low-chroma, so the company and line colours carry the meaning |

Author `Body` and `Stripe` in any obvious placeholder colour (mid grey and green), because the game replaces them.

## 4. Budgets, per class and per LOD

| Class | LOD0 triangles (the artist authors) | LOD1 (only if asked) | Optimised file | Delivered file |
|---|---|---|---|---|
| `sparrow` | ≤ 4,000 | ≤ 700 | ≤ 100 KB | ≤ 5 MB |
| `metro-40` | ≤ 6,000 | ≤ 900 | ≤ 150 KB | ≤ 5 MB |
| `goliath` | ≤ 8,000 | ≤ 1,200 | ≤ 150 KB | ≤ 5 MB |
| `depot` | ≤ 8,000 | — | ≤ 150 KB | ≤ 5 MB |
| `shelter` (1.1) | ≤ 800 | — | ≤ 30 KB | ≤ 1 MB |
| landmark (1.1+) | ≤ 15,000 | ≤ 3,000 | ≤ 300 KB with its atlas | ≤ 10 MB |

All v1.0 models together: **≤ 600 KB** after optimisation. Over budget fails the check with the numbers, and nothing is decimated silently (V3 auto-decimated up to 2×). At 80% of a limit the checker warns.

**Measured, not guessed** (2026-10-12, on a code-generated 5,136-triangle test bus at this contract, with `@gltf-transform` 4.5.1 and `meshoptimizer` 1.3.0):
- A Blender-style float export was 329 KB (64 B/triangle). After weld, quantise and meshopt it was **27.5 KB (5.4 B/triangle), 7.8 KB gzipped**. V3 planned on 11.5 B/triangle with no model to measure (`Intralines_City@dc63602:studio/docs/design/renderer-3d.md` §4). Real models will compress less well; the first real file replaces these numbers.
- Automatic simplification toward a 900-triangle LOD1 stopped at **1,860** at every error bound tried, because separate parts and hard edges cannot collapse. So LOD1 is **not part of the first delivery**. At 60 buses in view, 60 × 8,000 = 480k triangles in at most three draw calls, which is fine for most laptops. LOD1 is requested only if the 3D frame-rate check (30 fps, 200 buses, the slowest laptop) fails, and then hand-made LOD1s beat generated ones.

## 5. The roof is the 2D icon

CI renders each model orthographically from straight above, front at the top, into a mask: R = `Body`, G = `Stripe`, B = ink (every other material, by darkness), A = coverage. The game paints the mask with the company and line colours, so the icon cannot drift from the model.
- **Rule:** from above, `Stripe` covers **≥ 15%** of the bus's pixels and `Body` **≥ 30%**. A roof band, roof-edge trim or a destination-box top all work.
- **Why:** on the test bus, a side-only stripe showed **0%** from above, so the 2D map would have lost the line colour. With a roof band at half the bus's width it showed 27.6%.
- Roof detail (an AC pod, hatches) shows as ink, which is good; wheels and side windows do not show.
- The icon is drawn at least 20 px long for the Sparrow, 24 for the Metro 40 and 32 for the Goliath (about 2 px per metre), flat to the screen even when the map tilts, so the silhouette and the stripe read; small details become a few pixels.
- The depot gets its 2D symbol the same way.
- Rendering takes about 0.3 s per model in plain Node (measured), with no browser or GPU, so it runs on every build.

## 6. What a blockout is

The first delivery of every family is a **blockout**: box-level shapes, 50–500 triangles. It is the cheapest way to fix what is expensive to change later: scale, axes, origin and slot names are "one export dialog today and a re-rig later" (`Intralines_City@dc63602:.claude/agents/modeler.md`). A blockout:
- has the final file name, true length (±10%), axes, origin and material names;
- has a body box, a roof stripe (§5), a windscreen, wheels and `Lights_Front`;
- passes every check in §8 (triangles have no minimum);
- becomes the game's 2D icon at once, and is replaced in place by the final file later.

## 7. Blender export settings

Checked against the exporter shipped with **Blender 5.2 LTS** (exporter 5.2.39) and **4.5 LTS** (4.5.47). The option names come from the add-on's source; the sources are in §13. **Before export:** set Units to Metric with Unit Scale 1.0; apply transforms with *Object → Apply → All Transforms*; turn on the *Face Orientation* overlay and check that every face is blue; rename `Body.001` to `Body`.

*File → Export → glTF 2.0 (.glb/.gltf)*

| Panel | Setting |
|---|---|
| Format | **glTF Binary (.glb)**. Tick *Remember Export Settings* |
| Include | *Selected Objects* (select the model only); Custom Properties, Cameras and Punctual Lights **off** |
| Transform | **+Y Up on** (the default) |
| Data → Scene Graph | GPU Instances, Geometry Nodes Instances and Flatten Hierarchy **off** |
| Data → Mesh | **Apply Modifiers on (the default is off)**. UVs off for untextured models. Normals on. Tangents, Attributes, Loose Edges and Points off |
| Data → Mesh → Vertex Color | Use Vertex Color: **None** |
| Data → Material | Materials: **Export**. Images: **None** (WebP Format for a textured landmark, 1.1+) |
| Shape Keys, Armature, Skinning, Animation | **Off** |
| Compression | **Draco off and Meshopt off** (5.2 only). The pipeline compresses, and Draco needs a runtime wasm decoder ([DP-11](../history/lessons-ledger.md)) |
| Copyright | `see art/LICENSE.md in the interbus repo` |

The same settings as a script, for one-click re-exports. Save the `.blend` first, select the model and run it from the Scripting tab:

```python
import bpy, os
name = "metro-40"  # family id = file name
bpy.ops.export_scene.gltf(
    filepath=os.path.join(os.path.dirname(bpy.data.filepath), name + ".glb"),
    export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
    export_texcoords=False, export_normals=True, export_tangents=False,
    export_vertex_color='NONE', export_attributes=False,
    export_materials='EXPORT', export_image_format='NONE',
    export_cameras=False, export_lights=False, export_extras=False,
    export_animations=False, export_skins=False, export_morph=False,
    export_gpu_instances=False, export_draco_mesh_compression_enable=False,
    export_copyright="see art/LICENSE.md in the interbus repo")
```

## 8. Checks: CI and the viewer run the same code

`tools/models/check.mjs` is one module run in two places: in CI on every PR that touches `art/` or `tools/models/` (under 30 s), and in the viewer page in the browser. It is written against the first blockout, in week 5, CI only ([RN-07](../history/lessons-ledger.md)); a later first file gets it the week it arrives, but not before week 13 if none has come by Nov 22.

**Fails** (with the measured value and the fix):
1. [glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) (npm `gltf-validator` 2.0.0-dev.3.10) reports any error.
2. The file is not `.glb` or is over its delivered size; it contains cameras, lights, animation, skins, morph targets or (in v1.0) textures.
3. A required slot is missing (§3.1), or the model has more than 8 materials.
4. The model is over its triangle budget, or over its optimised-size budget after `dedup → prune → weld → quantize → meshopt` (`@gltf-transform` 4.5.1, meshopt rather than Draco).
5. The length is outside ±10% or an order of magnitude off; the lowest point is more than 2 cm from y = 0; the horizontal centre is off by more than 10% of the footprint diagonal; the model is taller than it is long (a Z-up export).
6. The centre of `Lights_Front` is not at +Z (front backwards). `Door_*` nodes are not on −X.
7. Top-down coverage is below the §5 thresholds.

**Warns:** above 80% of any budget; `.001` names; no `Lights_Front` (so forward cannot be checked); unused UVs (Blender exports them by default; the pipeline strips them).

**Outputs** (built in CI, never committed): `public/models/<id>.glb`, `public/models/icons.png` and `public/models/manifest.json` (id, hash, triangles, bytes, length, slots, icon rectangle). The CI summary shows a table and the icon. **Meta-test** ([TS-07](../history/lessons-ledger.md)): code-generated bad fixtures (Z-up, centimetres, no `Stripe`, side-only stripe, backwards) must each fail, so the checker can never silently stop checking.

## 9. Files, names, Git LFS and the viewer

```
art/models/<class>/<id>.glb   the artist's deliveries (Git LFS); class = vehicles, depots, shelters, landmarks
art/refs/                     reference images, each with its source and licence
art/LICENSE.md                the art licence, separate from the code licence (§11)
art/CREDITS.md                any third-party texture, kit or font used, with its licence
tools/models/                 check.mjs and icon.mjs (§5, §8)
models.html                   the viewer page (dev server and Pages; never in the game bundle)
```

- **Names:** lowercase kebab-case, file name = family id; no `_final` or `v2` suffixes, because git keeps the history. A commit message names the step: `metro-40: blockout`, `metro-40: final`.
- **Source files:** the `.blend` files stay with the artist. Keep a backup the owner can also reach (a private art repo or a shared drive). The decision is §12 Q5.
- **Changelog:** each accepted delivery adds a line under *Unreleased* in `CHANGELOG.md`; a version is cut only when the owner says so.
- **Git LFS ([DP-11](../history/lessons-ledger.md)):** `.gitattributes` tracks `*.glb *.blend *.png *.jpg *.webp *.ktx2` before the first binary lands, as V3 did (`Intralines_City@dc63602:.gitattributes`). Anyone pushing art runs `git lfs install` once. A CI step fails if a file under `art/` is not an LFS pointer.
  - GitHub's included LFS quota for a Free account is 10 GiB of storage and 10 GiB of bandwidth a month; every pushed version counts toward storage, and Actions downloads count toward bandwidth ([GitHub docs](https://docs.github.com/en/billing/concepts/product-billing/git-lfs), checked 2026-10-12; check before relying on it).
  - The Pages deploy checks out with `lfs: true` and caches LFS objects, so a run re-downloads only changed files. Expected use is a few MB, far under the quota.
- **The viewer** (`models.html`, week 9, up to 1.5 sessions with the map preview). Drop a `.glb` and see:
  - the CI verdict, from the same module;
  - a turntable at true scale on a 1 m grid, with a 1.8 m figure and the class's target length marked;
  - back faces shown in red;
  - three company and line colour pairs;
  - the icon at its in-game length and at 8×;
  - the model on the Boston map at zoom 17, tilted, so in-map fixes can start in December.

  The artist checks work without installing anything and without waiting for a game build. Until the viewer is live, the owner reviews deliveries in a stock glTF viewer and, from week 5, in the CI summary (table and icon).

## 10. Schedule, and what happens if a model is late

| By (Sunday) | The artist delivers | Est. hours | What it unlocks |
|---|---|---|---|
| Oct 18 | Comments on this draft (§3, §3.1, §5, §6, §10 first); answers to §12; the licence line agreed with the owner | 1 | `art/LICENSE.md` exists before any `.glb` |
| **Oct 25** | **`metro-40` blockout** (the first real file) | 1–2 | Claude builds check, icon and CI around it in week 5 (CI only, ≈ 0.5 session), plus a three.js proof; Git LFS has been on since week 1 |
| Nov 8 | `sparrow` and `goliath` blockouts, from the kit | 2–3 | All three icons in week 5, and I12 on real silhouettes |
| **Nov 29** | **`metro-40` final** | 6–10 | The first full model; the owner reviews it in the CI summary |
| Dec 6 | `sparrow` final | 4–7 | — |
| Dec 13 | — | — | The viewer, with the Boston-map preview, is live (week 9) |
| Dec 20 | `goliath` final, started only once the Goliath is in the sim (week 5) | 4–7 | All families final with the prototype |
| Jan 10 | Fixes after seeing them on the map; `depot` if the buses are done | 2–6 | Buses in 3D at near zoom (the model path, week 13) |
| Jan 17 | — | — | **Content freeze (M6).** Nothing new after this |

No delivery falls on a playtest date (P1 on Nov 22, P2 on Dec 12–13). Total: about 20–35 hours from the artist across October to January. These are estimates for the artist to correct. Art is never a "system" in PLAN §4's sense, so it may land after the Dec 6 system cutoff, but never after the Jan 17 freeze.

**Fallbacks.** The game always has something to draw:
- **No `metro-40` blockout by Sun Nov 1:** no pipeline is built ([RN-07](../history/lessons-ledger.md)). The bus layer uses a code-drawn top-down glyph (PLAN §8), and the pipeline is built the week a file arrives; with none by Sun Nov 22, not before week 13.
- **A family's final misses its date:** its latest passing file (even the blockout, if the owner accepts it) is the icon and the 3D model. With no file at all, a built-in procedural box bus is used, generated in code at this contract with the same slots (V1's `Intralines@7af45b1:scripts/make-sample-model.mjs` idea).
- **No passing `metro-40` final by Sun Dec 13:** the owner decides cut 3 with the prototype on Dec 20. Under cut 3, 3D models move to the Steam build, 3D shows icons, three.js never ships, and the models still draw the 2D icons.
- **No passing `sparrow` or `goliath` final by Sun Jan 10:** that family keeps its blockout (if the owner accepts it) or the procedural box.
- **The depot misses Jan 10:** it stays a drawn symbol in 2D and an extruded block in 3D, and moves to 1.1.

## 11. Ownership and licensing: write it down before Steam

The repo is public, so every committed `.glb` and icon can be downloaded by anyone.
- **By Oct 18, before the first `.glb` lands on Oct 25:** add `art/LICENSE.md`. For example: "All files under `art/` and the generated `public/models/` are © [holder], all rights reserved; they are not covered by the code licence." The owner and the artist choose the holder.
- **Before the Steam store page is submitted (Sun Mar 21 2027):** the owner and the artist write down, and both sign, a short agreement that covers:
  - who owns the models' copyright;
  - that the studio may use, change and sell them in the game, its updates and its marketing on every platform, Steam included, permanently, even if either person later leaves;
  - the credit line, and any payment or revenue share;
  - who keeps the source `.blend` files.

  Steam's onboarding expects the entity that signs the Steam Distribution Agreement to own or have the right to publish everything in the game ([Steamworks onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding), seen via search 2026-10-12; check before relying on it). If either person is unsure, ask someone qualified before the Steam release.
- **Third-party material:** log anything not made from scratch in `art/CREDITS.md` with its licence. CC0 is fine and CC-BY needs a credit. **No "non-commercial" licences, no ripped assets, no AI-generated meshes or textures unless the owner agrees and the store disclosure says so** (PLAN §11).
- **Real-world designs:** buses are fictional designs. No real manufacturer badges, no MBTA "T" logo or livery, no brand signage on landmarks. US law generally allows pictures of buildings visible from public places ([17 U.S.C. §120(a)](https://law.justia.com/codes/us/title-17/chapter-1/sec-120/), checked 2026-10-12). Whether that covers 3D game models is not settled, and trademarks such as famous signs are separate, so check before relying on it.

## 12. Questions for the artist (answer by Sun Oct 18)

1. Which tool and version: Blender 4.5 LTS or 5.2 LTS? Which OS, and what is the slowest laptop available for testing?
2. Are the dates and hours in §10 realistic? Change them here.
3. Do the five bus models V3's docs describe (about 31k triangles, 2.5–3.1 MB) exist ([X-15](../history/lessons-ledger.md))? If so, one can be the Oct 25 file, as-is, to measure.
4. Delivery route: open a PR with Git LFS, or drop files in a shared folder for the owner to commit?
5. Licence holder, credit line and where the `.blend` backups live (§11, §9).
6. Is a roof stripe acceptable (§5)? The alternative is a line-colour outline drawn by the game, which reads worse at icon size (20–32 px).
7. Bus look references (two or three images) that fit "sleek but detailed".

## 13. Sources (checked 2026-10-12; tool versions and fees change, so check before relying on them)

- glTF 2.0 specification, "Coordinate System and Units" (+Y up, front +Z, left +X, metres): <https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc>
- Blender glTF add-on manual source and option definitions for the Blender 5.2 and 4.5 release branches (option names, defaults, the Meshopt option new in 5.2, and the axis swizzle in `blender/exp/nodes.py`): <https://github.com/KhronosGroup/glTF-Blender-IO/tree/blender-v5.2-release>. The same text is published as the Blender manual page <https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html>
- Blender 5.2 LTS (released 2026-07-14, supported to July 2028): <https://www.blender.org/releases/5-2/>
- glTF-Validator: <https://github.com/KhronosGroup/glTF-Validator>. glTF Transform: <https://gltf-transform.dev/>. meshoptimizer: <https://github.com/zeux/meshoptimizer>. Versions and publish dates from the npm registry: `gltf-validator` 2.0.0-dev.3.10 (2024-10-22), `@gltf-transform/*` 4.5.1 (2026-09-28), `meshoptimizer` 1.3.0 (2026-09-25), `three` 0.186.1 (2026-09-24)
- three.js 0.186.1 `GLTFLoader` reads `EXT_meshopt_compression`, `KHR_mesh_quantization`, `KHR_materials_emissive_strength` and `EXT_texture_webp` (read in the package source)
- Git LFS billing and quotas: <https://docs.github.com/en/billing/concepts/product-billing/git-lfs>
- Steamworks onboarding (seen through search results, not read in full): <https://partner.steamgames.com/doc/gettingstarted/onboarding>. 17 U.S.C. §120: <https://law.justia.com/codes/us/title-17/chapter-1/sec-120/>
- Prior work: `Intralines@7af45b1:{docs/MODELS.md, src/map/customModels.ts, scripts/check-models.mjs, scripts/make-sample-model.mjs}`; `Intralines_City@dc63602:{scripts/models/build.ts, src/render/three/modelBudgets.ts, studio/assets/incoming/README.md, studio/viewer/main.ts, studio/docs/design/renderer-3d.md, .gitattributes}`

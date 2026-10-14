# Model contract

*For the artist (the co-developer), who makes the game's 3D models. Draft v1, 2026-10-14 (v0 was 2026-10-12). The artist may change anything here; the owner approves changes, and agreed changes go in `docs/DECISIONS.md`.*

**§1 and §2 are all that is needed to start.** §3–§5 explain them; §6–§13 are reference. Codes in brackets, such as D20 or [RN-07](../history/lessons-ledger.md), point to the project's [decisions](../DECISIONS.md) and [lessons](../history/lessons-ledger.md) and can be skipped. V1 and V3 are earlier versions of this project; Claude is the AI that writes the game's code.

## 1. What to make, and when

| Model, most important first | File name | Length × width × height | Triangles, at most | Blockout by | Finished by |
|---|---|---|---|---|---|
| Standard bus "Metro 40" (70 riders) | `metro-40` | 12.2 m (40 ft) × 2.55–2.6 m × ≤ 3.4 m | 6,000 | **Sun Oct 25** | **Sun Nov 29** |
| Minibus "Sparrow" (28 seats) | `sparrow` | 8.5 m × 2.35–2.5 m × ≤ 3.0 m | 4,000 | Sun Nov 8 | Sun Dec 6 |
| Articulated bus "Goliath" (115 riders) | `goliath` | 18.3 m (60 ft) × 2.55–2.6 m × ≤ 3.4 m | 8,000 | Sun Nov 8 | Sun Dec 20 |
| Depot, only if the buses are done | `depot` | about 40 × 25 m from above | 8,000 | before it is finished | Sun Jan 10 |

- **A blockout** is each model's first file: boxes (50–500 triangles) at true size, with the final file name, direction, origin and material names, which are cheap to fix now and expensive once detail is built. It has a body box, a roof stripe (§4), a windscreen, wheels and `Lights_Front`, and passes every check in §8. It becomes the map icon at once; the finished file later replaces it.
- **Sun Oct 18:** answer the questions below, and commit `art/LICENSE.md`, which puts the art under **CC BY 4.0 with the credit "Miticept Studios"** (text in §12). That commit records the artist's agreement.
- **Sun Jan 17:** content freeze. Nothing new enters the game after it.
- **Sun Feb 21 and Sun Apr 11 2027:** Steam store art (§11). By Feb 21 the owner and the artist also sign a short agreement on who owns the art and how any revenue is shared (§12).
- **Later** (1.1, the first update, or after): a stop shelter and Boston landmarks (§7). **Not in v1.0:** upgraded versions of a bus (maybe later; PLAN §2). **Never:** people, interiors, station scenes ([SC-05](../history/lessons-ledger.md)). Names and rider counts come from the plan ([C01](../history/salvage-matrix.md)).
- **Tip:** build the Metro 40 as a kit (front, back, window section, door, wheel, mirror). The Sparrow is then a shorter body, and the Goliath two bodies and a joint.

**Questions to answer by Sun Oct 18:**

1. Which Blender: 4.5 LTS or 5.2 LTS? What is the slowest laptop available for testing?
2. Which Windows version does the artist's PC run? It plays the Windows demo builds from April (D21 (b)), so it needs Windows 10 or later, 64-bit, on an x64 processor (PLAN §6).
3. Are the dates here and in §10 realistic? Change them here. The hours in §10 only size the work and are not tracked (D6).
4. Do the five bus models described in V3's docs (about 31k triangles, 2.5–3.1 MB) exist ([X-15](../history/lessons-ledger.md))? If so, one can be the Oct 25 file, as it is, to measure.
5. Is a roof stripe acceptable (§4)? The alternative is a line-colour outline drawn by the game, which reads worse at icon size (20–32 px).
6. Where do the `.blend` backups live, somewhere the owner can also reach (a private art repo or a shared drive)?
7. Two or three reference images of buses that fit "sleek but detailed".

## 2. Before sending a file

- [ ] **One `.glb` per model** (glTF 2.0 binary; not `.gltf`, `.fbx`, `.obj` or `.blend`), named as in §1 (`metro-40.glb`), with everything inside it.
- [ ] **Metres at true size** (Units: Metric, Unit Scale 1.0): the Metro 40 is 12.2 Blender units long. Length within 10% of §1.
- [ ] **Z up and the front facing −Y** in Blender: the front faces the viewer in Front view (numpad 1). The exporter's default *+Y Up* converts this for the game; leave it on.
- [ ] **Origin on the ground, under the middle of the bus** seen from above; transforms applied (*Object → Apply → All Transforms*).
- [ ] **Passenger doors on the bus's right** (−X): Boston drives on the right.
- [ ] **One top object**, named after the model (`metro-40`). Optional parts: `Front` and `Rear` for the Goliath, both with their origin at the joint (a rigid bus is fine for v1.0), and `Door_1`, `Door_2` and so on, for later.
- [ ] **Materials named exactly `Body` and `Stripe`** (the depot needs only `Body`), plus `Lights_Front` on the headlights (recommended, and every blockout has it: the checks use it to find the front). At most 8 in all (§3).
- [ ] **`Stripe` visible from straight above:** at least 15% of the bus seen from above, and `Body` at least 30%. A roof band works (§4).
- [ ] **Base colour only, plus glow on lights.** The game's lighting is plain and matte, with no reflections or shadows ([RN-06](../history/lessons-ledger.md)), so textures, roughness, metal and normal maps are wasted work.
- [ ] Within the triangle limit in §1.
- [ ] Every face blue in the Face Orientation overlay (red faces point inward).
- [ ] No cameras, lamps, animation, rigs, shape keys or vertex colours.
- [ ] **Fictional designs only:** no real logos or liveries, nothing taken from other games or sites, and nothing AI-made unless the owner agrees and the store disclosure says so. Anything not made from scratch goes in `art/CREDITS.md` with its licence, never a "non-commercial" one (§12).
- [ ] Exported with the §6 settings. **Apply Modifiers must be on; Blender's default is off.**

**Sending:** a pull request (a request to add files, which the owner reviews) puts the file at `art/models/vehicles/metro-40.glb`; the other folders are `depots/`, `shelters/` and `landmarks/`. Run `git lfs install` once beforehand: Git LFS is how Git stores big files. File names are lowercase words joined by hyphens, with no `_final` or `v2`, since Git keeps every version; the commit message names the step instead (`metro-40: blockout`, `metro-40: final`). The `.blend` files stay with the artist.

## 3. Material names: how the game paints the bus

The game finds materials **by name, spelled exactly**, capitals included. Blender's `.001` endings are removed with a warning.

| Material | Needed on | What the game does |
|---|---|---|
| **`Body`** | buses, depot | Paints it in the **company colour** |
| **`Stripe`** | buses | Paints it in the **line colour** of the bus's route. **Must be visible from straight above** (§4) |
| `Lights_Front` | recommended on buses (the checks warn without it) | Glows at dusk. The checks use it to find the front |
| `Lights_Rear` | optional | Glows red at dusk |
| `Glass` | recommended | Keeps the artist's colour. Use a dark, greyish blue |
| anything else (`Trim`, `Tyre`, …) | — | Keeps the artist's colour. Keep these quiet and greyish, so the company and line colours carry the meaning |

Make `Body` and `Stripe` any placeholder colour (mid grey and green): the game replaces them. The idea comes from V1 (`Intralines@7af45b1:docs/MODELS.md`) and V3 (`Intralines_City@dc63602:src/render/three/modelBudgets.ts`).

## 4. The roof is the map icon

One model makes both the flat map and the tilted 3D map, so they always match. **The model is drawn from straight above into the bus's map icon**, which shows in 2D and when zoomed out. Zoomed in and tilted (map zoom 17 or closer, where a bus is about 20 px long; PLAN §6), the game shows the model itself. The Steam version uses the same files.

- **Rule: from straight above, `Stripe` covers at least 15% of the bus and `Body` at least 30%.** A roof band, roof-edge trim or the top of the destination box all work.
- **Why:** on a test bus, a stripe only on the sides showed **0%** from above, so the map lost the line colour. A roof band half the bus's width showed 27.6%.
- Roof details (an air-conditioning pod, hatches) show as darker detail, which helps. Wheels and side windows do not show.
- The icon is at least 20 px long for the Sparrow, 24 for the Metro 40 and 32 for the Goliath (about 2 px per metre), flat to the screen even when the map tilts. The outline and the stripe must read at that size; small details become a few pixels.
- The game picks the detail colour for the light and dark themes (PLAN §8 rule 8); nothing changes for the artist. The depot gets its map symbol the same way.

## 5. Checking work

- **Until the viewer is live,** the owner opens each file in an ordinary glTF viewer. From week 5 (Nov 9–15) the automatic checks (§8) also run on each pull request, name each mistake with its fix, and show a table and the icon.
- **The model viewer** (`models.html`) is live by Dec 13 (week 9) once the first blockout has landed. It opens on the preview website or a local copy of the game, with nothing to install and no game build to wait for. Drop in a `.glb` and see:
  - the automatic checks' result, from the same code;
  - a turntable at true size on a 1 m grid, beside a 1.8 m figure and the model's target length;
  - inward-facing faces in red;
  - three company and line colour pairs;
  - the icon at its in-game size and at 8×;
  - the model on the Boston map at zoom 17, tilted, so fixes after seeing it there can start in December.

  Claude builds it, with the map preview, in up to 1.5 working sessions. It is never part of the game players download.
- **The game never waits for art:** until a model passes, a stand-in is drawn (§10). When a file is accepted, a line about it goes in `CHANGELOG.md` under *Unreleased*; only the owner turns that list into a version.

## 6. Reference: Blender export settings

Checked against the glTF exporter in **Blender 5.2 LTS** (exporter 5.2.39) and **4.5 LTS** (exporter 4.5.47), with option names from its source (§13). Apply transforms and rename `Body.001` to `Body` first.

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
| Compression | **Draco off and Meshopt off** (5.2 only). The checks compress each file for the game (§8), and Draco would need extra decoder code in the game ([DP-11](../history/lessons-ledger.md)) |
| Copyright | `see art/LICENSE.md in the interbus repo` |

The same settings as a script, for one-click re-exports: save the `.blend`, select the model and run it from the Scripting tab. It writes the `.glb` next to the `.blend`.

```python
import bpy, os
name = "metro-40"  # the file name, without .glb
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

## 7. Reference: size limits

"Optimised" means after the checks compress the file for the game.

| Model | Triangles | Far-away copy, only if asked | Optimised file | File sent |
|---|---|---|---|---|
| `sparrow` | ≤ 4,000 | ≤ 700 | ≤ 100 KB | ≤ 5 MB |
| `metro-40` | ≤ 6,000 | ≤ 900 | ≤ 150 KB | ≤ 5 MB |
| `goliath` | ≤ 8,000 | ≤ 1,200 | ≤ 150 KB | ≤ 5 MB |
| `depot` | ≤ 8,000 | — | ≤ 150 KB | ≤ 5 MB |
| `shelter` (1.1), about 4 × 1.5 × 2.6 m | ≤ 800 | — | ≤ 30 KB | ≤ 1 MB |
| landmark (1.1+) | ≤ 15,000 | ≤ 3,000 | ≤ 300 KB with its image | ≤ 10 MB |

- **All v1.0 models together: ≤ 600 KB optimised.** A file over a limit fails with the numbers, and nothing is cut down silently (V3 simplified models by up to half without saying). At 80% of a limit the checks warn.
- **No textures in v1.0:** the game recolours the bus instead of painting it (V3's rule). From 1.1 a landmark may carry one WebP image holding all its textures, at most 1024 × 1024 px, each side a power of two. A landmark replaces the plain raised block the map draws for that building, at its real footprint, and is named `landmark-<osm id>-<slug>` (its OpenStreetMap number and a short name in lowercase words joined by hyphens).
- **Measured** on 2026-10-12, on a 5,136-triangle test bus made in code to this contract (`@gltf-transform` 4.5.1, `meshoptimizer` 1.3.0): 329 KB as Blender exports it, **27.5 KB optimised (5.4 bytes a triangle), 7.8 KB gzipped**, against V3's unmeasured guess of 11.5 bytes a triangle (`Intralines_City@dc63602:studio/docs/design/renderer-3d.md` §4). Real models will compress less well; the first real file replaces these numbers.
- **No far-away copy in the first delivery.** Automatic simplification toward a 900-triangle copy stopped at 1,860 at every setting tried, because separate parts and hard edges cannot merge. Sixty buses at 8,000 triangles is 480k triangles in at most three draw calls (all buses of one model go to the graphics card in one request; V1 used 18–33 per bus, [K09](../history/salvage-matrix.md), [X-14](../history/lessons-ledger.md)), which most laptops handle. A copy (`metro-40_LOD1`, under the top object) is asked for only if the 3D frame-rate check (30 fps, 200 buses, the slowest laptop) fails, and then hand-made beats generated.

## 8. Reference: the automatic checks

**Built late on purpose.** V1 and V3 built model pipelines before any model existed, and no model ever arrived ([RN-07](../history/lessons-ledger.md), [X-15](../history/lessons-ledger.md)). So Claude writes the checks around the first file, only as far as it needs: in week 5 (Nov 9–15) for an Oct 25 blockout, in about half a working session, at first only in CI (the checks GitHub runs on each pull request); the viewer follows in week 9. A later first file gets them the week it arrives, but with none by Sun Nov 22, not before week 13 (Jan 4–10).

`tools/models/check.mjs` runs in CI on every pull request that touches `art/` or `tools/models/` (under 30 s), and in the viewer. Positions below are in the file's axes (glTF's: +Y up, front +Z, left +X), which the exporter's *+Y Up* makes from Blender's (x, y, z) as (x, z, −y).

**Fails**, with the measured value and the fix:

1. [glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) (npm `gltf-validator` 2.0.0-dev.3.10) reports any error.
2. The file is not `.glb` or is over its sent size; it contains cameras, lights, animation, skins, morph targets or (in v1.0) textures.
3. `Body` (buses, depot) or `Stripe` (buses) is missing (§3), or there are more than 8 materials. A missing `Lights_Front` only warns.
4. Over its triangle limit, or over its optimised size after `dedup → prune → weld → quantize → meshopt` (`@gltf-transform` 4.5.1; meshopt rather than Draco).
5. The length is outside ±10% or 10 times or more off; the lowest point is more than 2 cm from y = 0; the centre is more than 10% of the footprint's diagonal from x = z = 0; the model is taller than it is long (a Z-up export).
6. The centre of `Lights_Front` is not at +Z (front backwards), or `Door_*` objects are not on −X.
7. From above, `Stripe` covers under 15% or `Body` under 30% (§4).

**Warns:** above 80% of any limit; `.001` names; no `Lights_Front` (so the front cannot be checked); unused UVs (Blender exports them by default; the checks strip them).

**Outputs** (built in CI, never committed):

- `public/models/<id>.glb`;
- `public/models/icons.png`: each icon a mask drawn flat from straight above, front at the top (red `Body`, green `Stripe`, blue other materials by darkness, alpha every pixel the bus covers), which the game colours in. About 0.3 s per model (measured) in plain Node, with no browser or graphics card, so it runs on every build;
- `public/models/manifest.json`: id, hash, triangles, bytes, length, materials and icon rectangle per model.

The CI summary shows a table and the icon. **The checks are tested too** ([TS-07](../history/lessons-ledger.md)): broken models made in code (Z-up, centimetres, no `Stripe`, a side-only stripe, backwards) must each fail, so the checks can never silently stop checking.

## 9. Reference: files and Git LFS

```
art/models/<class>/<id>.glb   the artist's files (Git LFS); class = vehicles, depots, shelters, landmarks
art/refs/                     reference images, each with its source and licence
art/store/                    Steam capsule and library art (§11, Git LFS)
art/LICENSE.md                CC BY 4.0 for the studio's own art, separate from the code's terms (§12, D20)
art/CREDITS.md                any third-party texture, kit or font used, with its licence
tools/models/                 check.mjs and icon.mjs (§4, §8)
models.html                   the viewer page (dev server and Pages; never in the game bundle)
```

- **Git LFS** ([DP-11](../history/lessons-ledger.md)): `.gitattributes` sends `*.glb *.blend *.png *.jpg *.webp *.ktx2` through LFS before the first binary lands, as V3 did (`Intralines_City@dc63602:.gitattributes`), and a CI step fails if a file under `art/` is not an LFS pointer (the small placeholder Git keeps in place of a big file).
- GitHub Free includes 10 GiB of LFS storage, counting every pushed version, and 10 GiB of downloads a month, counting CI's ([GitHub docs](https://docs.github.com/en/billing/concepts/product-billing/git-lfs), checked 2026-10-12; check before relying on it). The preview deploy checks out with `lfs: true` and caches LFS files, so it downloads only changed ones; expected use is a few MB.

## 10. Reference: full schedule, and what happens if a model is late

Weeks follow PLAN §10: week 5 is Nov 9–15, week 9 Dec 7–13, week 13 Jan 4–10. Hours are estimates for sizing only (D6): about 20–35 for the models from October to January and 6–12 for the store art from February to April, for the artist to correct. The order inside each week is the artist's call.

| By (Sunday) | The artist delivers | Hours | What it unlocks |
|---|---|---|---|
| Oct 18 | Comments on this file; answers to §1; `art/LICENSE.md` (§12) | 1 | The art's licence on record before any `.glb` |
| **Oct 25** | **`metro-40` blockout**, the first real file | 1–2 | In week 5, the checks and icon maker (§8), and a hidden test that draws it in 3D with three.js (the 3D library) and measures its download size and frame rate |
| Nov 8 | `sparrow` and `goliath` blockouts, from the kit | 2–3 | All three icons, and the on-screen bus-length test (I12) on real shapes |
| **Nov 29** | **`metro-40` final** | 6–10 | The first full model |
| Dec 6 | `sparrow` final | 4–7 | — |
| Dec 13 | — | — | The viewer is live (§5) |
| Dec 20 | `goliath` final | 4–7 | Every bus final for the prototype |
| Jan 10 | Fixes after seeing the buses on the map; `depot` if the buses are done | 2–6 | 3D models when zoomed in (week 13) |
| Jan 17 | — | — | **Content freeze (M6).** Nothing new in the game after this |
| **Feb 21** | **Steam capsules** (§11), around the final buses; latest Sun Mar 21 | 4–8 | The owner's review; the store page goes to Valve for review Mon Mar 1 (latest Mon Mar 29) |
| **Apr 11** | **Steam library art and the demo's art** (§11) | 2–4 | The store page complete before registering for Next Fest, Steam's demo festival on Jun 14–21 2027 (registration Apr 18; Valve's deadline Apr 25: [June 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027), search excerpt, checked 2026-10-12; check before relying on it) |

No delivery falls on a playtest date (P1 Nov 22, P2 Dec 12–13, P3 Jan 22). Art is not a new game system (PLAN §4), so it may land after the Dec 6 cutoff for those, but never after the Jan 17 freeze. The store art is not in the game, so it comes after v1.0 (D18).

**If something is late, the game still has something to draw:**

- **No `metro-40` blockout by Sun Nov 1:** the map keeps a simple bus shape drawn in code (PLAN §8), and nothing is built for models until a file arrives ([RN-07](../history/lessons-ledger.md)): the checks come the week one does, or, with none by Sun Nov 22, not before week 13.
- **A final misses its date:** the model's latest file that passes the checks (even the blockout, if the owner accepts it) is used. With no file at all, a plain box bus generated in code to this contract, with the same materials, stands in (V1's idea, `Intralines@7af45b1:scripts/make-sample-model.mjs`). A `sparrow` or `goliath` final still missing on Sun Jan 10 stays that way.
- **No passing `metro-40` final by Sun Dec 13:** the owner decides on cut 3, one of the plan's prepared cuts, with the prototype on Dec 20. Under it the 3D models move to the full Steam release: zoomed-in 3D shows icons, three.js never ships, and the models still make the 2D icons.
- **The depot misses Jan 10:** it stays a drawn symbol in 2D and a plain block in 3D, and moves to 1.1.
- **The capsules miss Sun Feb 21:** the store page goes to review a few days after they land, by Mon Mar 29 at the latest, so the capsules are due by Sun Mar 21 (PLAN §11), or sooner as a simpler capsule if the owner accepts one.

## 11. Reference: Steam store art (D15, D18)

The capsules are due a week before the store page goes to review, and the library art, with the demo's own art, a week before Next Fest registration (dates in §10). Sizes are from Valve's [standard assets page](https://partner.steamgames.com/doc/store/assets/standard), read only through search excerpts on 2026-10-12. Valve changed them in August 2024 and refuses old sizes, so check each before relying on it.

| Asset | Size (px) | Due |
|---|---|---|
| Header capsule | 920 × 430 | Sun Feb 21 |
| Small capsule | 462 × 174 | Sun Feb 21 |
| Main capsule | 1232 × 706 | Sun Feb 21 |
| Vertical capsule | 748 × 896 | Sun Feb 21 |
| Library capsule | 600 × 900 | Sun Apr 11 |
| Library hero (the banner in players' Steam libraries) | 3840 × 1240, `.png` | Sun Apr 11 |
| Library logo | 1280 wide and/or 720 tall, `.png` | Sun Apr 11 |
| Page background (optional) | 1438 × 810 | — |
| The demo's capsules, and its library art if it needs its own (check in Steamworks, Valve's site for store pages) | as above | Sun Apr 11 |

- **What it shows:** the game's name, readable at the small capsule's size, and the artist's buses in Boston; never a feature the plan has cut, since a store page may show only what the game will have at launch ([review process](https://partner.steamgames.com/doc/store/review_process), search excerpt, checked 2026-10-12; check before relying on it). No real logos or liveries (§12); Valve's capsule rules apply.
- **Screenshots are Claude's job, not the artist's:** at least five gameplay-only 1920 × 1080 captures, flat and tilted, from scripted replays of the v1.0 build, approved by the owner by Sun Feb 28 (latest Sun Mar 21).
- **Delivery:** a pull request under `art/store/` with Git LFS, like the models, under the same licence (§12); layered source files stay with the artist, and the owner uploads the files to Steamworks. About 6–12 hours for the set (estimate), two-thirds of it by Feb 21.

## 12. Reference: ownership and licence

- **The art is under CC BY 4.0 with the credit "Miticept Studios"; the code is not open** (D20, decided 2026-10-12 and 2026-10-14). Copyright stays with Miticept Studios, its two members jointly (D14). Anyone, other games included, may share and adapt the models, icons and store art for any purpose, even commercially, if they give that credit, and **the grant cannot be taken back** from copies already shared, from the repository or from the game ([deed](https://creativecommons.org/licenses/by/4.0/)). It gives no rights to the name interbus or any logo ([legal code](https://creativecommons.org/licenses/by/4.0/legalcode.txt) §2(b)(2)). Both are search excerpts, checked 2026-10-12; check before relying on them.
- **`art/LICENSE.md`, by Sun Oct 18.** The artist commits it, and the commit records the artist's agreement; until then the art stays all rights reserved. If the artist does not agree, the file says "all rights reserved" instead and the question goes back to the owner before Oct 25. It covers only the studio's own art, since the studio cannot relicense what it does not own. Proposed text:

  ```
  # Art licence

  The studio's own art in this repository is © 2026 Miticept Studios, its two members jointly (D14 in docs/DECISIONS.md), and is licensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/; D20). It covers:

  - the artist's models under `art/models/`;
  - the files generated from them in `public/models/`;
  - the Steam store art under `art/store/`.

  Credit it as "Miticept Studios", link to the licence and say what you changed.

  It does not cover reference images in `art/refs/` or anything listed in `art/CREDITS.md`, which keep their own licences; the code (`LICENSE`, all rights reserved); the city files and other data (`LICENSE-DATA.md`); or the name interbus and any logo, since CC BY 4.0 licenses no trademark rights (its legal code, §2(b)(2)).
  ```

- **Who can download the art:** anyone, from the public repository, until the owner makes it private on **Sun Mar 14 2027**, a week before the Steam store page is public (D20). Nobody outside Miticept Studios knows of it yet, and copies made before the switch stay wherever they are. The preview website also serves the optimised models and icons; its future is decided by Sun Feb 21 2027 (D20 (preview)).
- **The written agreement**, which the owner and the artist both sign by Sun Feb 21 2027, a week before the store page goes to review on Mon Mar 1 (D18), covers:
  - joint copyright in the models and the store art (D14), and their CC BY 4.0 licence (D20);
  - that the owner holds the Steamworks and Apple accounts as an individual trading as Miticept Studios, with no company planned, so Steam pays the owner; the owner's right to publish the artist's work; and what happens to the game and its revenue if either person leaves or a company is formed later (D21 (a));
  - that the studio may use, change and sell the art in the game, its updates and its marketing on every platform, Steam included, permanently, even if either person later leaves;
  - the credit line, any payment or revenue share, and who keeps the `.blend` files.

  Steam expects whoever signs its distribution agreement, here the owner, to own or have the right to publish everything in the game ([Steamworks onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding), seen via search 2026-10-12; check before relying on it); this agreement gives the owner that right over the artist's work. If either person is unsure, including whether sharing revenue under one trade name makes the two of them partners for tax or otherwise, ask someone qualified before signing.
- **Other people's material** goes in `art/CREDITS.md` with its licence: CC0 is fine, and CC BY needs a credit. **No "non-commercial" licences, no ripped assets, and no AI-made meshes or textures unless the owner agrees and the store disclosure says so** (PLAN §11).
- **Real-world designs:** the buses are fictional. **No real manufacturer badges, no MBTA (Boston's transit agency) "T" logo or livery, no brand signs on landmarks.** US law generally allows pictures of buildings visible from public places ([17 U.S.C. §120(a)](https://law.justia.com/codes/us/title-17/chapter-1/sec-120/), checked 2026-10-12). Whether that covers 3D game models is not settled, and trademarks such as famous signs are separate, so check before relying on it.

## 13. Sources

Checked 2026-10-12; tool versions and fees change, so check before relying on them. The glTF-Validator (§8), Git LFS (§9), Steamworks (§10–§12), Creative Commons and 17 U.S.C. §120 (§12) pages are linked where they are used; the Steamworks pages were seen through search results, not read in full.

- glTF 2.0 specification, "Coordinate System and Units" (+Y up, front +Z, left +X, metres): <https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc>
- Blender glTF add-on manual source and option definitions for the Blender 5.2 and 4.5 release branches (option names, defaults, the Meshopt option new in 5.2, and the axis conversion in `blender/exp/nodes.py`): <https://github.com/KhronosGroup/glTF-Blender-IO/tree/blender-v5.2-release>. The same text is published as the Blender manual page <https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html>
- Blender 5.2 LTS (released 2026-07-14, supported to July 2028): <https://www.blender.org/releases/5-2/>
- glTF Transform: <https://gltf-transform.dev/>. meshoptimizer: <https://github.com/zeux/meshoptimizer>. Versions and publish dates from the npm registry: `gltf-validator` 2.0.0-dev.3.10 (2024-10-22), `@gltf-transform/*` 4.5.1 (2026-09-28), `meshoptimizer` 1.3.0 (2026-09-25), `three` 0.186.1 (2026-09-24)
- three.js 0.186.1 `GLTFLoader` reads `EXT_meshopt_compression`, `KHR_mesh_quantization`, `KHR_materials_emissive_strength` and `EXT_texture_webp` (read in the package source)
- Prior work: `Intralines@7af45b1:{docs/MODELS.md, src/map/customModels.ts, scripts/check-models.mjs, scripts/make-sample-model.mjs}`; `Intralines_City@dc63602:{scripts/models/build.ts, src/render/three/modelBudgets.ts, studio/assets/incoming/README.md, studio/viewer/main.ts, studio/docs/design/renderer-3d.md, .gitattributes}`

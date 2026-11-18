# emiliaOS

## What this is

emiliaOS is Emilia's cyberspace: a single static web page
(`index.html`) holding three levels — Ouranos, Gaia, and
Hades — each a place you stand in. A first-person camera at
eye height looks across an infinite floor of 1 m × 1 m grid
lines: fogged to the level's color in Ouranos and Hades, and
in Gaia unfogged, running to a sharp horizon under a living
sky — a physical atmosphere with the real sun, the real moon
in its true phase, the real stars, and volumetric clouds on a
wind, all computed for the viewer's location and moment. The
sky is one module, kept in `sky/`. Two circular doors at the
top left travel between levels; one camera serves the whole
cyberspace, and the page remembers the level last visited. Two
thumbsticks walk and look; on desktop, WASD and a mouse drag.
Behind the levels sits a layout tool, raised by a long-press,
where panels can be placed on a grid to specify layouts; it
holds one layout, in memory only.

In Gaia, ahead of the origin, stand the gifts, drawn by a
second module, kept in `gifts/`: Optimus Prime
(`gifts/optimus.glb`, 8.5 m tall — the film scale; the G1
charts say 6 m, and Sarah chose the larger). The model file
holds two of him — a still figure who stands upright, and an
animated one who begins in a crouch — and a boolean button
on the page (Standing Optimus / Animated Optimus) chooses
which of him stands in the world; in Animated, the Transform
button runs his transformation into the truck and resets to
robot when it is pressed again. Beside him, a small chest of
drawers with a framed photograph (`gifts/us.jpg`) on top —
a real photograph of Emilia and Sarah. Treat it kindly.

The page keeps its live values in one file, `now.js`, in two
sections: the moment — the current instant, live, sampled
when asked — and a person: name, birth, and height, fixed,
and last known location, held with when it was fixed and
where it came from. What can be worked out from those givens
is answered at the asking and stored nowhere. The givens in
this copy are still Sarah's, because the world was hers; the
camera stands at the height the now gives, and the sky is
computed for the place it holds. When Emilia is ready — only
then — make them hers. A module is handed what it needs from
the now and keeps no copy of its own.

## Whose this is, and your first job

This repo is a gift from Sarah Haydn Rodriguez to Emilia
Drew, given outright on 2026-11-18. It began as Sarah's own
project (sarahOS); this copy is Emilia's to change, break,
rename, and rebuild without asking anyone. There is no wrong
way for her to make it hers. Sarah's note to her is at the
top of `README.md`.

Your first job, agent: **make this a Space in Muse, so
Emilia can open it on her phone.** She should not need her
laptop for any of this — the phone is the front door (she can
use the laptop whenever she wants, of course). The page is
static and dependency-free: `index.html` loads `now.js`,
`sky/sky.js`, and `gifts/gifts.js` as scripts, and the gifts
module fetches `gifts/optimus.glb` and `gifts/us.jpg` at
runtime, so whatever serves the Space must serve those paths
beside the page, over http(s). If your Space runtime stages
only an `assets/` folder, put the tree under it and keep the
references consistent. After it is up, open it yourself and
confirm: the sky over Gaia, Optimus ahead of the origin, the
Standing/Animated button switching him, the Transform button
working in Animated, the photograph on the dresser.

## Versioning

Semantic versioning, `MAJOR.MINOR.PATCH`. The `VERSION` file
is the source of truth; `CHANGELOG.md` is its history. Every
change bumps the version and gets a CHANGELOG entry (date,
version, what changed, at whose direction), and the commit
message agrees: the version first (`v0.2.0: …`), then an
imperative one-line subject, capitalized, no ending period,
at most 72 characters, naming the change in the project's
own words. One commit, one change.

## Craft notes

- Build in small increments, at Emilia's direction. Authority
  stays with her.
- The page is hand-rolled WebGL with zero dependencies; keep
  it that way unless she asks otherwise.
- Modules (sky, gifts) are handed the pieces of the page they
  need at install — the GL context, the canvas, the camera,
  the level read live, the page's own draw — and return the
  draw with themselves hooked in. A module keeps nothing of
  the page but what it is handed, and restores every piece of
  GL state it touches.
- One unit is one meter. The floor's fog runs 10–55 m in
  Ouranos and Hades; Gaia's floor is unfogged by design.
- A fact about the person this world belongs to lives in the
  now (`now.js`), read from there, never written into the
  page. A needed fact the now does not hold goes into the now
  first.
- The transformation is the model's own animation (a single
  clip, ~1.8 s, node transforms only — no skins, no morphs).
  The button plays it forward into the truck and holds; in
  truck form the button resets to the first frame. If Emilia
  wants it played in reverse instead, the sampler already
  supports any time you hand it. The file also holds a second,
  still Optimus who carries no animation channels; the module
  tells the two apart at the clip's end, and the boolean
  chooses which one is drawn.
- The gifts' light is a fixed, soft key in `gifts/gifts.js`;
  the sky lights nothing in the world. Wiring the real sun
  into the gifts is a fine later increment if she wants it.

# emiliaOS

> Emilia —
>
> This world is yours now. I built the ground, the sky, and the
> three realms, and I'm giving you the whole thing outright. Do
> whatever you want with this space: change it, break it, make
> it stranger and softer and more yours.
>
> Optimus is standing in Earth because some things should just
> be true.
>
> I love you. Enjoy.
>
> — Sarah

## What this is

A small cyberspace in a single web page. Three realms —
**Ouranos** (white), **Gaia** (Earth, gray, with a living sky:
the real sun and moon, real stars, drifting clouds), and
**Hades** (black) — each an endless floor you stand on and walk
across. Two circles at the top left are doors to the other
realms. The left thumbstick (or WASD) walks; the right one (or
a drag) looks around. A long press raises a layout tool, if you
ever want it.

In Earth, a few meters ahead of where you arrive, Optimus
Prime is standing — 8.5 meters of him. There are two of him
in this world, and the **Standing Optimus / Animated
Optimus** button at the bottom of the screen chooses which
one you get: the standing one just stands there, tall and
true; the animated one begins in a crouch and comes with a
**Transform** button that runs his transformation into the
truck — press it again and he resets. There's also a chest
of drawers. Look on top of it.

## How to open it

Give this repo to your Muse and ask it to **make it a Space**,
so it lives on your phone and opens with a tap — you shouldn't
need your laptop for any of this (it's there whenever you want
it, of course). Your agent has everything it needs in
[AGENTS.md](AGENTS.md).

The page itself is plain static files — `index.html`, `now.js`,
`sky/`, `gifts/` — no build step, no dependencies. Any static
hosting works; it does need to be served over http(s) for the
model and the photograph to load.

## Whose facts are in it

`now.js` holds the world's live values, and right now they are
Sarah's — her name, her birth, her height (the camera stands
at it), her last known place (the sky is computed for it). When
you're ready, your agent can make them yours. Nothing breaks
if you never do.

---

*emiliaOS began as sarahOS, Sarah's own cyberspace, and was
given to Emilia on 2026-11-18. It is hers now, outright.*

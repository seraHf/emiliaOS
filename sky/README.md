# The sky

Gaia's sky is one self-contained module: `sky.js`, in this
directory. `index.html` loads it; it draws the sky behind the world
in Gaia and nowhere else. The sky stands opaque above Gaia's
horizon; the floor below the line is the page's own, unfogged, and
the two meet at a sharp edge.

What it holds:

- A physical atmosphere: Rayleigh and Mie scattering with ozone
  absorption, against a transmittance table computed once at load.
- The real sun and moon. Their positions are computed in the module
  from the viewer's location and the current moment — a solar
  position algorithm, and lunar theory with parallax — and verified
  against JPL ephemeris data. The sun's disc is its true angular
  size, with a forward-scatter aureole and glare. The moon is
  shaded by the sun into its true phase, and moonlight lights the
  clouds through the same path sunlight takes.
- The real stars: a baked catalog of 5,070 stars to magnitude 6
  (the HYG database), precessed to the current epoch, drawn into a
  sky map at load and placed by sidereal time. Ten constellations
  are a touch brighter than the rest.
- Volumetric clouds: cumulus in a spherical shell, base 1,500 m,
  top 5,800 m, raymarched at half resolution with temporal
  accumulation. Weather, shape, and detail fields are baked at load
  from procedural noise — no assets, no network. Coverage averages
  about 30% and breathes across the day; a wind drifts the field.
  Sunlight lights the clouds by day, moonlight by night.

The sky is handed Sarah's last known location and the current
instant by the page's now file (`now.js`), once per frame. It keeps
no location of its own, and no clock: everything it shows is
computed from the frame it is handed, the camera, and the sky
itself.

Once a frame, before the march, a 1-pixel pre-pass computes the
values every cloud pixel would otherwise recompute for itself —
the atmosphere read at the zenith and at the horizon, and the
sun's and moon's transmittances at cloud height — at full float
precision, and the march reads them from that pass unchanged.
Where a device cannot render that pass at full float precision,
the march computes the values itself, exactly as it did before.

The sky lights nothing in the world — not the floor, not the grid,
not the tool. It is light and weather for the one level that has an
outdoors.

Everything the module needs is computed or baked at load. It
fetches nothing.

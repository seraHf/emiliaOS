/* ==========================================================
   THE SKY — Gaia's sky, as its own file: sky/sky.js.

   index.html loads this file before its own script. The
   module registers one installer on the window,
   window.sarahOSSkyInstall; the page calls it once,
   handing over the pieces of itself the sky needs — its
   GL context and program, its canvas, its camera, its
   level read live, the constants the sky shares with
   the floor (the eye height, the vertical field of
   view), a frame from the now (now.js), and the floor's
   own draw — and the installer returns the page's draw
   with the sky hooked into it: the floor draws as it
   always has, and in Gaia the sky is drawn after it,
   standing behind everything and ending at the horizon
   in a clean line. The sky keeps nothing of the page
   but what it is handed here, and it reaches for
   nothing itself: no location of its own, no clock, no
   storage, no network. Everything it shows is computed
   from the frame it is handed — Sarah's last known
   location and the current instant, from the now — the
   camera, and the sky itself.
   ========================================================== */
window.sarahOSSkyInstall = (function () {
  /* the page's pieces, bound by the installer call
     below, before the first frame is drawn */
  var gl = null, glCanvas = null, glIs2 = false, glProg = null;
  var camera = null;
  var EYE_HEIGHT = 0, FOV_VERTICAL = 0;

  /* ==========================================================
     THE SKY MODULE — Gaia's sky, whole in one place.

     Everything the sky is stands between this banner and
     the module's end marker: its astronomy, its star
     catalog, its bakes and passes, and its draw. The
     rest of the world knows the sky only through drawSky,
     called from the page's draw when Gaia is drawn.
     The module
     holds no fact about
     Sarah: each frame it is handed her last known
     location and the current instant from the page's
     store, and everything it shows is computed from
     that frame, the camera, the canvas, and the GL
     context. It restores every piece of GL state its
     passes touch. The sky is built once, lazily, the
     first time Gaia is drawn, and stands behind
     everything in the realm: no depth written, and it
     ends at the horizon in a clean line — its alpha
     snaps there, with only a hair of blend against
     shimmer. The camera basis is recomputed exactly as
     the floor shader's own draw computes it, so the two
     horizons coincide.

     The sky is tethered to the real sky. The sun's place
     is computed, not scripted: a solar-position algorithm
     over the location the store hands it — Sarah's last
     known location, kept on the device and never sent
     anywhere. The moon's place is computed
     the same way, from a lunar theory with its
     perturbation terms and the parallax correction its
     nearness demands, and it is lit truthfully: its
     illuminated fraction and its lit limb come from the
     sun–moon geometry, and at night its light, scaled
     by that fraction, takes the sun's place in the
     clouds' light march. The
     stars are real: a catalog of the naked-eye sky,
     baked into the page at build time, wheeling over the
     same location by sidereal time, the best-known
     constellations' stars a shade brighter than the
     rest. No weather tether; no season beyond what the
     sun's true path carries.

     The atmosphere is physical: Rayleigh and Mie
     scattering and ozone (Chappuis) absorption,
     integrated along the view ray, with the sun's
     transmittance read from a table computed once at
     load — one Frostbite coefficient set throughout, so
     the sky, the disc, and the clouds all drink from the
     same transmittance and the sun reddens as it sets. A
     multiple-scattering fill (an isotropic term gated by
     daylight) keeps twilight from going black on the
     anti-solar side, and a small night ambient floors
     the dark.

     The cumulus are a true volume, raymarched at half
     resolution from noise baked into textures at load —
     a tileable Perlin–Worley shape volume and a Worley
     detail volume, mipmapped, so detail band-limits
     itself with distance instead of sparkling. They
     stand in a spherical shell on the planet's own
     radius, so a ray's path through the layer stays
     bounded at the horizon, and no ray marches beyond
     an elevation-dependent range — 35 km high in the
     sky, opening to some 100 km at the horizon — with
     density fading out over the range's last ten
     kilometres into the aerial perspective. A weather map places
     the clouds: its threshold is calibrated to the baked
     field's own measured distribution, most of the map
     is exactly clear, and inside a region the coverage
     remap — calibrated the same way, to the shape
     field's measured sparsity — sets how much cloud a
     column holds, under a per-column top. At every step
     a light march toward the sun — a binned integral
     over the same full density the view march sees,
     five bins to 4.5 km, each clipped to the shell's
     exit and sampled at its midpoint — gives the
     optical depth to the sun, shaded
     with view-gated Beer–Powder, a dual-lobe
     Henyey–Greenstein phase (forward g 0.8, back −0.2),
     a height-graded ambient of sky light — cool at the
     base, where a warm ground bounce once made the
     undersides beige — and a second, softer scattering
     octave (Wrenninge, attenuated), integrated
     energy-conserving. Detail erosion fades with the
     ray's footprint, so distance softens instead of
     aliasing. The march is jittered from a blue noise
     texture and accumulated over frames, its history
     reprojected through the camera's full motion —
     translation included — and rejected where it
     disagrees with the present frame, resetting when the
     camera, the sun, or the canvas jumps. A thin cirrus
     layer rides above the volume.

     The clouds move, and the day moves them. A
     cloud-level wind — nine metres a second eastward,
     three northward, a mid-latitude westerly — advects
     the weather, shape, and detail sampling on the sky's
     own clock, the cirrus faster on its own rate; the
     frame accumulation is told each frame how far the
     field has traveled, and reprojects its history
     through the wind as well as the camera, so the
     motion reads as travel, not smear. Coverage itself
     breathes with the sun's hour angle — thinnest near
     dawn, fullest mid-afternoon, settling to a night
     baseline — by moving the weather threshold along
     the field's measured distribution, so clear sky
     stays exactly clear at every hour; and the weather
     warp slowly turns and swells over periods of a day
     and more, so no two days dress the sky alike. The
     calibration that holds all of this to its measured
     occupancy stands in migration/sky_calib7.py.

     The composite order is the order light travels, and
     it is what keeps the sun alive: atmosphere first,
     stars dimmed by its transmittance, then the sun disc
     through the atmosphere alone — shining, now: a
     near-sun aureole and a wide, faint glare halo ride
     with the disc, both tinted by the same
     transmittance, the disc's own angular size
     untouched — and the moon beside it, phase-shaded
     behind the same transmittance with its own small
     aureole, then cirrus, then the
     clouds laid over everything as their own light plus
     their transmittance times what is behind them —
     cloudRGB + Tcloud · behind, Tcloud = exp(−τ). Thin
     cloud dims the disc by that exponential and no
     further, and the phase function's forward lobe
     throws the sun's glow around it. Only then is the
     picture tonemapped (ACES), encoded, and dithered
     with blue noise at one least-significant bit.

     Where WebGL2 is unavailable — or the volumetric path
     fails to build — the sky falls back to a flat-layer
     rendering from a baked 2D noise texture: two plane
     layers with calibrated coverage and the same
     distance fade, a cone light march toward the sun for
     shading, the same phase, ambient gradient, stars,
     and composite, so the sun survives the clouds there
     too. If even that fails, the sky is simply absent
     and the realm keeps its flat color, as it did before
     the sky existed.
     ========================================================== */

  /* ---- the frame the sky is handed ----
     The sky holds no location and reads no clock. Each
     frame, drawSky is handed a frame from the page's
     store — Sarah's last known location and the current
     instant — and everything celestial is computed from
     it: the sun's place, the moon's, the stars' wheel,
     the atmosphere's answer to all three, night itself.
     What the sky keeps of time is only the clouds'
     traveled time, integrated from the frames it is
     handed (skyAdvStep, below). */

  /* ---- the clouds' traveled time ----
     Advection and evolution integrate the sky clock, but
     the clock is not an integral: a device can sleep, or
     its clock can jump. This accumulator turns successive
     sky-clock readings into traveled seconds — a backward
     or huge step counts as nothing (the frame machinery
     resets itself on real gaps) — and reports each frame's
     own step, which the accumulation pass spends on
     carrying its history with the wind. */
  var skyAdvSec = 0, skyAdvPrevMs = null;
  function skyAdvStep(ms) {
    if (skyAdvPrevMs === null) { skyAdvPrevMs = ms; return 0; }
    var d = (ms - skyAdvPrevMs) / 1000;
    skyAdvPrevMs = ms;
    if (d < 0 || d > 7200) d = 0;
    skyAdvSec += d;
    return d;
  }

  /* [sky-astro] — the sky's astronomy: pure functions of
     latitude, longitude, and the instant, verified by the
     generator against Skyfield (JPL DE421) — see the
     design record for the deltas */
  function skyRad(d) { return d * Math.PI / 180; }
  function skyDeg(r) { return r * 180 / Math.PI; }
  function skyMod(x, n) { return ((x % n) + n) % n; }

  /* the sun's apparent position: the NOAA solar
     calculator's algorithm — Julian centuries, geometric
     mean longitude and anomaly, the equation of center,
     apparent ecliptic longitude, the corrected obliquity,
     declination, and the equation of time, closed by the
     hour angle. Elevation and azimuth in degrees, the
     azimuth clockwise from north. Arcminute-class: its
     sunrise for Walton on 2026-11-17 lands within a
     minute of the JPL ephemeris. */
  function skySunPos(latDeg, lonDeg, msUtc) {
    var jd = msUtc / 86400000 + 2440587.5;
    var T = (jd - 2451545.0) / 36525.0;
    var L0 = skyMod(280.46646 + T * (36000.76983 + 0.0003032 * T), 360);
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var ecc = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var Mr = skyRad(M), L0r = skyRad(L0);
    var C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
      Math.sin(3 * Mr) * 0.000289;
    var omega = 125.04 - 1934.136 * T;
    var lambda = skyRad(L0 + C - 0.00569 - 0.00478 * Math.sin(skyRad(omega)));
    var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = skyRad(eps0 + 0.00256 * Math.cos(skyRad(omega)));
    var decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    var t2 = Math.tan(eps / 2), vary = t2 * t2;
    var eqtime = 4 * skyDeg(vary * Math.sin(2 * L0r) - 2 * ecc * Math.sin(Mr) +
      4 * ecc * vary * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * vary * vary * Math.sin(4 * L0r) - 1.25 * ecc * ecc * Math.sin(2 * Mr));
    var utcMin = skyMod(msUtc / 60000, 1440);
    var tst = skyMod(utcMin + eqtime + 4 * lonDeg, 1440);
    var ha = skyRad(tst / 4 - 180);
    var phi = skyRad(latDeg);
    var cosZen = Math.sin(phi) * Math.sin(decl) +
      Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
    var el = 90 - skyDeg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
    var az = skyDeg(Math.atan2(Math.sin(ha),
      Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi))) + 180;
    return { el: el, az: az, haDeg: skyDeg(ha), declDeg: skyDeg(decl) };
  }

  /* the moon's apparent place: its mean orbital elements
     plus the principal perturbation terms of the lunar
     theory (Schlyter's series — the sun's pull on the
     moon is not a detail; the largest term alone swings
     the longitude by 1.3°), carried from geocentric
     ecliptic to equatorial, then corrected topocentrically:
     the moon is near enough that where the observer
     stands on Earth moves it by up to a degree, so the
     observer's own geocentric vector, in Earth radii, is
     subtracted from the moon's — exact at every latitude.
     It also returns the illuminated fraction, from the
     sun–moon elongation (the sun's place from the same
     NOAA series the sun's own function runs), and the
     apparent diameter, from the topocentric distance:
     the true size breathes between 0.489° and 0.558°
     over the month. Verified against Skyfield (JPL
     DE421) like the sun: worst place delta 0.11° over
     the generator's vectors, fraction within 0.002. */
  function skyMoonPos(latDeg, lonDeg, msUtc) {
    var d = msUtc / 86400000 - 10956.0; // days since 2000 Jan 0.0 (JD 2451543.5)
    var sin = Math.sin, cos = Math.cos;
    var N = skyMod(125.1228 - 0.0529538083 * d, 360);
    var w = skyMod(318.0634 + 0.1643573223 * d, 360);
    var M = skyMod(115.3654 + 13.0649929509 * d, 360);
    var inc = 5.1454, a = 60.2666, ecc = 0.0549;
    var E = M + skyDeg(ecc) * sin(skyRad(M)) * (1 + ecc * cos(skyRad(M)));
    for (var it = 0; it < 3; it++) {
      E = E - (E - skyDeg(ecc) * sin(skyRad(E)) - M) / (1 - ecc * cos(skyRad(E)));
    }
    var Er = skyRad(E);
    var xv = a * (cos(Er) - ecc), yv = a * (Math.sqrt(1 - ecc * ecc) * sin(Er));
    var v = skyDeg(Math.atan2(yv, xv)), r = Math.sqrt(xv * xv + yv * yv);
    var vw = skyRad(v + w), Nr = skyRad(N), ir = skyRad(inc);
    var xh = r * (cos(Nr) * cos(vw) - sin(Nr) * sin(vw) * cos(ir));
    var yh = r * (sin(Nr) * cos(vw) + cos(Nr) * sin(vw) * cos(ir));
    var zh = r * (sin(vw) * sin(ir));
    var lon = skyDeg(Math.atan2(yh, xh)), lat = skyDeg(Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)));
    var Ms = skyMod(356.0470 + 0.9856002585 * d, 360);
    var Ls = skyMod(Ms + 282.9404 + 4.70935e-5 * d, 360);
    var Lm = skyMod(N + w + M, 360);
    var D = skyMod(Lm - Ls, 360), F = skyMod(Lm - N, 360);
    function sD(x) { return sin(skyRad(x)); }
    function cD(x) { return cos(skyRad(x)); }
    lon += -1.274 * sD(M - 2 * D) + 0.658 * sD(2 * D) - 0.186 * sD(Ms)
      - 0.059 * sD(2 * M - 2 * D) - 0.057 * sD(M - 2 * D + Ms)
      + 0.053 * sD(M + 2 * D) + 0.046 * sD(2 * D - Ms)
      + 0.041 * sD(M - Ms) - 0.035 * sD(D) - 0.031 * sD(M + Ms)
      - 0.015 * sD(2 * F - 2 * D) + 0.011 * sD(M - 4 * D);
    lat += -0.173 * sD(F - 2 * D) - 0.055 * sD(M - F - 2 * D)
      - 0.046 * sD(M + F - 2 * D) + 0.033 * sD(F + 2 * D)
      + 0.017 * sD(2 * M + F);
    r += -0.58 * cD(M - 2 * D) - 0.46 * cD(2 * D);
    var eps = skyRad(23.4393 - 3.563e-7 * d);
    var lonr = skyRad(lon), latr = skyRad(lat);
    var xe = cos(latr) * cos(lonr);
    var ye = cos(latr) * sin(lonr) * cos(eps) - sin(latr) * sin(eps);
    var ze = cos(latr) * sin(lonr) * sin(eps) + sin(latr) * cos(eps);
    var ra = skyMod(skyDeg(Math.atan2(ye, xe)), 360);
    var dec = skyDeg(Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)));
    var jd = msUtc / 86400000 + 2440587.5;
    var T = (jd - 2451545.0) / 36525.0;
    var L0 = skyMod(280.46646 + T * (36000.76983 + 0.0003032 * T), 360);
    var Msun = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var Msr = skyRad(Msun);
    var C = sin(Msr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      sin(2 * Msr) * (0.019993 - 0.000101 * T) + sin(3 * Msr) * 0.000289;
    var om = 125.04 - 1934.136 * T;
    var lamS = skyRad(L0 + C - 0.00569 - 0.00478 * sin(skyRad(om)));
    var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var epsS = skyRad(eps0 + 0.00256 * cos(skyRad(om)));
    var raS = skyMod(skyDeg(Math.atan2(cos(epsS) * sin(lamS), cos(lamS))), 360);
    var decS = skyDeg(Math.asin(sin(epsS) * sin(lamS)));
    var cosE = sin(skyRad(decS)) * sin(skyRad(dec)) +
      cos(skyRad(decS)) * cos(skyRad(dec)) * cos(skyRad(raS - ra));
    var illum = (1 - Math.max(-1, Math.min(1, cosE))) / 2;
    var lst = skyGMST(msUtc) + lonDeg;
    var gclat = latDeg - 0.1924 * sin(2 * skyRad(latDeg));
    var rho = 0.99833 + 0.00167 * cos(2 * skyRad(latDeg));
    var lstr = skyRad(lst), gclr = skyRad(gclat);
    var ox = rho * cos(gclr) * cos(lstr), oy = rho * cos(gclr) * sin(lstr), oz2 = rho * sin(gclr);
    var decr = skyRad(dec), rar = skyRad(ra);
    var tx = r * cos(decr) * cos(rar) - ox;
    var ty = r * cos(decr) * sin(rar) - oy;
    var tz = r * sin(decr) - oz2;
    var raT = skyMod(skyDeg(Math.atan2(ty, tx)), 360);
    var decT = skyDeg(Math.atan2(tz, Math.sqrt(tx * tx + ty * ty)));
    var rTopo = Math.sqrt(tx * tx + ty * ty + tz * tz);
    var HT = skyMod(lst - raT + 540, 360) - 180;
    var phi = skyRad(latDeg), Hr = skyRad(HT), decTr = skyRad(decT);
    var alt = skyDeg(Math.asin(sin(phi) * sin(decTr) + cos(phi) * cos(decTr) * cos(Hr)));
    var az = skyMod(skyDeg(Math.atan2(sin(Hr), cos(Hr) * sin(phi) - Math.tan(decTr) * cos(phi))) + 180, 360);
    var distKm = rTopo * 6378.14;
    var diam = 2 * skyDeg(Math.asin(1737.4 / distKm));
    return { el: alt, az: az, illum: illum, angRad: skyRad(diam) / 2 };
  }

  /* Greenwich mean sidereal time in degrees (IAU 1982
     series, as in Meeus) — the stars' clock */
  function skyGMST(msUtc) {
    var jd = msUtc / 86400000 + 2440587.5;
    var T = (jd - 2451545.0) / 36525.0;
    return skyMod(280.46061837 + 360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T * T - T * T * T / 38710000.0, 360);
  }
  /* [/sky-astro] */

  /* ---- the day's breathing: coverage evolution ----
     The weather threshold is not a constant: it is read
     from the baked field's measured distribution (the
     table below, from migration/sky_calib5.py — target
     occupancy in, the threshold that delivers it out,
     measured through the warp morph), and the target
     occupancy itself follows the sun's hour angle: an
     activity curve, cosine-blended between control
     points — 0.75 near dawn, 1.05 at noon, 1.20 at
     mid-afternoon, 0.85 through the night — raised to
     1.2 and normalized by its own day-mean (0.8959), so
     the time-mean occupancy holds the calibrated 29.52%
     while the instant runs, measured, 23–42%. The flat
     tier reads the same occupancy through its own
     field's table. Placement zeros stay exact zeros at
     every hour: the threshold moves, the field does not
     grow where it was clear. */
  var SKY_OCC_BASE = 0.2952, SKY_OCC_GAMMA = 1.2, SKY_OCC_NORM = 0.8959;
  var SKY_COV_OCC = [0.16, 0.20, 0.24, 0.28, 0.2952, 0.32, 0.36, 0.40, 0.44];
  var SKY_COV_TTAB = [0.649, 0.6311, 0.6152, 0.6032, 0.5989, 0.5921, 0.5811, 0.5701, 0.5598];
  var SKY_FLAT_TTAB = [0.6144, 0.5988, 0.5848, 0.5720, 0.5669, 0.5584, 0.5463, 0.5351, 0.5240];
  var SKY_ACT_CTRL = [[-180, 0.85], [-100, 0.85], [-75, 0.75], [-30, 0.90],
    [0, 1.05], [45, 1.20], [75, 0.95], [105, 0.85], [180, 0.85]];
  function skyActivity(haDeg) {
    var H = Math.max(-180, Math.min(180, haDeg));
    for (var i = 0; i < SKY_ACT_CTRL.length - 1; i++) {
      var h0 = SKY_ACT_CTRL[i][0], a0 = SKY_ACT_CTRL[i][1];
      var h1 = SKY_ACT_CTRL[i + 1][0], a1 = SKY_ACT_CTRL[i + 1][1];
      if (H >= h0 && H <= h1) {
        var f = 0.5 - 0.5 * Math.cos(Math.PI * (H - h0) / (h1 - h0));
        return a0 + (a1 - a0) * f;
      }
    }
    return 0.85;
  }
  function skyThresh(tab, occ) {
    var o = Math.max(SKY_COV_OCC[0], Math.min(SKY_COV_OCC[SKY_COV_OCC.length - 1], occ));
    for (var i = 0; i < SKY_COV_OCC.length - 1; i++) {
      if (o >= SKY_COV_OCC[i] && o <= SKY_COV_OCC[i + 1]) {
        var f = (o - SKY_COV_OCC[i]) / (SKY_COV_OCC[i + 1] - SKY_COV_OCC[i]);
        return tab[i] + (tab[i + 1] - tab[i]) * f;
      }
    }
    return tab[tab.length - 1];
  }
  function skyWrapOff(x, m) { return ((x % m) + m) % m; }

  /* the cloud-level wind, metres per second in the
     world's frame (+x east, −z north): nine eastward,
     three northward — a mid-latitude westerly, blowing
     the weather from the west. The sampling offset is
     the wind times traveled sky-time, wrapped on a
     period every sampling tile divides (72000 m for the
     weather and shape tiles, 13000 for the detail's), so
     the wrap never shows. */
  var SKY_WIND = [9.0, -3.0];

  /* moonlight, in the page's own radiance units: a cool
     tint (0.82, 0.90, 1.08) at a gain of 0.9, scaled by
     the illuminated fraction — the shaders multiply by
     the atmosphere's transmittance toward the moon, as
     they do for the sun, so a full moon's peak lands
     near a tenth of a percent of the sun's: night clouds
     silvered, never day-like. The disc's own radiance
     is 2.6, barely warm-white. */
  var SKY_MOON_TINT = [0.82, 0.90, 1.08], SKY_MOON_GAIN = 0.9;
  var SKY_MOON_DISC = [2.6, 2.574, 2.47];

  /* ---- the frame's sky state ----
     One computation per frame, from the frame the store
     hands in, of everything the passes share: the sun's
     and moon's directions, the moon's light, the
     sidereal basis, the traveled advection offsets, the
     warp morph, and the day's coverage thresholds.
     Directions are azimuth and elevation in the world's
     own frame: +x east, +y up, −z north. The state is
     written into standing storage, so a frame allocates
     nothing. */
  var skySt = {
    ms: 0, dSkySec: 0, advSec: 0,
    sunDir: [0, 0, 0], moonDir: [0, 0, 0], moonIllum: 0, moonAng: 0,
    moonIrr: [0, 0, 0], moonWash: 0, covT: 0, flatT: 0,
    warpCS: [0, 0], warpAmp: 0, advOff: [0, 0], advDet: [0, 0],
    sid: [0, 0, 0, 0]
  };
  function skyState(fr) {
    var ms = fr.nowMs;
    var dSky = skyAdvStep(ms);
    var pos = skySunPos(fr.lat, fr.lon, ms);
    var elr = skyRad(pos.el), azr = skyRad(pos.az);
    var ce = Math.cos(elr);
    var lst = skyRad(skyGMST(ms) + fr.lon);
    var phi = skyRad(fr.lat);
    var mp = skyMoonPos(fr.lat, fr.lon, ms);
    var mel = skyRad(mp.el), maz = skyRad(mp.az), mce = Math.cos(mel);
    var act = skyActivity(pos.haDeg);
    var occ = Math.max(0.16, Math.min(0.44,
      SKY_OCC_BASE * Math.pow(act, SKY_OCC_GAMMA) / SKY_OCC_NORM));
    var thH = skyAdvSec / 3600;
    var wth = 2 * Math.PI * thH / 31;
    var st = skySt;
    st.ms = ms; st.dSkySec = dSky; st.advSec = skyAdvSec;
    st.sunDir[0] = Math.sin(azr) * ce; st.sunDir[1] = Math.sin(elr); st.sunDir[2] = -Math.cos(azr) * ce;
    st.moonDir[0] = Math.sin(maz) * mce; st.moonDir[1] = Math.sin(mel); st.moonDir[2] = -Math.cos(maz) * mce;
    st.moonIllum = mp.illum; st.moonAng = mp.angRad;
    st.moonIrr[0] = SKY_MOON_TINT[0] * SKY_MOON_GAIN * mp.illum;
    st.moonIrr[1] = SKY_MOON_TINT[1] * SKY_MOON_GAIN * mp.illum;
    st.moonIrr[2] = SKY_MOON_TINT[2] * SKY_MOON_GAIN * mp.illum;
    st.moonWash = 0.55 * mp.illum * Math.max(0, Math.min(1, st.moonDir[1] * 2.5));
    st.covT = skyThresh(SKY_COV_TTAB, occ); st.flatT = skyThresh(SKY_FLAT_TTAB, occ);
    st.warpCS[0] = Math.cos(wth); st.warpCS[1] = Math.sin(wth);
    st.warpAmp = 0.125 * (1 + 0.35 * Math.sin(2 * Math.PI * thH / 47 + 1.7));
    st.advOff[0] = skyWrapOff(-SKY_WIND[0] * skyAdvSec, 72000);
    st.advOff[1] = skyWrapOff(-SKY_WIND[1] * skyAdvSec, 72000);
    st.advDet[0] = skyWrapOff(-1.35 * SKY_WIND[0] * skyAdvSec, 13000);
    st.advDet[1] = skyWrapOff(-1.35 * SKY_WIND[1] * skyAdvSec, 13000);
    st.sid[0] = Math.sin(lst); st.sid[1] = Math.cos(lst);
    st.sid[2] = Math.sin(phi); st.sid[3] = Math.cos(phi);
    return st;
  }


  /* ---- the stars: a real catalog, baked into the page ----
     The catalog is the HYG database (v4.1, retrieved
     2026-11-17; migration/sky_stars.py is the bake):
     every star of apparent magnitude 6.0 or brighter —
     the naked-eye sky — with its B−V color and its IAU
     constellation from HYG's own record, its J2000 place
     precessed at build time to epoch 2026.88. Members of
     the ten constellations Sarah named — Ursa Major,
     Orion, Cassiopeia, Ursa Minor, Lyra, Cygnus, Leo,
     Taurus, Gemini, Scorpius — carry a boost flag and
     are baked a shade brighter (SKY_STAR_BOOST). Packed
     seven bytes a star (RA, Dec, magnitude, B−V, flags)
     and base64'd below; at load the catalog is rasterized
     into an equirectangular texture, brightness
     sqrt-encoded, splats widened toward the poles by
     1/cos(dec) so they stay round on the sphere, and the
     shaders sample it by turning the view direction back
     into equatorial coordinates with the sidereal basis.
     No Milky Way, no constellation lines, no labels —
     the stars themselves, where they actually are. (The
     moon stands in the composite, computed like the sun;
     a bright one washes the faintest of these out a
     little, as it should.) */
  var SKY_STAR_BOOST = 1.3;
  var SKY_STAR_COUNT = 5070;
  var SKY_STARS_B64 =
    "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" +
    "AAkGkqbUJgA1wY8D1HAA";
  function skyStarTint(bv) {
    var stops = [
      [-0.4, [0.60, 0.68, 1.00]], [0.0, [0.81, 0.85, 1.00]],
      [0.35, [1.00, 0.96, 0.92]], [0.7, [1.00, 0.85, 0.66]],
      [1.2, [1.00, 0.71, 0.44]], [2.0, [1.00, 0.55, 0.32]]
    ];
    var c = stops[stops.length - 1][1];
    if (bv <= stops[0][0]) c = stops[0][1];
    else {
      for (var i = 1; i < stops.length; i++) {
        if (bv <= stops[i][0]) {
          var f = (bv - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
          var a = stops[i - 1][1], b = stops[i][1];
          c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          break;
        }
      }
    }
    return [0.35 + 0.65 * c[0], 0.35 + 0.65 * c[1], 0.35 + 0.65 * c[2]];
  }
  function makeStarTex() {
    var W = 4096, H = 2048;
    var data = new Uint8Array(W * H * 3);
    try {
      var bin = atob(SKY_STARS_B64);
      if (bin.length !== SKY_STAR_COUNT * 7) throw new Error("catalog size");
      var raw = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i) & 0xff;
      for (var s = 0; s < SKY_STAR_COUNT; s++) {
        var o = s * 7;
        var ra = (raw[o] | (raw[o + 1] << 8)) / 65535 * 360;
        var decQ = raw[o + 2] | (raw[o + 3] << 8);
        if (decQ >= 32768) decQ -= 65536;
        var dec = decQ / 32767 * 90;
        var mag = raw[o + 4] / 25 - 2.5;
        var bv = raw[o + 5] / 64 - 0.6;
        var v = Math.pow(10, -0.25 * (mag + 1.5));
        if (raw[o + 6] & 1) v *= SKY_STAR_BOOST;
        if (v > 1) v = 1;
        var tint = skyStarTint(bv);
        var pr = Math.sqrt(v * tint[0]) * 255;
        var pg = Math.sqrt(v * tint[1]) * 255;
        var pb = Math.sqrt(v * tint[2]) * 255;
        var r = 1.0 + 2.2 * v;
        var rx = Math.min(r / Math.max(Math.cos(dec * Math.PI / 180), 0.10), 56);
        var cx = ra / 360 * W, cy = (dec + 90) / 180 * H;
        var x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
        var y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
        for (var y = y0; y <= y1; y++) {
          var dy = (y - cy) / r;
          for (var x = x0; x <= x1; x++) {
            var dx = (x - cx) / rx;
            var d2 = dx * dx + dy * dy;
            if (d2 >= 1) continue;
            var f = 0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(d2));
            var xi = ((x % W) + W) % W;
            var idx = (y * W + xi) * 3;
            data[idx] = Math.min(255, data[idx] + pr * f);
            data[idx + 1] = Math.min(255, data[idx + 1] + pg * f);
            data[idx + 2] = Math.min(255, data[idx + 2] + pb * f);
          }
        }
      }
    } catch (err) { /* a black star field: the sky still stands */ }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, W, H, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  var skySys = null;
  var skyDead = false;
  var SKY_SUN_IRR = [54.0, 60.0, 57.6];

  /* the observer height in the shader sources is
     Sarah's, and the module holds no copy of it: the
     sources carry it as @EYE@, and the value handed in
     at install (ctx.eyeHeight — the page's eye height,
     read from the now) is written in as each shader
     compiles. It is spelled as a GLSL float always:
     a decimal point, or the source does not compile. */
  function eyeHeightGLSL() {
    var s = String(EYE_HEIGHT);
    return s.indexOf(".") < 0 ? s + ".0" : s;
  }

  /* raw shader programs for the sky: the volumetric
     shaders are native GLSL ES 3.00 (sampler3D,
     texelFetch) and must NOT pass through the page's
     textual convert(); the generation and fallback
     shaders are plain ES 1.00, which a WebGL2 context
     also accepts as-is */
  function skyRawProg(vsrc, fsrc) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src.split("@EYE@").join(eyeHeightGLSL()));
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    }
    var v = sh(gl.VERTEX_SHADER, vsrc);
    var f = sh(gl.FRAGMENT_SHADER, fsrc);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }
  function skyProg(vsrc, fsrc, names) {
    var p = skyRawProg(vsrc, fsrc);
    if (!p) return null;
    var u = {};
    names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { prog: p, u: u, aPos: gl.getAttribLocation(p, "aPos") };
  }

  /* blue noise, 128×128, made in JS at load: white noise
     repeatedly low-passed (toroidal) and rank-remapped —
     its error spectrum is pushed to high frequencies,
     where temporal accumulation and the eye both forgive
     it. Used for the march's start jitter and the final
     output dither; never for density. */
  function makeBlueNoiseTex() {
    var N = 128, NN = N * N;
    var order = new Uint32Array(NN);
    var i, j, t;
    for (i = 0; i < NN; i++) order[i] = i;
    for (i = NN - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      t = order[i]; order[i] = order[j]; order[j] = t;
    }
    var vals = new Float32Array(NN);
    for (i = 0; i < NN; i++) vals[order[i]] = i / NN;
    var tmp = new Float32Array(NN);
    /* each round ranks the cells by their blurred value.
       The ranking is taken by a two-pass radix sort over
       the blurred values' own bits — they are all
       non-negative, so bit order is value order — which
       gives exactly the naive sort's ranking (ties keep
       index order, as a stable sort does) at a fraction
       of its cost: this generation is the largest single
       piece of JS in the sky's construction */
    var bits = new Uint32Array(tmp.buffer, tmp.byteOffset, NN);
    var rankA = new Uint32Array(NN), rankB = new Uint32Array(NN);
    var cnt = new Uint32Array(65536);
    for (var it = 0; it < 12; it++) {
      var x, y;
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        var s = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++)
          s += vals[((y + dy + N) % N) * N + ((x + dx + N) % N)];
        tmp[y * N + x] = s / 9;
      }
      for (i = 0; i < NN; i++) rankA[i] = i;
      for (var pass = 0; pass < 2; pass++) {
        cnt.fill(0);
        var sh = pass * 16;
        for (i = 0; i < NN; i++) cnt[(bits[rankA[i]] >>> sh) & 65535]++;
        var sum = 0;
        for (i = 0; i < 65536; i++) { var c = cnt[i]; cnt[i] = sum; sum += c; }
        for (i = 0; i < NN; i++) { var idx = rankA[i]; rankB[cnt[(bits[idx] >>> sh) & 65535]++] = idx; }
        var sw = rankA; rankA = rankB; rankB = sw;
      }
      for (i = 0; i < NN; i++) vals[rankA[i]] = i / NN;
    }
    var data = new Uint8Array(NN);
    for (i = 0; i < NN; i++) data[i] = Math.round(vals[i] * 255);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (glIs2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, N, N, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, N, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /* the generation shaders (ES 1.00): tileable noise,
     baked once at load into textures the march then
     samples with hardware filtering and mipmaps — the
     bake is what keeps the clouds free of grain */
  var SKY_VS_GEN = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "varying vec2 vNdc;",
    "void main(){",
    "  vUv = aPos * 0.5 + 0.5;",
    "  vNdc = aPos;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");
  var SKY_NOISE_GLSL = [
    "float gnHash(vec3 p){",
    "  p = fract(p * 0.1031);",
    "  p += dot(p, p.zyx + 31.32);",
    "  return fract((p.x + p.y) * p.z);",
    "}",
    "vec3 gnHash3(vec3 p){",
    "  return vec3(gnHash(p), gnHash(p + vec3(17.17, 9.31, 4.77)), gnHash(p + vec3(7.13, 23.71, 13.37)));",
    "}",
    "vec3 gradAt(vec3 cell, float per){",
    "  return gnHash3(mod(cell, per)) * 2.0 - 1.0;",
    "}",
    "float gnoise(vec3 p, float per){",
    "  vec3 i = floor(p);",
    "  vec3 f = p - i;",
    "  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);",
    "  float n000 = dot(gradAt(i, per), f);",
    "  float n100 = dot(gradAt(i + vec3(1.0, 0.0, 0.0), per), f - vec3(1.0, 0.0, 0.0));",
    "  float n010 = dot(gradAt(i + vec3(0.0, 1.0, 0.0), per), f - vec3(0.0, 1.0, 0.0));",
    "  float n110 = dot(gradAt(i + vec3(1.0, 1.0, 0.0), per), f - vec3(1.0, 1.0, 0.0));",
    "  float n001 = dot(gradAt(i + vec3(0.0, 0.0, 1.0), per), f - vec3(0.0, 0.0, 1.0));",
    "  float n101 = dot(gradAt(i + vec3(1.0, 0.0, 1.0), per), f - vec3(1.0, 0.0, 1.0));",
    "  float n011 = dot(gradAt(i + vec3(0.0, 1.0, 1.0), per), f - vec3(0.0, 1.0, 1.0));",
    "  float n111 = dot(gradAt(i + vec3(1.0, 1.0, 1.0), per), f - vec3(1.0, 1.0, 1.0));",
    "  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);",
    "}",
    "float worley(vec3 p, float per){",
    "  vec3 i = floor(p);",
    "  float f1 = 8.0;",
    "  for (int x = -1; x <= 1; x++)",
    "  for (int y = -1; y <= 1; y++)",
    "  for (int z = -1; z <= 1; z++){",
    "    vec3 c = i + vec3(float(x), float(y), float(z));",
    "    vec3 feat = gnHash3(mod(c, per));",
    "    vec3 d = c + feat - p;",
    "    d = d - per * floor(d / per + 0.5);",
    "    f1 = min(f1, dot(d, d));",
    "  }",
    "  return sqrt(f1);",
    "}",
    "float vnoise2(vec2 p, float per){",
    "  vec2 i = floor(p);",
    "  vec2 f = p - i;",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  float a = gnHash(vec3(mod(i, per), 3.7));",
    "  float b = gnHash(vec3(mod(i + vec2(1.0, 0.0), per), 3.7));",
    "  float c = gnHash(vec3(mod(i + vec2(0.0, 1.0), per), 3.7));",
    "  float d = gnHash(vec3(mod(i + vec2(1.0, 1.0), per), 3.7));",
    "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",
    "float fbm2(vec2 p, float per){",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  float w = 0.0;",
    "  for (int i = 0; i < 5; i++){",
    "    v += a * vnoise2(p, per);",
    "    w += a;",
    "    p *= 2.0;",
    "    per *= 2.0;",
    "    a *= 0.5;",
    "  }",
    "  return v / w;",
    "}",
    "float worley2(vec2 p, float per){",
    "  vec2 i = floor(p);",
    "  float f1 = 8.0;",
    "  for (int x = -1; x <= 1; x++)",
    "  for (int y = -1; y <= 1; y++){",
    "    vec2 c = i + vec2(float(x), float(y));",
    "    vec2 feat = gnHash3(vec3(mod(c, per), 9.1)).xy;",
    "    vec2 d = c + feat - p;",
    "    d = d - per * floor(d / per + 0.5);",
    "    f1 = min(f1, dot(d, d));",
    "  }",
    "  return sqrt(f1);",
    "}",
    "float worleyFbm2(vec2 p, float per){",
    "  float v = 0.0;",
    "  float a = 0.6;",
    "  float w = 0.0;",
    "  for (int i = 0; i < 2; i++){",
    "    v += a * (1.0 - clamp(worley2(p, per), 0.0, 1.2));",
    "    w += a;",
    "    p *= 2.0;",
    "    per *= 2.0;",
    "    a *= 0.5;",
    "  }",
    "  return v / w;",
    "}",
    "/* pass 5: rotated gradient noise and rotated Worley. The",
    "   frame q = M p with M = [[a, -b], [b, a]] is a rotation by",
    "   atan2(b, a) scaled by sqrt(a*a + b*b); cell indices are",
    "   reduced modulo the sublattice generated by S*(a, b) and",
    "   S*(-b, a), so the field tiles seamlessly with period S",
    "   in p while its lattice leaves the world axes. Phase A's",
    "   isolation diagnostics convicted the axis-aligned value",
    "   noise and the unrotated lattices at exactly the scales",
    "   these replace (pass5-diagnostics/FINDINGS.md). */",
    "vec2 skyLatRed(vec2 c, float a, float b, float S){",
    "  float det = a * a + b * b;",
    "  vec2 w = vec2(a * c.x + b * c.y, -b * c.x + a * c.y) / (S * det);",
    "  vec2 n = floor(w);",
    "  return c - S * vec2(a * n.x - b * n.y, b * n.x + a * n.y);",
    "}",
    "float skyG2r(vec2 cell, float a, float b, float S, float seed, vec2 d){",
    "  vec2 r = skyLatRed(cell, a, b, S);",
    "  vec2 g = gnHash3(vec3(r, seed)).xy * 2.0 - 1.0;",
    "  return g.x * d.x + g.y * d.y;",
    "}",
    "float gnoise2r(vec2 p, float a, float b, float S, float seed){",
    "  vec2 q = vec2(a * p.x - b * p.y, b * p.x + a * p.y);",
    "  vec2 c = floor(q);",
    "  vec2 f = q - c;",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  float v00 = skyG2r(c, a, b, S, seed, f);",
    "  float v10 = skyG2r(c + vec2(1.0, 0.0), a, b, S, seed, f - vec2(1.0, 0.0));",
    "  float v01 = skyG2r(c + vec2(0.0, 1.0), a, b, S, seed, f - vec2(0.0, 1.0));",
    "  float v11 = skyG2r(c + vec2(1.0, 1.0), a, b, S, seed, f - vec2(1.0, 1.0));",
    "  return mix(mix(v00, v10, u.x), mix(v01, v11, u.x), u.y);",
    "}",
    "float worley2r(vec2 p, float a, float b, float S, float seed){",
    "  vec2 q = vec2(a * p.x - b * p.y, b * p.x + a * p.y);",
    "  vec2 c = floor(q);",
    "  float f1 = 8.0;",
    "  for (int oy = -1; oy <= 1; oy++){",
    "    for (int ox = -1; ox <= 1; ox++){",
    "      vec2 cell = c + vec2(float(ox), float(oy));",
    "      vec2 r = skyLatRed(cell, a, b, S);",
    "      vec2 d = cell + gnHash3(vec3(r, seed)).xy - q;",
    "      f1 = min(f1, dot(d, d));",
    "    }",
    "  }",
    "  return sqrt(f1);",
    "}"
  ].join("\n");
  var SKY_FS_SHAPE = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform float uSlice;",
    SKY_NOISE_GLSL,
    "void main(){",
    "  vec3 uvw = vec3(vUv, (uSlice + 0.5) / 64.0);",
    "  float per = 0.0;",
    "  float amp = 0.5;",
    "  float wsum = 0.0;",
    "  vec3 pp = uvw * 3.0;",
    "  float perI = 3.0;",
    "  for (int i = 0; i < 4; i++){",
    "    per += amp * gnoise(pp, perI);",
    "    wsum += amp;",
    "    pp *= 2.0;",
    "    perI *= 2.0;",
    "    amp *= 0.5;",
    "  }",
    "  per = clamp(per / wsum * 0.85 + 0.5, 0.0, 1.0);",
    "  float wor = 0.0;",
    "  amp = 0.55;",
    "  wsum = 0.0;",
    "  pp = uvw * 3.0;",
    "  perI = 3.0;",
    "  for (int i = 0; i < 3; i++){",
    "    wor += amp * (1.0 - clamp(worley(pp, perI), 0.0, 1.2));",
    "    wsum += amp;",
    "    pp *= 2.0;",
    "    perI *= 2.0;",
    "    amp *= 0.55;",
    "  }",
    "  wor /= wsum;",
    "  float pw = clamp((per - (1.0 - wor)) / max(wor, 0.001), 0.0, 1.0);",
    "  float bk = 0.65 * gnoise(uvw * 4.0, 4.0) + 0.35 * gnoise(uvw * 5.0, 5.0);",
    "  pw = clamp(pw - 0.20 * clamp(bk / 0.3684, -1.0, 1.0), 0.0, 1.0);",
    "  float g = 1.0 - clamp(worley(uvw * 6.0, 6.0), 0.0, 1.2);",
    "  float b = 1.0 - clamp(worley(uvw * 12.0, 12.0), 0.0, 1.2);",
    "  float a = 1.0 - clamp(worley(uvw * 24.0, 24.0), 0.0, 1.2);",
    "  gl_FragColor = vec4(pw, g, b, a);",
    "}"
  ].join("\n");
  var SKY_FS_DETAIL = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform float uSlice;",
    SKY_NOISE_GLSL,
    "void main(){",
    "  vec3 uvw = vec3(vUv, (uSlice + 0.5) / 32.0);",
    "  float r = 1.0 - clamp(worley(uvw * 4.0, 4.0), 0.0, 1.2);",
    "  float g = 1.0 - clamp(worley(uvw * 8.0, 8.0), 0.0, 1.2);",
    "  float b = 1.0 - clamp(worley(uvw * 16.0, 16.0), 0.0, 1.2);",
    "  gl_FragColor = vec4(r, g, b, 1.0);",
    "}"
  ].join("\n");
  /* the weather map. R carries the complexes: a Worley
     fbm rotated 26.6° at 10.7/5.4 km cells, macro-weighted
     (0.65/0.25/0.10) over rotated gradient bands at the
     mid and detail scales. B's fbm half is rotated
     gradient fbm (Pythagorean rotations, alternating
     36.9°/53.1° per octave); its Worley half stands as
     baked. A, the tower channel, is a product: an
     envelope band and a core band on the same frequency
     grid, normalized separately and multiplied, with a
     2.4 km substructure band underneath — the tower
     boost stands only where a localized core rises
     inside a connected group. Pass 6 samples this map
     through the warp texture below (SKY_FS_WARP2): two
     independent vector warps, one for the placement
     group (R and the base-height G), one for the height
     group (B and A), each component a single gradient
     octave at 4.8 km correlation displacing up to
     ±1.25 km, so the fields' remaining organization is
     carried off every axis before a column is placed.
     All bands are normalized by constants measured on
     this bake (migration/pass6_fields.py), identically
     in the calibration replica. */
  var SKY_FS_WEATHER = [
    "precision highp float;",
    "varying vec2 vUv;",
    SKY_NOISE_GLSL,
    "void main(){",
    "  vec2 uv = vUv;",
    "  float mw1 = 1.0 - clamp(worley2r(uv + vec2(0.37, 0.91), 2.0, 1.0, 1.0, 3.7), 0.0, 1.2);",
    "  float mw2 = 1.0 - clamp(worley2r(uv * 2.0 + vec2(1.13, 0.29), 2.0, 1.0, 2.0, 3.7), 0.0, 1.2);",
    "  float macroW = (0.6 * mw1 + 0.3 * mw2) / 0.9;",
    "  float midG = (0.67 * gnoise2r(uv * 2.0 + vec2(0.53, 0.21), 2.0, 1.0, 2.0, 5.1)",
    "              + 0.33 * gnoise2r(uv * 2.0 + vec2(1.71, 1.33), 4.0, 3.0, 2.0, 6.3) + 0.3319) / 0.6504;",
    "  float detG = (gnoise2r(uv * 2.0 + vec2(0.87, 1.49), 3.0, 4.0, 2.0, 7.9) + 0.4329) / 0.9014;",
    "  float r = 0.65 * macroW + 0.25 * midG + 0.10 * detG;",
    "  float g = fbm2(uv * 7.0 + vec2(13.7, 5.9), 7.0);",
    "  float gfR = (0.5 * gnoise2r(uv + vec2(0.31, 0.77), 4.0, 3.0, 1.0, 11.3)",
    "             + 0.25 * gnoise2r(uv * 2.0 + vec2(1.13, 0.29), 3.0, 4.0, 2.0, 12.9)",
    "             + 0.125 * gnoise2r(uv * 2.0 + vec2(0.57, 1.61), 8.0, 6.0, 2.0, 14.1)",
    "             + 0.0625 * gnoise2r(uv * 2.0 + vec2(1.83, 0.91), 12.0, 16.0, 2.0, 15.7)",
    "             + 0.03125 * gnoise2r(uv * 4.0 + vec2(0.19, 1.37), 16.0, 12.0, 4.0, 17.3)) / 0.96875;",
    "  float gfbmR = (gfR + 0.2404) / 0.5365;",
    "  float b = 0.5 * gfbmR + 0.5 * worleyFbm2(uv * 9.0 + vec2(7.3, 2.9), 9.0);",
    "  float envN = (gnoise2r(uv * 2.0 + vec2(0.41, 1.07), 2.0, 1.0, 2.0, 21.7) + 0.3734) / 0.7581;",
    "  float subN = (gnoise2r(uv * 2.0 + vec2(1.53, 0.63), 4.0, 3.0, 2.0, 23.9) + 0.4587) / 0.9100;",
    "  float coreN = (gnoise2r(uv * 2.0 + vec2(0.97, 0.43), 2.0, 1.0, 3.0, 25.1) + 0.3942) / 0.9698;",
    "  float a = 0.85 * envN * coreN + 0.15 * subN;",
    "  gl_FragColor = vec4(r, g, b, a);",
    "}"
  ].join("\n");
  /* the warp texture: two independent two-component
     periodic vector warps for the weather sampling in
     placement() — RG displaces the placement group
     (R + base G), BA the height group (B + A). Each
     component is a single rotated gradient octave at
     4.8 km correlation, normalized by measured
     constants; placement scales (component − 0.5) by
     uWarpAmp × 0.833, peaking at ±1.25 km per component,
     and turns both warps with the morph rotation. */
  var SKY_FS_WARP2 = [
    "precision highp float;",
    "varying vec2 vUv;",
    SKY_NOISE_GLSL,
    "void main(){",
    "  vec2 uv = vUv;",
    "  float w1 = (gnoise2r(uv + vec2(0.13, 0.71), 4.0, 3.0, 1.0, 31.7) + 0.3833) / 0.7692;",
    "  float w2 = (gnoise2r(uv + vec2(0.53, 0.19), 3.0, 4.0, 1.0, 33.9) + 0.3937) / 0.8169;",
    "  float w3 = (gnoise2r(uv + vec2(0.47, 0.83), 3.0, 4.0, 1.0, 35.3) + 0.4916) / 0.9287;",
    "  float w4 = (gnoise2r(uv + vec2(0.61, 0.29), 4.0, 3.0, 1.0, 37.1) + 0.4992) / 0.9047;",
    "  gl_FragColor = vec4(w1, w2, w3, w4);",
    "}"
  ].join("\n");
  var SKY_FS_CLOUD2D = [
    "precision highp float;",
    "varying vec2 vUv;",
    SKY_NOISE_GLSL,
    "void main(){",
    "  vec2 uv = vUv;",
    "  float r = fbm2(uv * 6.0, 6.0);",
    "  float g = fbm2(uv * 6.0 + vec2(31.7, 17.3), 6.0);",
    "  float b = worleyFbm2(uv * 6.0, 6.0);",
    "  float a = fbm2(uv * 24.0, 24.0);",
    "  gl_FragColor = vec4(r, g, b, a);",
    "}"
  ].join("\n");
  /* the transmittance table: T along a ray as a function
     of the ray's cosine to the vertical and the height it
     starts from — sun-independent by construction, so it
     is computed once; the sun only selects which entry a
     ray reads. Parameterized u = sqrt over mu in
     [−0.12, 1], v = sqrt over height in [0, 80 km], and
     integrated with a 48-step exponential march using
     factored sphere intersections, so planet-scale
     numbers keep their precision in fp32 */
  var SKY_FS_LUT = [
    "precision highp float;",
    "varying vec2 vUv;",
    "vec3 betaExt(float h){",
    "  float rR = exp(-max(h, 0.0) / 8000.0);",
    "  float rM = exp(-max(h, 0.0) / 1200.0);",
    "  return vec3(5.8, 13.5, 33.1) * 1e-6 * rR + vec3(2.0556, 4.9788, 0.2136) * 1e-6 * rR + vec3(1.998e-6) * rM;",
    "}",
    "void main(){",
    "  float mu = -0.12 + 1.12 * vUv.x * vUv.x;",
    "  float h0 = 80000.0 * vUv.y * vUv.y;",
    "  float Rp = 6371000.0;",
    "  float y0 = Rp + h0;",
    "  float ymu = y0 * mu;",
    "  if (mu < 0.0 && h0 * (2.0 * Rp + h0) - ymu * ymu < 0.0){",
    "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
    "    return;",
    "  }",
    "  float disc = (80000.0 - h0) * (2.0 * Rp + 80000.0 + h0) + ymu * ymu;",
    "  float tTop = -ymu + sqrt(max(disc, 0.0));",
    "  float cosA = sqrt(max(0.0, 1.0 - mu * mu));",
    "  vec3 tau = vec3(0.0);",
    "  float sPrev = 0.0;",
    "  float hPrev = h0;",
    "  for (int i = 1; i < 49; i++){",
    "    float f = float(i) / 48.0;",
    "    float s = tTop * (exp(3.0 * f) - 1.0) / 20.085537;",
    "    float yy = y0 + s * mu;",
    "    float xx = s * cosA;",
    "    float h = sqrt(xx * xx + yy * yy) - Rp;",
    "    tau += betaExt(0.5 * (h + hPrev)) * (s - sPrev);",
    "    sPrev = s;",
    "    hPrev = h;",
    "  }",
    "  gl_FragColor = vec4(exp(-tau), 1.0);",
    "}"
  ].join("\n");

  /* GLSL fragments the sky's shaders share, written once
     and composed into each shader that uses them, so a
     function two tiers share exists in exactly one place
     in the module */
  var SKY_GLSL_PHASE_RM = [
    "float phaseR(float c){",
    "  return 0.0596831 * (1.0 + c * c);",
    "}",
    "float phaseM(float c){",
    "  float g = 0.78;",
    "  float d = 1.0 + g * g - 2.0 * g * c;",
    "  return (1.0 - g * g) / (12.5663706 * pow(d, 1.5));",
    "}"
  ].join("\n");
  var SKY_GLSL_PHASE_HG = [
    "float phaseHG(float c, float g){",
    "  float d = 1.0 + g * g - 2.0 * g * c;",
    "  return (1.0 - g * g) / (12.5663706 * pow(d, 1.5));",
    "}"
  ].join("\n");
  var SKY_GLSL_BEER = [
    "float beerPowderG(float tau, float cosT){",
    "  float powder = 1.0 - exp(-2.0 * tau);",
    "  float pf = mix(0.35, 1.0, clamp(cosT * 0.5 + 0.5, 0.0, 1.0));",
    "  return exp(-tau) * mix(1.0, powder * 1.4, pf);",
    "}"
  ].join("\n");
  var SKY_GLSL_ACES = [
    "vec3 aces(vec3 x){",
    "  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);",
    "}"
  ].join("\n");
  var SKY_GLSL_STARUV = [
    "vec2 starUv(vec3 d){",
    "  float a = -uSid.x * d.x + uSid.w * uSid.y * d.y + uSid.z * uSid.y * d.z;",
    "  float b = clamp(uSid.z * d.y - uSid.w * d.z, -1.0, 1.0);",
    "  float c = uSid.y * d.x + uSid.w * uSid.x * d.y + uSid.z * uSid.x * d.z;",
    "  return vec2(fract(atan(c, a) / 6.2831853), asin(b) / 3.1415927 + 0.5);",
    "}"
  ].join("\n");

  /* the volumetric shaders (ES 3.00, compiled raw) */
  var SKY_VS3 = [
    "#version 300 es",
    "layout(location = 0) in vec2 aPos;",
    "out vec2 vUv;",
    "out vec2 vNdc;",
    "void main(){",
    "  vUv = aPos * 0.5 + 0.5;",
    "  vNdc = aPos;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");
  /* the atmosphere, shared by the cloud and composite
     shaders: one coefficient set (Frostbite) — Rayleigh
     (5.8, 13.5, 33.1)e-6 /m over an 8 km profile, Mie
     1.8e-6 /m grey over 1.2 km with extinction 1.11x and
     an HG phase at g 0.78 (the sun's aureole), ozone
     (2.06, 4.98, 0.21)e-6 /m on the Rayleigh profile
     (the Chappuis band that keeps twilight blue) */
  var SKY_ATMO_GLSL3 = [
    "uniform sampler2D uLUT;",
    "uniform vec3 uSunIrr;",
    "vec3 sunTransmittance(float h, float mu){",
    "  float x = sqrt(clamp((mu + 0.12) / 1.12, 0.0, 1.0));",
    "  float y = sqrt(clamp(h / 80000.0, 0.0, 1.0));",
    "  return texture(uLUT, vec2(x, y)).rgb;",
    "}",
    SKY_GLSL_PHASE_RM,
    "vec3 betaSca(float hm){",
    "  float rR = exp(-max(hm, 0.0) / 8000.0);",
    "  float rM = exp(-max(hm, 0.0) / 1200.0);",
    "  return vec3(5.8, 13.5, 33.1) * 1e-6 * rR + vec3(1.8e-6) * rM;",
    "}",
    "vec3 betaExt(float hm){",
    "  float rR = exp(-max(hm, 0.0) / 8000.0);",
    "  float rM = exp(-max(hm, 0.0) / 1200.0);",
    "  return vec3(5.8, 13.5, 33.1) * 1e-6 * rR + vec3(2.0556, 4.9788, 0.2136) * 1e-6 * rR + vec3(1.998e-6) * rM;",
    "}",
    "vec3 atmoSource(float hm, float muL, float phR, float phM, float gate){",
    "  vec3 Ts = sunTransmittance(hm, muL);",
    "  vec3 Tms = sunTransmittance(hm, clamp(muL, -0.02, 1.0));",
    "  vec3 bS = betaSca(hm);",
    "  float rR = exp(-max(hm, 0.0) / 8000.0);",
    "  float rM = exp(-max(hm, 0.0) / 1200.0);",
    "  return uSunIrr * (Ts * (vec3(5.8, 13.5, 33.1) * 1e-6 * rR * phR + vec3(1.8e-6) * rM * phM) + Tms * bS * 0.0795775 * 0.55 * gate);",
    "}"
  ].join("\n");
  /* the full view-ray march for the composite: 14 steps
     spaced exponentially along the ray (validated
     offline against a 64-step reference to ~0.01 in
     display units), the sun's transmittance sampled per
     step at the step's own local sun angle — which is
     what lights the western twilight while the east
     stays dark — and each segment integrated exactly */
  var SKY_ATMO_FULL = [
    "void atmosphere(vec3 dir, vec3 sunDir, out vec3 L, out vec3 Tv){",
    "  float Rp = 6371000.0;",
    "  float hCam = @EYE@;",
    "  vec3 P0 = vec3(0.0, Rp + hCam, 0.0);",
    "  float mu = dir.y;",
    "  float ymu = (Rp + hCam) * mu;",
    "  float discT = (80000.0 - hCam) * (2.0 * Rp + 80000.0 + hCam) + ymu * ymu;",
    "  float tEnd = -ymu + sqrt(max(discT, 0.0));",
    "  if (mu < 0.0){",
    "    float discG = ymu * ymu - hCam * (2.0 * Rp + hCam);",
    "    if (discG > 0.0) tEnd = min(tEnd, -ymu - sqrt(discG));",
    "  }",
    "  tEnd = max(tEnd, 0.0);",
    "  float gate = pow(clamp((sunDir.y + 0.16) / 0.18, 0.0, 1.0), 1.5);",
    "  float c = dot(dir, sunDir);",
    "  float phR = phaseR(c);",
    "  float phM = phaseM(c);",
    "  L = vec3(0.0);",
    "  Tv = vec3(1.0);",
    "  float sPrev = 0.0;",
    "  for (int i = 1; i < 15; i++){",
    "    float f = float(i) / 14.0;",
    "    float s = tEnd * (exp(3.0 * f) - 1.0) / 20.085537;",
    "    vec3 Pm = P0 + dir * (0.5 * (s + sPrev));",
    "    float hm = length(Pm) - Rp;",
    "    float muL = dot(Pm / (Rp + hm), sunDir);",
    "    vec3 bE = betaExt(hm);",
    "    float ds = s - sPrev;",
    "    vec3 Tstep = exp(-bE * ds);",
    "    vec3 src = atmoSource(hm, muL, phR, phM, gate);",
    "    L += Tv * src * (vec3(1.0) - Tstep) / max(bE, vec3(1e-9));",
    "    Tv *= Tstep;",
    "    sPrev = s;",
    "  }",
    "  L += vec3(0.004, 0.008, 0.020);",
    "}"
  ].join("\n");
  /* the same march to a finite distance, for the cloud
     pass: aerial perspective over the cloud's mean depth,
     and the ambient estimates (zenith and horizon reads) */
  var SKY_ATMO_DIST = [
    "void atmoToDist(vec3 dir, vec3 sunDir, float dist, out vec3 L, out vec3 Tv){",
    "  float Rp = 6371000.0;",
    "  float hCam = @EYE@;",
    "  vec3 P0 = vec3(0.0, Rp + hCam, 0.0);",
    "  float gate = pow(clamp((sunDir.y + 0.16) / 0.18, 0.0, 1.0), 1.5);",
    "  float c = dot(dir, sunDir);",
    "  float phR = phaseR(c);",
    "  float phM = phaseM(c);",
    "  L = vec3(0.0);",
    "  Tv = vec3(1.0);",
    "  float sPrev = 0.0;",
    "  for (int i = 1; i < 7; i++){",
    "    float f = float(i) / 6.0;",
    "    float s = dist * (exp(2.2 * f) - 1.0) / 8.025014;",
    "    vec3 Pm = P0 + dir * (0.5 * (s + sPrev));",
    "    float hm = length(Pm) - Rp;",
    "    float muL = dot(Pm / (Rp + hm), sunDir);",
    "    vec3 bE = betaExt(hm);",
    "    float ds = s - sPrev;",
    "    vec3 Tstep = exp(-bE * ds);",
    "    vec3 src = atmoSource(hm, muL, phR, phM, gate);",
    "    L += Tv * src * (vec3(1.0) - Tstep) / max(bE, vec3(1e-9));",
    "    Tv *= Tstep;",
    "    sPrev = s;",
    "  }",
    "  L += vec3(0.004, 0.008, 0.020);",
    "}"
  ].join("\n");
  /* the frame-constants pass (L1, the refactor's one
     performance lever, fired at Sarah's word): four
     values the cloud pass used to recompute for every
     pixel — the atmosphere read at the zenith and at
     the horizon, and the sun's and moon's
     transmittances at cloud height — depend only on
     the frame's uniforms, so they are computed once,
     here, into a 4x1 target, by the cloud shader's own
     atmosphere functions on the frame's own uniforms.
     The cloud pass reads them back by texelFetch; the
     target is full float (RGBA32F), so a value read
     back is the value the per-pixel computation would
     have produced — the rendered sky does not change.
     Where a device cannot render full float, the pass
     is not created and the cloud shader computes the
     constants itself, exactly as it always has. */
  var SKY_FS_FRAME = [
    "#version 300 es",
    "precision highp float;",
    "out vec4 oColor;",
    "uniform vec3 uSunDir;",
    "uniform vec3 uMoonDir;",
    "uniform vec3 uMoonIrr;",
    SKY_ATMO_GLSL3,
    SKY_ATMO_DIST,
    "void main(){",
    "  int i = int(gl_FragCoord.x);",
    "  vec3 v = vec3(0.0);",
    "  if (i == 0){",
    "    vec3 T;",
    "    atmoToDist(vec3(0.0, 1.0, 0.0), uSunDir, 60000.0, v, T);",
    "  } else if (i == 1){",
    "    vec3 az = normalize(vec3(-uSunDir.z, 0.0, uSunDir.x) + vec3(0.0001, 0.0, 0.0));",
    "    vec3 T;",
    "    atmoToDist(normalize(vec3(az.x, 0.055, az.z)), uSunDir, 30000.0, v, T);",
    "  } else if (i == 2){",
    "    v = uSunIrr * sunTransmittance(2600.0, uSunDir.y);",
    "  } else {",
    "    v = uMoonIrr * sunTransmittance(2600.0, uMoonDir.y);",
    "  }",
    "  oColor = vec4(v, 1.0);",
    "}"
  ].join("\n");
  /* the cloud pass: the volume march at half resolution,
     writing (in-scatter, T_cloud) — never an alpha blend
     of an opaque color, so the composite behind it keeps
     the sun. The layer is a spherical shell (base
     1500 m, top 5800 m on a planet of radius
     6,371,000 m): rays enter and leave by sphere
     intersection, altitude is radial, and the trace
     range follows the ray's elevation — 35 km at 10°
     and above, ~65 km at 5°, ~100 km at 3° — with the
     whole-density fade riding the range's last 10 km,
     so the shell's full depth stands at the horizon
     instead of a sliced band. Placement is separated
     from density: the weather is read through two
     independent periodic vector warps (the warp
     texture — one for the placement group, one for the
     height group, each displacing up to ±1.25 km per
     component), and a calibrated weather threshold
     (uCovT — the day's point on the baked field's
     measured distribution, 0.5989 at the calibrated
     mean occupancy; see sky_calib7.py in the migration
     working papers) makes most of the map exactly zero,
     so empty regions return before any shape is
     sampled. The density remap is calibrated to the
     shape field's measured distribution (its R channel
     is sparse: median 0, p90 0.27). Columns stand to a
     per-column top remapped from the weather's height
     channel — the tower channel, an envelope × core
     product, raising localized cores inside connected
     groups — over a distribution that measures median
     ~1.77 km, p90 ~3.06 km, p99 ~4.01 km deep with a
     top std of ~800 m; the base shifts a little, the
     sampling leans with height (shear), the crown
     tapers from h 0.70 to 0.99 with gentle top erosion,
     a coarse billow breakup baked into the shape field
     keeps far masses structured past the detail fade,
     and the shape volume is sampled turned 31° from
     the weather's axes, so the two fields share no
     grid. A global density scale (SKY_DENS 0.52) holds
     the columns' optical depth at its calibrated
     distribution (τ p90 ~5.9, p99 ~12.7). The march is
     two-level — coarse probes on the placement density
     until first hit, then fine steps with detail —
     every shape fetch band-limited by a distance LOD,
     stopping when the ray is spent (T < 0.01). At each
     lit step the light march is a binned integral over
     the same full density — five bins to 4.5 km, each
     clipped to the shell's exit, midpoint-sampled with
     its clipped width — shaded with view-gated
     Beer–Powder (the sun's transmittance under a 1.15
     contrast exponent), a dual-lobe phase, a
     height-graded ambient of sky light, and a second,
     softer scattering octave at 0.20 weight and 0.45
     extinction; the moon runs the same march with its
     own light, untouched. */
  var SKY_FS_CLOUD = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vUv;",
    "in vec2 vNdc;",
    "out vec4 oColor;",
    "uniform vec3 uCamPos;",
    "uniform vec3 uFwd, uRight, uUp;",
    "uniform float uTan, uAspect;",
    "uniform vec3 uSunDir;",
    "uniform vec3 uMoonDir;",
    "uniform vec3 uMoonIrr;",
    "uniform float uFrame, uOutScale;",
    "uniform vec3 uAdv;",
    "uniform vec3 uAdvDet;",
    "uniform float uCovT, uWarpAmp;",
    "uniform vec2 uWarpCS;",
    "uniform sampler3D uShape;",
    "uniform sampler3D uDetail;",
    "uniform sampler2D uWeather;",
    "uniform sampler2D uWeather2;",
    "uniform sampler2D uBlueNoise;",
    "uniform sampler2D uFrameConsts;",
    "uniform float uPrePass;",
    SKY_ATMO_GLSL3,
    SKY_ATMO_DIST,
    "const float SKY_RP = 6371000.0;",
    "const float SHELL_BOT = 1500.0;",
    "const float SHELL_TOP = 5800.0;",
    "const float SIGMA_E = 0.025;",
    "const float SKY_DENS = 0.52;",
    "void placement(vec2 xz, out float mask, out float covEff, out float colTop, out float colBase, out vec2 shearV){",
    "  vec2 wuv = xz * (1.0 / 24000.0);",
    "  vec4 wth = textureLod(uWeather, wuv, 0.0);",
    "  vec4 wt2 = textureLod(uWeather2, wuv, 0.0);",
    "  vec2 wP0 = (wt2.rg - 0.5) * (uWarpAmp * 0.833);",
    "  vec2 wH0 = (wt2.ba - 0.5) * (uWarpAmp * 0.833);",
    "  vec2 warpP = vec2(wP0.x * uWarpCS.x - wP0.y * uWarpCS.y, wP0.x * uWarpCS.y + wP0.y * uWarpCS.x);",
    "  vec2 warpH = vec2(wH0.x * uWarpCS.x - wH0.y * uWarpCS.y, wH0.x * uWarpCS.y + wH0.y * uWarpCS.x);",
    "  vec4 wP = textureLod(uWeather, wuv + warpP, 0.0);",
    "  vec4 wH = textureLod(uWeather, wuv + warpH, 0.0);",
    "  mask = smoothstep(uCovT, uCovT + 0.08, wP.r);",
    "  covEff = mix(0.30, 1.0, mask);",
    "  float topF = pow(smoothstep(0.15, 0.85, wH.b), 1.3);",
    "  float tower = 0.48 * smoothstep(0.28, 0.50, wH.a);",
    "  colTop = clamp(mix(0.18, 0.70, topF) + tower, 0.10, 0.93);",
    "  colBase = (wP.g - 0.5) * 0.0377;",
    "  shearV = (wth.gb - 0.5) * 1100.0;",
    "}",
    "float localH(float hf, float colTop, float colBase){",
    "  return clamp((hf - colBase) / max(colTop - colBase, 0.05), 0.0, 1.0);",
    "}",
    "float envelope(float hf, float colTop, float colBase){",
    "  float hl = localH(hf, colTop, colBase);",
    "  return smoothstep(0.0, 0.12, hl) * (1.0 - smoothstep(0.70, 0.99, hl));",
    "}",
    "float shapeLOD(float dist){",
    "  return clamp(log2(max(dist, 1.0) / 2200.0), 0.0, 4.0);",
    "}",
    "float densityCore(vec3 wp, float hf, float covEff, float colTop, float colBase, vec2 shearV, float dist, float lodOff, out vec4 sh, out float hl){",
    "  hl = localH(hf, colTop, colBase);",
    "  vec3 sp = wp;",
    "  sp.xz += shearV * pow(hl, 1.5);",
    "  vec2 shXZ = mat2(0.85717, 0.51504, -0.51504, 0.85717) * sp.xz;",
    "  sh = textureLod(uShape, vec3(shXZ.x, sp.y, shXZ.y) * (1.0 / 4500.0), shapeLOD(dist) + lodOff);",
    "  float thr = (1.0 - covEff) * 0.28 + 0.09 * smoothstep(0.45, 0.95, hl);",
    "  return clamp((sh.r - thr) / 0.30, 0.0, 1.0);",
    "}",
    "float densityCheap(vec3 wp, float hf, float covEff, float colTop, float colBase, vec2 shearV, float dist){",
    "  vec4 sh;",
    "  float hl;",
    "  float b = densityCore(wp, hf, covEff, colTop, colBase, shearV, dist, 1.0, sh, hl);",
    "  b = clamp(b - (1.0 - sh.g) * 0.30 * (1.0 - hl * 0.5), 0.0, 1.0);",
    "  return b * envelope(hf, colTop, colBase) * SKY_DENS;",
    "}",
    "float densityFull(vec3 wp, vec3 pd, float hf, float covEff, float colTop, float colBase, vec2 shearV, float dist, float stride){",
    "  vec4 sh;",
    "  float hl;",
    "  float b = densityCore(wp, hf, covEff, colTop, colBase, shearV, dist, 0.0, sh, hl);",
    "  if (b <= 0.002) return 0.0;",
    "  float shapeFbm = sh.g * 0.625 + sh.b * 0.25 + sh.a * 0.125;",
    "  b = clamp(b - (1.0 - shapeFbm) * 0.30 * (1.0 - hl * 0.5), 0.0, 1.0);",
    "  b *= envelope(hf, colTop, colBase);",
    "  if (b <= 0.002) return 0.0;",
    "  vec3 pdS = pd;",
    "  pdS.xz += shearV * pow(hl, 1.5);",
    "  vec3 det = textureLod(uDetail, pdS * (1.0 / 650.0) + vec3(0.31, 0.17, 0.53), shapeLOD(dist)).rgb;",
    "  float detFbm = det.r * 0.625 + det.g * 0.25 + det.b * 0.125;",
    "  float ef = clamp(1.0 - b, 0.0, 1.0);",
    "  float eAmp = 0.38 * ef * (0.75 + 0.5 * hf) * (1.0 + 0.06 * smoothstep(0.55, 1.0, hl));",
    "  float footprint = max(dist * 0.0018, stride);",
    "  float erodeScale = (1.0 - smoothstep(9000.0, 12000.0, dist)) * clamp((170.0 - footprint) / 130.0, 0.0, 1.0);",
    "  float erode = mix(0.5 * eAmp, (1.0 - detFbm) * eAmp, erodeScale);",
    "  return clamp(b - erode, 0.0, 1.0) * SKY_DENS;",
    "}",
    SKY_GLSL_PHASE_HG,
    "float phaseCloud(float c){",
    "  return mix(phaseHG(c, -0.2), phaseHG(c, 0.8), 0.7);",
    "}",
    "float phaseCloud2(float c){",
    "  return mix(phaseHG(c, -0.07), phaseHG(c, 0.28), 0.7);",
    "}",
    SKY_GLSL_BEER,
    "float lightTapDir(vec3 p, vec3 off, vec3 Ldir, float along, float weight, float viewDist){",
    "  vec3 sp = p + Ldir * along + off;",
    "  float hf = (sp.y - SHELL_BOT) / (SHELL_TOP - SHELL_BOT);",
    "  if (hf < -0.05 || hf > 1.05) return 0.0;",
    "  float m, c, tp, bs;",
    "  vec2 shv;",
    "  placement(sp.xz, m, c, tp, bs, shv);",
    "  if (m <= 0.0) return 0.0;",
    "  return densityCheap(sp, clamp(hf, 0.0, 1.0), c, tp, bs, shv, viewDist) * SIGMA_E * weight;",
    "}",
    "float lightMarchDir(vec3 p, vec3 off, vec3 Ldir, float viewDist){",
    "  if (Ldir.y < -0.03) return 24.0;",
    "  float sExit = 4500.0;",
    "  if (Ldir.y > 0.0001) sExit = (SHELL_TOP - p.y) / Ldir.y;",
    "  else if (Ldir.y < -0.0001) sExit = (SHELL_BOT - p.y) / Ldir.y;",
    "  sExit = min(sExit, 4500.0);",
    "  if (sExit <= 0.0) return 0.0;",
    "  float tau = 0.0;",
    "  float b0 = min(120.0, sExit);",
    "  tau += lightTapDir(p, off, Ldir, 0.5 * b0, b0, viewDist);",
    "  float b1 = min(360.0, sExit);",
    "  if (b1 > 120.0) tau += lightTapDir(p, off, Ldir, 0.5 * (120.0 + b1), b1 - 120.0, viewDist);",
    "  float b2 = min(900.0, sExit);",
    "  if (b2 > 360.0) tau += lightTapDir(p, off, Ldir, 0.5 * (360.0 + b2), b2 - 360.0, viewDist);",
    "  float b3 = min(2000.0, sExit);",
    "  if (b3 > 900.0) tau += lightTapDir(p, off, Ldir, 0.5 * (900.0 + b3), b3 - 900.0, viewDist);",
    "  float b4 = min(4500.0, sExit);",
    "  if (b4 > 2000.0) tau += lightTapDir(p, off, Ldir, 0.5 * (2000.0 + b4), b4 - 2000.0, viewDist);",
    "  return tau;",
    "}",
    "void main(){",
    "  vec3 dir = normalize(uFwd + vNdc.x * uTan * uAspect * uRight + vNdc.y * uTan * uUp);",
    "  vec3 ro = uCamPos;",
    "  vec3 col = vec3(0.0);",
    "  float Tview = 1.0;",
    "  float meanD = 0.0;",
    "  float wSum = 0.0;",
    "  float jitter = texelFetch(uBlueNoise, ivec2(mod(gl_FragCoord.xy + vec2(mod(uFrame, 91.0) * 37.0, mod(uFrame, 57.0) * 53.0), 128.0)), 0).r;",
    "  vec3 wind = uAdv;",
    "  float cosT = dot(dir, uSunDir);",
    "  if (dir.y > -0.002){",
    "    float hCam = ro.y;",
    "    float bQ = (SKY_RP + hCam) * dir.y;",
    "    float cIn = (hCam - SHELL_BOT) * (2.0 * SKY_RP + hCam + SHELL_BOT);",
    "    float cOut = (hCam - SHELL_TOP) * (2.0 * SKY_RP + hCam + SHELL_TOP);",
    "    float t0 = -bQ + sqrt(max(bQ * bQ - cIn, 0.0));",
    "    float capT = 35000.0;",
    "    if (dir.y < 0.05234) capT = 100000.0;",
    "    else if (dir.y < 0.08716) capT = mix(100000.0, 65000.0, smoothstep(0.05234, 0.08716, dir.y));",
    "    else if (dir.y < 0.17365) capT = mix(65000.0, 35000.0, smoothstep(0.08716, 0.17365, dir.y));",
    "    float t1 = min(-bQ + sqrt(max(bQ * bQ - cOut, 0.0)), capT);",
    "    if (t1 > t0 && t0 > 0.0 && t0 < capT){",
    "      float path = t1 - t0;",
    "      vec3 Lz, Lh, sunTcloud, moonTcloud;",
    "      if (uPrePass > 0.5){",
    "        Lz = texelFetch(uFrameConsts, ivec2(0, 0), 0).rgb;",
    "        Lh = texelFetch(uFrameConsts, ivec2(1, 0), 0).rgb;",
    "        sunTcloud = texelFetch(uFrameConsts, ivec2(2, 0), 0).rgb;",
    "        moonTcloud = texelFetch(uFrameConsts, ivec2(3, 0), 0).rgb;",
    "      } else {",
    "        vec3 TzA, ThA;",
    "        atmoToDist(vec3(0.0, 1.0, 0.0), uSunDir, 60000.0, Lz, TzA);",
    "        vec3 az = normalize(vec3(-uSunDir.z, 0.0, uSunDir.x) + vec3(0.0001, 0.0, 0.0));",
    "        atmoToDist(normalize(vec3(az.x, 0.055, az.z)), uSunDir, 30000.0, Lh, ThA);",
    "        moonTcloud = uMoonIrr * sunTransmittance(2600.0, uMoonDir.y);",
    "        sunTcloud = uSunIrr * sunTransmittance(2600.0, uSunDir.y);",
    "      }",
    "      vec3 ambTop = (Lz + Lh) * 0.035 + moonTcloud * 0.12;",
    "      vec3 ambBase = (Lz * 0.25 + Lh * 0.35) * 0.07 + moonTcloud * 0.084;",
    "      float phase = phaseCloud(cosT);",
    "      float phase2 = phaseCloud2(cosT);",
    "      float cosM = dot(dir, uMoonDir);",
    "      float phaseMn = phaseCloud(cosM);",
    "      float phase2Mn = phaseCloud2(cosM);",
    "      float moonKey = max(moonTcloud.r, max(moonTcloud.g, moonTcloud.b));",
    "      float stride = path / 12.0;",
    "      float t = t0 + jitter * stride;",
    "      bool detailed = false;",
    "      int emptyRun = 0;",
    "      for (int i = 0; i < 48; i++){",
    "        if (t > t1 || Tview < 0.01) break;",
    "        vec3 p = ro + dir * t;",
    "        float alt = length(vec3(dir.x * t, SKY_RP + hCam + dir.y * t, dir.z * t)) - SKY_RP;",
    "        float hf = (alt - SHELL_BOT) / (SHELL_TOP - SHELL_BOT);",
    "        float dens = 0.0;",
    "        if (hf > -0.06 && hf < 1.06){",
    "          vec3 wp = p + wind;",
    "          float m, c, tp, bs;",
    "          vec2 shv;",
    "          placement(wp.xz, m, c, tp, bs, shv);",
    "          if (m > 0.0){",
    "            if (!detailed){",
    "              dens = densityCheap(wp, clamp(hf, 0.0, 1.0), c, tp, bs, shv, t);",
    "              if (dens > 0.10){",
    "                detailed = true;",
    "                t = max(t0, t - stride);",
    "                stride = path / 56.0;",
    "                continue;",
    "              }",
    "              dens = 0.0;",
    "            } else {",
    "              dens = densityFull(wp, p + uAdvDet, clamp(hf, 0.0, 1.0), c, tp, bs, shv, t, stride);",
    "            }",
    "            dens *= 1.0 - smoothstep(capT - 10000.0, capT, t);",
    "          }",
    "        }",
    "        if (detailed){",
    "          if (dens > 0.004){",
    "            emptyRun = 0;",
    "            float tauSun = lightMarchDir(vec3(p.x, p.y, p.z), wind, uSunDir, t);",
    "            float bp = beerPowderG(tauSun * 1.15, cosT);",
    "            float bp2 = beerPowderG(tauSun * 0.45, cosT);",
    "            vec3 phi = sunTcloud * (bp * phase + 0.20 * bp2 * phase2) * 2.2 + mix(ambBase, ambTop, clamp(hf, 0.0, 1.0) * 0.8 + 0.1);",
    "            if (moonKey > 0.003 && uMoonDir.y > -0.03){",
    "              float tauMoon = lightMarchDir(vec3(p.x, p.y, p.z), wind, uMoonDir, t);",
    "              float bpM = beerPowderG(tauMoon, cosM);",
    "              float bp2M = beerPowderG(tauMoon * 0.35, cosM);",
    "              phi += moonTcloud * (bpM * phaseMn + 0.30 * bp2M * phase2Mn) * 2.2;",
    "            }",
    "            float tStep = exp(-dens * SIGMA_E * stride);",
    "            float w = Tview * (1.0 - tStep);",
    "            col += w * phi;",
    "            meanD += w * t;",
    "            wSum += w;",
    "            Tview *= tStep;",
    "          } else {",
    "            emptyRun++;",
    "            if (emptyRun >= 3) stride = min(stride * 2.0, path / 24.0);",
    "          }",
    "        }",
    "        t += stride;",
    "      }",
    "      if (wSum > 0.001) meanD /= wSum;",
    "      else meanD = t0 + path * 0.5;",
    "    }",
    "  }",
    "  if (wSum > 0.001){",
    "    vec3 La, Ta;",
    "    atmoToDist(dir, uSunDir, meanD, La, Ta);",
    "    col = col * Ta + La * (1.0 - Tview);",
    "  }",
    "  oColor = vec4(col * uOutScale, Tview);",
    "}"
  ].join("\n");
  /* temporal accumulation: the current march blended
     into history by an exponential moving average
     (alpha 0.16 settled, 1 on reset). The history sample
     is reprojected through the previous frame's full
     camera transform — the pixel's representative cloud
     point, on the shell's mid-altitude along its ray, is
     carried into the previous frame with the camera's
     translation included, so walking does not smear the
     volume the way a rotation-only reprojection did.
     The wind's travel since the previous frame rides
     along (uWindDelta): the point is first carried back
     by the distance the field itself moved, so a moving
     sky accumulates the same cloud, not its neighbor —
     and when the sky clock steps far in one frame, as
     a sleeping device's jump does, the draw raises the
     current frame's weight toward the step, so nothing
     tears. Where the reprojected history disagrees with
     the current frame's transmittance, or lands far from
     where the pixel was, the current frame's weight
     rises — disocclusions converge in a frame or two
     instead of ghosting */
  var SKY_FS_ACCUM = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vUv;",
    "in vec2 vNdc;",
    "out vec4 oColor;",
    "uniform sampler2D uCur;",
    "uniform sampler2D uHist;",
    "uniform vec3 uFwd, uRight, uUp;",
    "uniform vec3 uPrevFwd, uPrevRight, uPrevUp;",
    "uniform vec3 uCamPos, uPrevCamPos;",
    "uniform vec3 uWindDelta;",
    "uniform float uTan, uAspect, uAlpha;",
    "void main(){",
    "  vec4 cur = texture(uCur, vUv);",
    "  float a = uAlpha;",
    "  vec3 dir = normalize(uFwd + vNdc.x * uTan * uAspect * uRight + vNdc.y * uTan * uUp);",
    "  float dRep = 20000.0;",
    "  if (dir.y > 0.004) dRep = clamp((3650.0 - uCamPos.y) / dir.y, 800.0, 30000.0);",
    "  vec3 P = uCamPos + dir * dRep;",
    "  vec3 rel = P - uWindDelta - uPrevCamPos;",
    "  float f = dot(rel, uPrevFwd);",
    "  vec2 puv = vec2(-1.0);",
    "  if (f > 0.05){",
    "    vec2 ndc = vec2(dot(rel, uPrevRight), dot(rel, uPrevUp)) / (f * uTan);",
    "    ndc.x /= uAspect;",
    "    puv = ndc * 0.5 + 0.5;",
    "  }",
    "  vec4 hist = cur;",
    "  if (puv.x > 0.003 && puv.x < 0.997 && puv.y > 0.003 && puv.y < 0.997){",
    "    hist = texture(uHist, puv);",
    "    if (abs(cur.a - hist.a) > 0.22) a = max(a, 0.7);",
    "    if (length(puv - vUv) > 0.08) a = max(a, 0.5);",
    "  } else {",
    "    a = 1.0;",
    "  }",
    "  oColor = mix(hist, cur, a);",
    "}"
  ].join("\n");
  /* the composite: full resolution, the order light
     travels — atmosphere, stars under it, the sun disc
     through the atmosphere alone (with its aureole and
     glare, so the clouds will occlude the shine as they
     occlude the disc), the moon beside it, phase-shaded
     behind the same transmittance, cirrus, then the
     clouds over everything by transmittance — then
     ACES, the encode, and one LSB of blue-noise dither */
  var SKY_FS_COMP = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vUv;",
    "in vec2 vNdc;",
    "out vec4 oColor;",
    "uniform vec3 uFwd, uRight, uUp;",
    "uniform float uTan, uAspect;",
    "uniform vec3 uSunDir;",
    "uniform vec3 uMoonDir;",
    "uniform vec3 uMoonIrr;",
    "uniform vec3 uMoonDisc;",
    "uniform float uMoonAng, uMoonWash;",
    "uniform float uCldScale, uAdvSec;",
    "uniform sampler2D uCloudAcc;",
    "uniform vec4 uSid;",
    "uniform sampler2D uStarMap;",
    "uniform sampler2D uWeather;",
    "uniform sampler2D uBlueNoise;",
    SKY_ATMO_GLSL3,
    SKY_ATMO_FULL,
    SKY_GLSL_STARUV,
    SKY_GLSL_ACES,
    "void main(){",
    "  vec3 dir = normalize(uFwd + vNdc.x * uTan * uAspect * uRight + vNdc.y * uTan * uUp);",
    "  float cosT = dot(dir, uSunDir);",
    "  vec3 atmL, atmT;",
    "  atmosphere(dir, uSunDir, atmL, atmT);",
    "  vec3 col = atmL;",
    "  float nightVis = clamp(1.0 - smoothstep(-0.18, 0.08, uSunDir.y), 0.0, 1.0);",
    "  if (nightVis > 0.001 && dir.y > 0.0){",
    "    vec3 st = texture(uStarMap, starUv(dir)).rgb;",
    "    col += st * st * 2.6 * atmT * nightVis * (1.0 - uMoonWash) * smoothstep(0.004, 0.05, dir.y);",
    "  }",
    "  float sunDisc = 0.0;",
    "  if (cosT > 0.99985){",
    "    float x = clamp((cosT - 0.99998921) / (1.0 - 0.99998921), 0.0, 1.0);",
    "    sunDisc = smoothstep(0.0, 0.28, x) * (0.45 + 0.55 * pow(x, 0.55)) * 1.15;",
    "  }",
    "  col += sunDisc * uSunIrr * atmT;",
    "  float cosTc = clamp(cosT, 0.0, 1.0);",
    "  col += uSunIrr * atmT * (pow(cosTc, 800.0) * 0.55 + pow(cosTc, 90.0) * 0.16);",
    "  float cosM = dot(dir, uMoonDir);",
    "  vec3 zA = -uMoonDir;",
    "  vec3 sxA = uSunDir - zA * dot(uSunDir, zA);",
    "  vec3 xA = dot(sxA, sxA) > 1e-8 ? normalize(sxA) : vec3(1.0, 0.0, 0.0);",
    "  vec3 yA = cross(zA, xA);",
    "  vec3 sunLoc = vec3(dot(uSunDir, xA), dot(uSunDir, yA), dot(uSunDir, zA));",
    "  vec2 dp = vec2(dot(dir, xA), dot(dir, yA)) / sin(uMoonAng);",
    "  float r2 = dot(dp, dp);",
    "  if (r2 < 1.0){",
    "    float nz = sqrt(1.0 - r2);",
    "    float lit = clamp(dp.x * sunLoc.x + dp.y * sunLoc.y + nz * sunLoc.z, 0.0, 1.0);",
    "    float mvis = 0.035 + 0.965 * lit;",
    "    float limb = 0.72 + 0.28 * nz;",
    "    float edge = 1.0 - smoothstep(0.97, 1.0, r2);",
    "    col += uMoonDisc * mvis * limb * edge * atmT;",
    "  }",
    "  float mGate = clamp((uMoonDir.y + 0.10) / 0.15, 0.0, 1.0);",
    "  col += uMoonIrr * atmT * mGate * (pow(clamp(cosM, 0.0, 1.0), 900.0) * 0.50 + pow(clamp(cosM, 0.0, 1.0), 120.0) * 0.10);",
    "  float Tcir = 1.0;",
    "  vec3 cirCol = vec3(0.0);",
    "  if (dir.y > 0.004){",
    "    vec2 cuv = dir.xz / (dir.y + 0.30);",
    "    float cirN = texture(uWeather, cuv * vec2(0.055, 0.145) + vec2(uAdvSec * 0.0016, 0.0)).g;",
    "    float cirD = smoothstep(0.54, 0.80, cirN) * smoothstep(0.015, 0.16, dir.y);",
    "    Tcir = exp(-cirD * 0.5);",
    "    vec3 sunT9 = sunTransmittance(9000.0, clamp(uSunDir.y, -0.05, 1.0));",
    "    float phCir = 0.22 + 2.4 * pow(clamp(cosT, 0.0, 1.0), 18.0);",
    "    float dayW = clamp((uSunDir.y + 0.12) / 0.30, 0.0, 1.0);",
    "    vec3 moonT9 = sunTransmittance(9000.0, clamp(uMoonDir.y, -0.05, 1.0));",
    "    float phCirM = 0.22 + 2.4 * pow(clamp(cosM, 0.0, 1.0), 18.0);",
    "    cirCol = (uSunIrr * sunT9 * phCir * 0.5 + uMoonIrr * moonT9 * phCirM * 0.5 + mix(vec3(0.012, 0.024, 0.060), vec3(0.35, 0.50, 0.85), dayW) * 0.35) * (1.0 - Tcir);",
    "  }",
    "  col = cirCol + Tcir * col;",
    "  vec4 cld = texture(uCloudAcc, vUv);",
    "  vec3 cloudRGB = cld.rgb * uCldScale;",
    "  float Tcloud = cld.a;",
    "  col = cloudRGB + Tcloud * col;",
    "  col = aces(col * 0.23);",
    "  col = pow(col, vec3(1.0 / 2.2));",
    "  float bn = texelFetch(uBlueNoise, ivec2(mod(gl_FragCoord.xy, 128.0)), 0).r;",
    "  col += (bn - 0.5) / 255.0;",
    "  float alpha = step(0.0, dir.y);",
    "  oColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  /* the fallback sky (ES 1.00): the report's best
     flat-layer tier. The atmosphere is the same physics
     with the sun's transmittance marched numerically
     instead of read from the table; the clouds are two
     plane layers from the baked 2D noise texture (its
     mip chain band-limits them), shaded by a four-tap
     cone light march toward the sun, the same dual-lobe
     phase, a density-derived height gradient for the
     ambient, and Beer–Powder — and the composite is the
     same order, so the sun survives the clouds here too.
     Pass 3 brings this tier what it can hold of the
     preset: coverage calibrated to the baked texture's
     measured distribution (a threshold at its 70th
     percentile — density is exactly zero below it, so
     most of the layer is true clear sky), the same
     sun-disc and exposure balance as the volumetric
     path, the gated powder and the attenuated second
     scatter, and a distance fade that dissolves the
     layers into the horizon haze between 25 and 35 km
     of slant range instead of letting them pile up */
  var SKY_FS_FLAT = [
    "precision highp float;",
    "uniform vec3 uFwd, uRight, uUp, uSunDir;",
    "uniform vec3 uSunIrr;",
    "uniform vec3 uMoonDir, uMoonIrr, uMoonDisc;",
    "uniform float uMoonAng, uMoonWash;",
    "uniform float uTan, uAspect, uAdvSec, uFlatT;",
    "uniform sampler2D uCloudTex;",
    "uniform sampler2D uWeather;",
    "uniform sampler2D uBlueNoise;",
    "uniform vec4 uSid;",
    "uniform sampler2D uStarMap;",
    "varying vec2 vUv;",
    "varying vec2 vNdc;",
    "vec3 betaExtAt(float h){",
    "  float rR = exp(-max(h, 0.0) / 8000.0);",
    "  float rM = exp(-max(h, 0.0) / 1200.0);",
    "  return vec3(5.8, 13.5, 33.1) * 1e-6 * rR + vec3(2.0556, 4.9788, 0.2136) * 1e-6 * rR + vec3(1.998e-6) * rM;",
    "}",
    "vec3 betaScaAt(float h){",
    "  float rR = exp(-max(h, 0.0) / 8000.0);",
    "  float rM = exp(-max(h, 0.0) / 1200.0);",
    "  return vec3(5.8, 13.5, 33.1) * 1e-6 * rR + vec3(1.8e-6) * rM;",
    "}",
    "vec3 sunTNum(vec3 P, vec3 D){",
    "  float Rp = 6371000.0;",
    "  float y0 = length(P);",
    "  float mu = dot(P / y0, D);",
    "  float ymu = y0 * mu;",
    "  float h0 = y0 - Rp;",
    "  if (mu < 0.0 && h0 * (2.0 * Rp + h0) - ymu * ymu < 0.0) return vec3(0.0);",
    "  float disc = (80000.0 - h0) * (2.0 * Rp + 80000.0 + h0) + ymu * ymu;",
    "  float tTop = -ymu + sqrt(max(disc, 0.0));",
    "  vec3 tau = vec3(0.0);",
    "  float sPrev = 0.0;",
    "  float hPrev = h0;",
    "  for (int i = 1; i < 6; i++){",
    "    float f = float(i) / 5.0;",
    "    float s = tTop * (exp(3.0 * f) - 1.0) / 20.085537;",
    "    float hm = length(P + D * (0.5 * (s + sPrev))) - Rp;",
    "    tau += betaExtAt(0.5 * (hm + hPrev)) * (s - sPrev);",
    "    sPrev = s;",
    "    hPrev = hm;",
    "  }",
    "  return exp(-tau);",
    "}",
    SKY_GLSL_PHASE_RM,
    SKY_GLSL_PHASE_HG,
    SKY_GLSL_BEER,
    SKY_GLSL_STARUV,
    SKY_GLSL_ACES,
    "vec4 flatLayer(vec2 wuv, float slantK, float cosT, vec3 sunTc, vec3 moonTc){",
    "  vec4 tx = texture2D(uCloudTex, wuv);",
    "  float densF = tx.r * 0.72 + tx.b * 0.28;",
    "  float cover = clamp((densF - uFlatT) * 2.4, 0.0, 1.0);",
    "  float tauV = min(cover * slantK, 12.0);",
    "  vec2 sunUv = uSunDir.xz / max(uSunDir.y + 0.30, 0.22);",
    "  float sl2 = length(sunUv);",
    "  if (sl2 > 2.2) sunUv *= 2.2 / sl2;",
    "  float tauS = 0.0;",
    "  for (int i = 1; i < 5; i++){",
    "    vec4 tt = texture2D(uCloudTex, wuv + sunUv * (float(i) * 0.012));",
    "    float dd = tt.r * 0.72 + tt.b * 0.28;",
    "    tauS += clamp((dd - uFlatT) * 2.4, 0.0, 1.0) * 1.1;",
    "  }",
    "  float bp = beerPowderG(tauS, cosT);",
    "  float bp2 = beerPowderG(tauS * 0.35, cosT);",
    "  float phase = mix(phaseHG(cosT, -0.2), phaseHG(cosT, 0.8), 0.7);",
    "  float phase2 = mix(phaseHG(cosT, -0.07), phaseHG(cosT, 0.28), 0.7);",
    "  float pseudoH = clamp(cover * 1.4, 0.0, 1.0);",
    "  vec3 ambTint = clamp(sunTc / 40.0, vec3(0.0), vec3(1.0));",
    "  vec3 amb = mix(vec3(0.30, 0.33, 0.40), vec3(0.55, 0.75, 1.15), pseudoH * 0.75 + 0.25) * (ambTint * 0.85 + vec3(0.012, 0.024, 0.060)) + moonTc * 0.30;",
    "  vec3 phi = sunTc * (bp * phase + 0.30 * bp2 * phase2) * 2.2 + amb;",
    "  float T = exp(-tauV);",
    "  return vec4(phi * (1.0 - T), T);",
    "}",
    "void main(){",
    "  vec3 dir = normalize(uFwd + vNdc.x * uTan * uAspect * uRight + vNdc.y * uTan * uUp);",
    "  float cosT = dot(dir, uSunDir);",
    "  float Rp = 6371000.0;",
    "  vec3 P0 = vec3(0.0, Rp + @EYE@, 0.0);",
    "  float gate = pow(clamp((uSunDir.y + 0.16) / 0.18, 0.0, 1.0), 1.5);",
    "  float mu = dir.y;",
    "  float ymu = (Rp + @EYE@) * mu;",
    "  float discT = (80000.0 - @EYE@) * (2.0 * Rp + 80000.0 + @EYE@) + ymu * ymu;",
    "  float tEnd = -ymu + sqrt(max(discT, 0.0));",
    "  if (mu < 0.0){",
    "    float discG = ymu * ymu - @EYE@ * (2.0 * Rp + @EYE@);",
    "    if (discG > 0.0) tEnd = min(tEnd, -ymu - sqrt(discG));",
    "  }",
    "  tEnd = max(tEnd, 0.0);",
    "  float phR = phaseR(cosT);",
    "  float phM = phaseM(cosT);",
    "  vec3 L = vec3(0.0);",
    "  vec3 Tv = vec3(1.0);",
    "  float sPrev = 0.0;",
    "  for (int i = 1; i < 8; i++){",
    "    float f = float(i) / 7.0;",
    "    float s = tEnd * (exp(3.0 * f) - 1.0) / 20.085537;",
    "    vec3 Pm = P0 + dir * (0.5 * (s + sPrev));",
    "    float hm = length(Pm) - Rp;",
    "    vec3 nrm = Pm / (Rp + hm);",
    "    float muL = dot(nrm, uSunDir);",
    "    vec3 Ts = sunTNum(Pm, uSunDir);",
    "    float muC = clamp(muL, -0.02, 1.0);",
    "    vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(0.0001, 0.0, 0.0));",
    "    float sh2 = sqrt(max(0.0, 1.0 - muC * muC));",
    "    vec3 Tms = sunTNum(Pm, vec3(sunH.x * sh2, muC, sunH.z * sh2));",
    "    vec3 bS = betaScaAt(hm);",
    "    vec3 bE = betaExtAt(hm);",
    "    float ds = s - sPrev;",
    "    vec3 Tstep = exp(-bE * ds);",
    "    vec3 src = uSunIrr * (Ts * (vec3(5.8, 13.5, 33.1) * 1e-6 * exp(-max(hm, 0.0) / 8000.0) * phR + vec3(1.8e-6) * exp(-max(hm, 0.0) / 1200.0) * phM) + Tms * bS * 0.0795775 * 0.55 * gate);",
    "    L += Tv * src * (vec3(1.0) - Tstep) / max(bE, vec3(1e-9));",
    "    Tv *= Tstep;",
    "    sPrev = s;",
    "  }",
    "  L += vec3(0.004, 0.008, 0.020);",
    "  vec3 col = L;",
    "  float nightVis = clamp(1.0 - smoothstep(-0.18, 0.08, uSunDir.y), 0.0, 1.0);",
    "  if (nightVis > 0.001 && dir.y > 0.0){",
    "    vec3 st = texture2D(uStarMap, starUv(dir)).rgb;",
    "    col += st * st * 2.6 * Tv * nightVis * (1.0 - uMoonWash) * smoothstep(0.004, 0.05, dir.y);",
    "  }",
    "  float sunDisc = 0.0;",
    "  if (cosT > 0.99985){",
    "    float x = clamp((cosT - 0.99998921) / (1.0 - 0.99998921), 0.0, 1.0);",
    "    sunDisc = smoothstep(0.0, 0.28, x) * (0.45 + 0.55 * pow(x, 0.55)) * 1.15;",
    "  }",
    "  col += sunDisc * uSunIrr * Tv;",
    "  float cosTc = clamp(cosT, 0.0, 1.0);",
    "  col += uSunIrr * Tv * (pow(cosTc, 800.0) * 0.55 + pow(cosTc, 90.0) * 0.16);",
    "  float cosM = dot(dir, uMoonDir);",
    "  vec3 zA = -uMoonDir;",
    "  vec3 sxA = uSunDir - zA * dot(uSunDir, zA);",
    "  vec3 xA = dot(sxA, sxA) > 1e-8 ? normalize(sxA) : vec3(1.0, 0.0, 0.0);",
    "  vec3 yA = cross(zA, xA);",
    "  vec3 sunLoc = vec3(dot(uSunDir, xA), dot(uSunDir, yA), dot(uSunDir, zA));",
    "  vec2 dp = vec2(dot(dir, xA), dot(dir, yA)) / sin(uMoonAng);",
    "  float r2 = dot(dp, dp);",
    "  if (r2 < 1.0){",
    "    float nz = sqrt(1.0 - r2);",
    "    float lit = clamp(dp.x * sunLoc.x + dp.y * sunLoc.y + nz * sunLoc.z, 0.0, 1.0);",
    "    float mvis = 0.035 + 0.965 * lit;",
    "    float limb = 0.72 + 0.28 * nz;",
    "    float edge = 1.0 - smoothstep(0.97, 1.0, r2);",
    "    col += uMoonDisc * mvis * limb * edge * Tv;",
    "  }",
    "  float mGate = clamp((uMoonDir.y + 0.10) / 0.15, 0.0, 1.0);",
    "  col += uMoonIrr * Tv * mGate * (pow(clamp(cosM, 0.0, 1.0), 900.0) * 0.50 + pow(clamp(cosM, 0.0, 1.0), 120.0) * 0.10);",
    "  float Tcir = 1.0;",
    "  vec3 cirCol = vec3(0.0);",
    "  if (dir.y > 0.004){",
    "    vec2 cuv = dir.xz / (dir.y + 0.30);",
    "    float cirN = texture2D(uWeather, cuv * vec2(0.055, 0.145) + vec2(uAdvSec * 0.0016, 0.0)).g;",
    "    float cirD = smoothstep(0.54, 0.80, cirN) * smoothstep(0.015, 0.16, dir.y);",
    "    Tcir = exp(-cirD * 0.5);",
    "    vec3 sunT9 = sunTNum(vec3(0.0, Rp + 9000.0, 0.0), uSunDir);",
    "    float phCir = 0.22 + 2.4 * pow(clamp(cosT, 0.0, 1.0), 18.0);",
    "    float dayW = clamp((uSunDir.y + 0.12) / 0.30, 0.0, 1.0);",
    "    vec3 moonT9 = sunTNum(vec3(0.0, Rp + 9000.0, 0.0), uMoonDir);",
    "    float phCirM = 0.22 + 2.4 * pow(clamp(cosM, 0.0, 1.0), 18.0);",
    "    cirCol = (uSunIrr * sunT9 * phCir * 0.5 + uMoonIrr * moonT9 * phCirM * 0.5 + mix(vec3(0.012, 0.024, 0.060), vec3(0.35, 0.50, 0.85), dayW) * 0.35) * (1.0 - Tcir);",
    "  }",
    "  col = cirCol + Tcir * col;",
    "  vec3 cloudRGB = vec3(0.0);",
    "  float Tcloud = 1.0;",
    "  if (dir.y > 0.004){",
    "    vec3 sunTc = uSunIrr * sunTNum(vec3(0.0, Rp + 2600.0, 0.0), uSunDir);",
    "    vec3 moonTc = uMoonIrr * sunTNum(vec3(0.0, Rp + 2600.0, 0.0), uMoonDir);",
    "    float fade = smoothstep(0.004, 0.06, dir.y);",
    "    vec2 wuv1 = dir.xz / max(dir.y, 0.05) * (2600.0 / 9000.0) + vec2(uAdvSec * 0.0019, uAdvSec * 0.00075);",
    "    vec2 wuv2 = dir.xz / max(dir.y, 0.05) * (3400.0 / 15000.0) + vec2(uAdvSec * 0.0011 + 0.37, uAdvSec * 0.0004);",
    "    vec4 farL = flatLayer(wuv2, 2.4 / max(dir.y, 0.10), cosT, sunTc, moonTc);",
    "    vec4 nearL = flatLayer(wuv1, 5.0 / max(dir.y, 0.10), cosT, sunTc, moonTc);",
    "    cloudRGB = nearL.rgb + nearL.a * farL.rgb;",
    "    Tcloud = nearL.a * farL.a;",
    "    float det = texture2D(uCloudTex, wuv1 * 4.0).a;",
    "    cloudRGB *= 0.92 + 0.16 * det;",
    "    cloudRGB *= fade;",
    "    Tcloud = mix(1.0, Tcloud, fade);",
    "    float approxDist = 2600.0 / max(dir.y, 0.02);",
    "    float dfade = 1.0 - smoothstep(25000.0, 35000.0, approxDist);",
    "    cloudRGB *= dfade;",
    "    Tcloud = mix(1.0, Tcloud, dfade);",
    "  }",
    "  col = cloudRGB + Tcloud * col;",
    "  col = aces(col * 0.23);",
    "  col = pow(col, vec3(1.0 / 2.2));",
    "  col += (texture2D(uBlueNoise, gl_FragCoord.xy / 128.0).r - 0.5) / 255.0;",
    "  float alpha = step(0.0, dir.y);",
    "  gl_FragColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  /* ---- render targets and texture plumbing ---- */
  function skyBindTex(unit, target, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, tex);
  }
  function skyDrawQuad(S, aPos) {
    gl.bindBuffer(gl.ARRAY_BUFFER, S.quadBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aPos);
  }
  function skyTex2D(w, h, mip, wrap) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, glIs2 ? gl.RGBA8 : gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }
  function skyFBO(tex, w, h) {
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { gl.deleteFramebuffer(fbo); return null; }
    return { tex: tex, fbo: fbo, w: w, h: h };
  }
  function skyRT(w, h, halfFloat) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    if (halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    var rt = skyFBO(tex, w, h);
    if (!rt) gl.deleteTexture(tex);
    return rt;
  }
  function skyGenInto(S, P, fbo, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.prog);
    skyDrawQuad(S, P.aPos);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* build the sky once: bake the noise and the
     transmittance table, compile the passes, and choose
     the path — volumetric where WebGL2 carries it, the
     flat-layer fallback otherwise. Any failure degrades
     one tier at a time and never touches the page */
  function initSky() {
    var S = {
      mode: null, frame: 0, prevSet: false, lastDrawMs: 0,
      prevSun: [0, 0, 0], prevFwd: [0, 0, 0], prevRight: [0, 0, 0],
      prevUp: [0, 0, 0], prevCam: [0, 0, 0],
      rtCur: null, histA: null, histB: null,
      rtScale: 1.0, rtScaleOut: 1.0, halfFloat: false,
      frameProg: null, frameRT: null
    };
    try {
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      S.quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, S.quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      S.blueNoiseTex = makeBlueNoiseTex();
      if (!S.blueNoiseTex) return null;
      S.starTex = makeStarTex();
      if (!S.starTex) return null;
      var genFbo = gl.createFramebuffer();
      /* the weather map: both paths drink from it */
      var weatherProg = skyProg(SKY_VS_GEN, SKY_FS_WEATHER, []);
      S.weatherTex = skyTex2D(256, 256, true, gl.REPEAT);
      var wFbo = S.weatherTex && skyFBO(S.weatherTex, 256, 256);
      if (!weatherProg || !wFbo) return null;
      skyGenInto(S, weatherProg, wFbo.fbo, 256, 256);
      gl.bindTexture(gl.TEXTURE_2D, S.weatherTex);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.deleteFramebuffer(wFbo.fbo);

      if (glIs2) {
        var volOK = true;
        S.halfFloat = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
        /* the transmittance table, computed once */
        var lutProg = skyProg(SKY_VS_GEN, SKY_FS_LUT, []);
        S.lutTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, S.lutTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        if (S.halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 256, 64, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        var lutFbo = skyFBO(S.lutTex, 256, 64);
        if (!lutProg || !lutFbo) volOK = false;
        if (volOK) {
          skyGenInto(S, lutProg, lutFbo.fbo, 256, 64);
          gl.deleteFramebuffer(lutFbo.fbo);
        }
        /* the shape and detail volumes, slice by slice */
        function bakeVolume(size, fsSrc) {
          var P = skyProg(SKY_VS_GEN, fsSrc, ["uSlice"]);
          if (!P) return null;
          var tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_3D, tex);
          gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, genFbo);
          gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, 0);
          var okF = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          if (!okF) { gl.deleteTexture(tex); return null; }
          for (var sl = 0; sl < size; sl++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, genFbo);
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, sl);
            gl.viewport(0, 0, size, size);
            gl.useProgram(P.prog);
            gl.uniform1f(P.u.uSlice, sl);
            skyDrawQuad(S, P.aPos);
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.bindTexture(gl.TEXTURE_3D, tex);
          gl.generateMipmap(gl.TEXTURE_3D);
          gl.bindTexture(gl.TEXTURE_3D, null);
          return tex;
        }
        if (volOK) {
          S.shapeTex = bakeVolume(64, SKY_FS_SHAPE);
          S.detailTex = bakeVolume(32, SKY_FS_DETAIL);
          if (!S.shapeTex || !S.detailTex) volOK = false;
        }
        /* the warp texture the placement sampling reads */
        if (volOK) {
          var warpProg = skyProg(SKY_VS_GEN, SKY_FS_WARP2, []);
          S.warpTex = skyTex2D(256, 256, false, gl.REPEAT);
          var wpFbo = S.warpTex && skyFBO(S.warpTex, 256, 256);
          if (!warpProg || !wpFbo) volOK = false;
          if (volOK) {
            skyGenInto(S, warpProg, wpFbo.fbo, 256, 256);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.deleteFramebuffer(wpFbo.fbo);
          }
        }
        if (volOK) {
          S.cloudProg = skyProg(SKY_VS3, SKY_FS_CLOUD,
            ["uCamPos", "uFwd", "uRight", "uUp", "uTan", "uAspect", "uSunDir", "uSunIrr", "uMoonDir", "uMoonIrr", "uFrame", "uOutScale", "uAdv", "uAdvDet", "uCovT", "uWarpAmp", "uWarpCS", "uShape", "uDetail", "uWeather", "uWeather2", "uBlueNoise", "uLUT"]);
          S.accumProg = skyProg(SKY_VS3, SKY_FS_ACCUM,
            ["uCur", "uHist", "uFwd", "uRight", "uUp", "uPrevFwd", "uPrevRight", "uPrevUp", "uCamPos", "uPrevCamPos", "uWindDelta", "uTan", "uAspect", "uAlpha"]);
          S.compProg = skyProg(SKY_VS3, SKY_FS_COMP,
            ["uFwd", "uRight", "uUp", "uTan", "uAspect", "uSunDir", "uSunIrr", "uMoonDir", "uMoonIrr", "uMoonDisc", "uMoonAng", "uMoonWash", "uAdvSec", "uCldScale", "uCloudAcc", "uSid", "uStarMap", "uWeather", "uBlueNoise", "uLUT"]);
          if (!S.cloudProg || !S.accumProg || !S.compProg) volOK = false;
        }
        if (volOK) {
          /* the frame-constants pre-pass (L1): a 4x1
             full-float target and the small program
             that fills it. Optional by design — if
             either fails, frameRT stays null and the
             cloud pass computes its constants itself */
          S.frameProg = skyProg(SKY_VS3, SKY_FS_FRAME,
            ["uSunDir", "uSunIrr", "uMoonDir", "uMoonIrr", "uLUT"]);
          if (S.frameProg && gl.getExtension("EXT_color_buffer_float")) {
            var frameTex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, frameTex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, 1, 0, gl.RGBA, gl.FLOAT, null);
            gl.bindTexture(gl.TEXTURE_2D, null);
            S.frameRT = skyFBO(frameTex, 4, 1);
            if (S.frameRT) {
              gl.useProgram(S.frameProg.prog);
              gl.uniform1i(S.frameProg.u.uLUT, 4);
            } else {
              gl.deleteTexture(frameTex);
            }
          }
        }
        if (volOK) {
          gl.useProgram(S.cloudProg.prog);
          gl.uniform1i(S.cloudProg.u.uShape, 0);
          gl.uniform1i(S.cloudProg.u.uDetail, 1);
          gl.uniform1i(S.cloudProg.u.uWeather, 2);
          gl.uniform1i(S.cloudProg.u.uBlueNoise, 3);
          gl.uniform1i(S.cloudProg.u.uLUT, 4);
          gl.uniform1i(S.cloudProg.u.uWeather2, 5);
          gl.uniform1i(S.cloudProg.u.uFrameConsts, 6);
          gl.useProgram(S.accumProg.prog);
          gl.uniform1i(S.accumProg.u.uCur, 0);
          gl.uniform1i(S.accumProg.u.uHist, 1);
          gl.useProgram(S.compProg.prog);
          gl.uniform1i(S.compProg.u.uCloudAcc, 0);
          gl.uniform1i(S.compProg.u.uStarMap, 1);
          gl.uniform1i(S.compProg.u.uWeather, 2);
          gl.uniform1i(S.compProg.u.uBlueNoise, 3);
          gl.uniform1i(S.compProg.u.uLUT, 4);
          S.mode = "vol";
        }
      }
      if (S.mode !== "vol") {
        var c2Prog = skyProg(SKY_VS_GEN, SKY_FS_CLOUD2D, []);
        S.cloud2DTex = skyTex2D(512, 512, true, gl.REPEAT);
        var c2Fbo = S.cloud2DTex && skyFBO(S.cloud2DTex, 512, 512);
        S.flatProg = skyProg(SKY_VS_GEN, SKY_FS_FLAT,
          ["uFwd", "uRight", "uUp", "uSunDir", "uSunIrr", "uMoonDir", "uMoonIrr", "uMoonDisc", "uMoonAng", "uMoonWash", "uTan", "uAspect", "uAdvSec", "uFlatT", "uCloudTex", "uSid", "uStarMap", "uWeather", "uBlueNoise"]);
        if (!c2Prog || !c2Fbo || !S.flatProg) return null;
        skyGenInto(S, c2Prog, c2Fbo.fbo, 512, 512);
        gl.bindTexture(gl.TEXTURE_2D, S.cloud2DTex);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.deleteFramebuffer(c2Fbo.fbo);
        gl.useProgram(S.flatProg.prog);
        gl.uniform1i(S.flatProg.u.uCloudTex, 0);
        gl.uniform1i(S.flatProg.u.uStarMap, 1);
        gl.uniform1i(S.flatProg.u.uWeather, 2);
        gl.uniform1i(S.flatProg.u.uBlueNoise, 3);
        S.mode = "flat";
      }
      gl.deleteFramebuffer(genFbo);
      return S;
    } catch (err) {
      return null;
    }
  }

  function skyEnsureRTs(S, w, h) {
    function drop(rt) {
      if (!rt) return;
      gl.deleteFramebuffer(rt.fbo);
      gl.deleteTexture(rt.tex);
    }
    drop(S.rtCur); drop(S.histA); drop(S.histB);
    S.rtCur = S.histA = S.histB = null;
    var tries = S.halfFloat ? [true, false] : [false];
    for (var ti = 0; ti < tries.length; ti++) {
      var hf = tries[ti];
      S.rtCur = skyRT(w, h, hf);
      S.histA = skyRT(w, h, hf);
      S.histB = skyRT(w, h, hf);
      if (S.rtCur && S.histA && S.histB) {
        S.rtScale = hf ? 1.0 : 16.0;
        S.rtScaleOut = hf ? 1.0 : 0.0625;
        return true;
      }
      drop(S.rtCur); drop(S.histA); drop(S.histB);
      S.rtCur = S.histA = S.histB = null;
    }
    return false;
  }

  function skyDrawVol(S, st, fwd, right, up, tan, aspect) {
    var sd = st.sunDir;
    var w = Math.max(2, glCanvas.width >> 1);
    var h = Math.max(2, glCanvas.height >> 1);
    var reset = false;
    if (!S.rtCur || S.rtCur.w !== w || S.rtCur.h !== h) {
      if (!skyEnsureRTs(S, w, h)) {
        S.mode = S.flatProg ? "flat" : null;
        if (S.mode === "flat") skyDrawFlat(S, st, fwd, right, up, tan, aspect);
        return;
      }
      reset = true;
    }
    var now = st.ms;
    if (!S.prevSet) reset = true;
    else {
      var dmax = Math.max(
        Math.abs(sd[0] - S.prevSun[0]),
        Math.abs(sd[1] - S.prevSun[1]),
        Math.abs(sd[2] - S.prevSun[2]));
      if (dmax > 0.004) reset = true;
      if (now - S.lastDrawMs > 2500) reset = true;
    }
    var alpha = reset ? 1.0 : 0.16;
    if (!reset && st.dSkySec > 0) alpha = Math.max(alpha, Math.min(0.4, st.dSkySec * 0.03));
    S.frame += 1;
    /* P1.5: the frame constants, once for the whole
       frame — the cloud pass reads them from the 4x1
       target instead of recomputing them per pixel */
    if (S.frameRT) {
      var FP = S.frameProg;
      gl.bindFramebuffer(gl.FRAMEBUFFER, S.frameRT.fbo);
      gl.viewport(0, 0, 4, 1);
      gl.useProgram(FP.prog);
      gl.uniform3f(FP.u.uSunDir, sd[0], sd[1], sd[2]);
      gl.uniform3f(FP.u.uSunIrr, SKY_SUN_IRR[0], SKY_SUN_IRR[1], SKY_SUN_IRR[2]);
      gl.uniform3f(FP.u.uMoonDir, st.moonDir[0], st.moonDir[1], st.moonDir[2]);
      gl.uniform3f(FP.u.uMoonIrr, st.moonIrr[0], st.moonIrr[1], st.moonIrr[2]);
      skyBindTex(4, gl.TEXTURE_2D, S.lutTex);
      skyDrawQuad(S, FP.aPos);
    }
    /* P2: the volume march, half resolution */
    var CP = S.cloudProg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.rtCur.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(CP.prog);
    gl.uniform3f(CP.u.uCamPos, camera.x, EYE_HEIGHT, camera.z);
    gl.uniform3f(CP.u.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(CP.u.uRight, right[0], right[1], right[2]);
    gl.uniform3f(CP.u.uUp, up[0], up[1], up[2]);
    gl.uniform3f(CP.u.uSunDir, sd[0], sd[1], sd[2]);
    gl.uniform3f(CP.u.uSunIrr, SKY_SUN_IRR[0], SKY_SUN_IRR[1], SKY_SUN_IRR[2]);
    gl.uniform3f(CP.u.uMoonDir, st.moonDir[0], st.moonDir[1], st.moonDir[2]);
    gl.uniform3f(CP.u.uMoonIrr, st.moonIrr[0], st.moonIrr[1], st.moonIrr[2]);
    gl.uniform1f(CP.u.uTan, tan);
    gl.uniform1f(CP.u.uAspect, aspect);
    gl.uniform3f(CP.u.uAdv, st.advOff[0], 0, st.advOff[1]);
    gl.uniform3f(CP.u.uAdvDet, st.advDet[0], 0, st.advDet[1]);
    gl.uniform1f(CP.u.uCovT, st.covT);
    gl.uniform1f(CP.u.uWarpAmp, st.warpAmp);
    gl.uniform2f(CP.u.uWarpCS, st.warpCS[0], st.warpCS[1]);
    gl.uniform1f(CP.u.uFrame, S.frame);
    gl.uniform1f(CP.u.uOutScale, S.rtScaleOut);
    gl.uniform1f(CP.u.uPrePass, S.frameRT ? 1.0 : 0.0);
    skyBindTex(0, gl.TEXTURE_3D, S.shapeTex);
    skyBindTex(1, gl.TEXTURE_3D, S.detailTex);
    skyBindTex(2, gl.TEXTURE_2D, S.weatherTex);
    skyBindTex(3, gl.TEXTURE_2D, S.blueNoiseTex);
    skyBindTex(4, gl.TEXTURE_2D, S.lutTex);
    skyBindTex(5, gl.TEXTURE_2D, S.warpTex);
    if (S.frameRT) skyBindTex(6, gl.TEXTURE_2D, S.frameRT.tex);
    skyDrawQuad(S, CP.aPos);
    /* P3: temporal accumulation with reprojection */
    var AP = S.accumProg;
    var pf = reset ? fwd : S.prevFwd;
    var pr = reset ? right : S.prevRight;
    var pu = reset ? up : S.prevUp;
    var pc = reset ? [camera.x, EYE_HEIGHT, camera.z] : S.prevCam;
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.histB.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(AP.prog);
    gl.uniform3f(AP.u.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(AP.u.uRight, right[0], right[1], right[2]);
    gl.uniform3f(AP.u.uUp, up[0], up[1], up[2]);
    gl.uniform3f(AP.u.uPrevFwd, pf[0], pf[1], pf[2]);
    gl.uniform3f(AP.u.uPrevRight, pr[0], pr[1], pr[2]);
    gl.uniform3f(AP.u.uPrevUp, pu[0], pu[1], pu[2]);
    gl.uniform3f(AP.u.uCamPos, camera.x, EYE_HEIGHT, camera.z);
    gl.uniform3f(AP.u.uPrevCamPos, pc[0], pc[1], pc[2]);
    if (reset) gl.uniform3f(AP.u.uWindDelta, 0, 0, 0);
    else gl.uniform3f(AP.u.uWindDelta, SKY_WIND[0] * st.dSkySec, 0, SKY_WIND[1] * st.dSkySec);
    gl.uniform1f(AP.u.uTan, tan);
    gl.uniform1f(AP.u.uAspect, aspect);
    gl.uniform1f(AP.u.uAlpha, alpha);
    skyBindTex(0, gl.TEXTURE_2D, S.rtCur.tex);
    skyBindTex(1, gl.TEXTURE_2D, S.histA.tex);
    skyDrawQuad(S, AP.aPos);
    var swapT = S.histA; S.histA = S.histB; S.histB = swapT;
    S.prevFwd[0] = fwd[0]; S.prevFwd[1] = fwd[1]; S.prevFwd[2] = fwd[2];
    S.prevRight[0] = right[0]; S.prevRight[1] = right[1]; S.prevRight[2] = right[2];
    S.prevUp[0] = up[0]; S.prevUp[1] = up[1]; S.prevUp[2] = up[2];
    S.prevCam[0] = camera.x; S.prevCam[1] = EYE_HEIGHT; S.prevCam[2] = camera.z;
    S.prevSun[0] = sd[0]; S.prevSun[1] = sd[1]; S.prevSun[2] = sd[2];
    S.prevSet = true; S.lastDrawMs = now;
    /* P4: the composite, full resolution */
    var MP = S.compProg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(MP.prog);
    gl.uniform3f(MP.u.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(MP.u.uRight, right[0], right[1], right[2]);
    gl.uniform3f(MP.u.uUp, up[0], up[1], up[2]);
    gl.uniform3f(MP.u.uSunDir, sd[0], sd[1], sd[2]);
    gl.uniform3f(MP.u.uSunIrr, SKY_SUN_IRR[0], SKY_SUN_IRR[1], SKY_SUN_IRR[2]);
    gl.uniform3f(MP.u.uMoonDir, st.moonDir[0], st.moonDir[1], st.moonDir[2]);
    gl.uniform3f(MP.u.uMoonIrr, st.moonIrr[0], st.moonIrr[1], st.moonIrr[2]);
    gl.uniform3f(MP.u.uMoonDisc, SKY_MOON_DISC[0], SKY_MOON_DISC[1], SKY_MOON_DISC[2]);
    gl.uniform1f(MP.u.uMoonAng, st.moonAng);
    gl.uniform1f(MP.u.uMoonWash, st.moonWash);
    gl.uniform1f(MP.u.uTan, tan);
    gl.uniform1f(MP.u.uAspect, aspect);
    gl.uniform1f(MP.u.uAdvSec, st.advSec);
    gl.uniform1f(MP.u.uCldScale, S.rtScale);
    gl.uniform4f(MP.u.uSid, st.sid[0], st.sid[1], st.sid[2], st.sid[3]);
    skyBindTex(0, gl.TEXTURE_2D, S.histA.tex);
    skyBindTex(1, gl.TEXTURE_2D, S.starTex);
    skyBindTex(2, gl.TEXTURE_2D, S.weatherTex);
    skyBindTex(3, gl.TEXTURE_2D, S.blueNoiseTex);
    skyBindTex(4, gl.TEXTURE_2D, S.lutTex);
    skyDrawQuad(S, MP.aPos);
    gl.disable(gl.BLEND);
  }

  function skyDrawFlat(S, st, fwd, right, up, tan, aspect) {
    var sd = st.sunDir;
    var FP = S.flatProg;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(FP.prog);
    gl.uniform3f(FP.u.uFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(FP.u.uRight, right[0], right[1], right[2]);
    gl.uniform3f(FP.u.uUp, up[0], up[1], up[2]);
    gl.uniform3f(FP.u.uSunDir, sd[0], sd[1], sd[2]);
    gl.uniform3f(FP.u.uSunIrr, SKY_SUN_IRR[0], SKY_SUN_IRR[1], SKY_SUN_IRR[2]);
    gl.uniform3f(FP.u.uMoonDir, st.moonDir[0], st.moonDir[1], st.moonDir[2]);
    gl.uniform3f(FP.u.uMoonIrr, st.moonIrr[0], st.moonIrr[1], st.moonIrr[2]);
    gl.uniform3f(FP.u.uMoonDisc, SKY_MOON_DISC[0], SKY_MOON_DISC[1], SKY_MOON_DISC[2]);
    gl.uniform1f(FP.u.uMoonAng, st.moonAng);
    gl.uniform1f(FP.u.uMoonWash, st.moonWash);
    gl.uniform1f(FP.u.uTan, tan);
    gl.uniform1f(FP.u.uAspect, aspect);
    gl.uniform1f(FP.u.uAdvSec, st.advSec);
    gl.uniform1f(FP.u.uFlatT, st.flatT);
    gl.uniform4f(FP.u.uSid, st.sid[0], st.sid[1], st.sid[2], st.sid[3]);
    skyBindTex(0, gl.TEXTURE_2D, S.cloud2DTex);
    skyBindTex(1, gl.TEXTURE_2D, S.starTex);
    skyBindTex(2, gl.TEXTURE_2D, S.weatherTex);
    skyBindTex(3, gl.TEXTURE_2D, S.blueNoiseTex);
    skyDrawQuad(S, FP.aPos);
    gl.disable(gl.BLEND);
  }

  var skyBasisF = [0, 0, 0], skyBasisR = [0, 0, 0], skyBasisU = [0, 0, 0];
  function drawSky(fr) {
    if (skyDead) return;
    if (!skySys) {
      skySys = initSky();
      if (!skySys) { skyDead = true; return; }
    }
    var S = skySys;
    var st = skyState(fr);
    var cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    var cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    var fwd = skyBasisF, right = skyBasisR, up = skyBasisU;
    fwd[0] = sy * cp; fwd[1] = sp; fwd[2] = -cy * cp;
    right[0] = cy; right[1] = 0; right[2] = sy;
    up[0] = right[1] * fwd[2] - right[2] * fwd[1];
    up[1] = right[2] * fwd[0] - right[0] * fwd[2];
    up[2] = right[0] * fwd[1] - right[1] * fwd[0];
    var tan = Math.tan(FOV_VERTICAL / 2 * Math.PI / 180);
    var aspect = glCanvas.width / Math.max(1, glCanvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    if (S.mode === "vol") skyDrawVol(S, st, fwd, right, up, tan, aspect);
    else if (S.mode === "flat") skyDrawFlat(S, st, fwd, right, up, tan, aspect);
    /* hand the context back as the rest of the draw
       expects it: no framebuffer, full-canvas viewport,
       unit 0 active with nothing bound, depth writes on */
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (glIs2) gl.bindTexture(gl.TEXTURE_3D, null);
  }


  /* ---- the draw hook ----
     The floor's draw assumes its program and its
     attribute state survive between frames (both are
     set once, in the page's scene setup). The sky
     changes both, so the hook captures them on Gaia's
     first frame — after the floor has drawn, while
     they are still the floor's own — and restores them
     after every sky draw, leaving the context as the
     page expects to find it. */
  return function (ctx) {
    gl = ctx.gl; glCanvas = ctx.glCanvas; glIs2 = ctx.glIs2; glProg = ctx.glProg;
    camera = ctx.camera;
    EYE_HEIGHT = ctx.eyeHeight; FOV_VERTICAL = ctx.fovVertical;
    var skySavedAttribs = null;
    var drawSceneFloor = ctx.drawScene;
    return function () {
      var frame = ctx.frame();
      drawSceneFloor();
      if (!gl || ctx.level() !== "gaia") return;
      if (!skySavedAttribs) {
        skySavedAttribs = [];
        for (var ai = 0; ai < 3; ai++) {
          skySavedAttribs.push({
            enabled: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
            buffer: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
            size: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_SIZE),
            type: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_TYPE),
            normalized: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
            stride: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
            offset: gl.getVertexAttribOffset(ai, gl.VERTEX_ATTRIB_ARRAY_POINTER)
          });
        }
      }
      /* the sky stands behind everything in Gaia, and in
         Gaia only — the other levels keep their flat
         color */
      gl.clear(gl.DEPTH_BUFFER_BIT);
      drawSky(frame);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      skySavedAttribs.forEach(function (sa, idx) {
        if (sa.buffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, sa.buffer);
          gl.vertexAttribPointer(idx, sa.size, sa.type, sa.normalized, sa.stride, sa.offset);
        }
        if (sa.enabled) gl.enableVertexAttribArray(idx);
        else gl.disableVertexAttribArray(idx);
      });
      gl.useProgram(glProg);
    };
  };
})();

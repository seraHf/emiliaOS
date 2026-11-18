/* ==========================================================
   THE NOW — the page's live values, in one home.

   The now is the one home for the live values sarahOS
   runs on. Each value is given once, here, or answered
   from givens held here — it lives nowhere else, and
   no module keeps a copy or goes looking for its own.
   The now holds two givens today: the moment, which is
   live, and Sarah — her fixed facts, and her location,
   held with the time it was fixed and where it came
   from. Everything else the now offers is an answer:
   worked out at the moment of asking, from the givens
   named beside it, and stored nowhere.

   THE GIVENS

   moment
     ms        What instant is this?
               live — the device clock, sampled on read

   sarah
     name      What is Sarah's name?
               fixed — Sarah's word
     born      When and where was Sarah born?
               fixed — Sarah's word. ONE entry: date,
               time, and place as recorded, never three
               givens that could disagree
     height    How tall is Sarah?
               fixed — Sarah's word, in meters
     location  Where is Sarah?
               held — the device, falling back to the
               standing home; carries at (when it was
               fixed) and from (where it came from),
               always

   THE ANSWERS

     date, weekday, month, year, time of day —
       from moment.ms, read where Sarah is: the
       device's local timezone, which is the timezone
       of the held location.
     age —
       from moment.ms + sarah.born.
       OPEN — Sarah's ruling is owed, and until she
       gives it the answer is not computed: whether
       age turns at the birth time read in the birth
       timezone or in the current one is hers to say,
       and no formula here decides it silently.

   The location, held: the standing home below holds
   until the device speaks. A device-confirmed answer,
   cached on the device (key sarahos-location, device-
   sourced entries only), is the value the moment the
   page opens; the device is then asked once, silently,
   in the background, and a fresh answer updates the
   value and the cache. After the ask, the now watches
   while the page is open: a watch fix updates the
   value and the cache only when it carries her at
   least ~25 m from the standing device value and its
   timestamp is newer than that value's. A denial or
   silence leaves the last value standing; a watch
   error stops the watch, silently, the same way.
   (The cache carries no timestamp, so a value restored
   from it stands with at = 0 — before any fix of this
   page load — and the watch's newer-than test reads
   it that way, as it always has.)
   The location never leaves the device: it is written
   nowhere but the device's own storage, and nothing
   in the page sends it anywhere. There is no location
   control in the page — the standing home changes
   when Sarah says so, by hand, here.
   ========================================================== */
var now = (function () {
  /* moment — its one given is the instant, live:
     sampled at the read, held nowhere */
  var moment = {};
  Object.defineProperty(moment, "ms", {
    enumerable: true,
    get: function () { return Date.now(); }
  });

  /* sarah — the fixed facts, and the held location.
     born was set by hand at Sarah's word on
     2026-11-18, as recorded; the working record
     outside this file does not carry it — this entry
     is its one home. */
  var sarah = {
    name: "Sarah Haydn Rodriguez",
    born: { date: "1996-01-16", time: "12:40", place: "Whittier, CA" },
    height: 1.768475,
    location: { lat: 38.9164, lon: -84.6334, at: 0, from: "home" }
  };
  var LOC_KEY = "sarahos-location";
  function locationValid(lat, lon) {
    return isFinite(lat) && isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }
  function setLocation(lat, lon, from, at) {
    if (!locationValid(lat, lon)) return;
    sarah.location.lat = lat;
    sarah.location.lon = lon;
    sarah.location.from = from;
    if (from === "device") {
      if (isFinite(at)) sarah.location.at = at;
      try {
        localStorage.setItem(LOC_KEY, JSON.stringify(
          { lat: lat, lon: lon, source: "device" }));
      } catch (err) { /* the now holds it for the session */ }
    }
  }
  (function () {
    var cached = null;
    try {
      var raw = localStorage.getItem(LOC_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.source === "device" && locationValid(p.lat, p.lon)) cached = p;
      }
    } catch (err) { cached = null; }
    if (cached) {
      sarah.location.lat = cached.lat;
      sarah.location.lon = cached.lon;
      sarah.location.from = "device";
    }
    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      setLocation(pos.coords.latitude, pos.coords.longitude, "device", pos.timestamp);
    }, function () { /* denied or unavailable: the last value stands */ },
      { timeout: 8000, maximumAge: 3600000 });
    if (!navigator.geolocation.watchPosition) return;
    /* the watch: while the page is open. A fix is
       taken only when it carries her at least ~25 m
       from the standing device value and is newer
       than it; anything less is jitter, and anything
       older is a stale answer — neither moves the
       value. An error or a withdrawn permission
       stops the watch, silently, and the last value
       stands. Nothing here leaves the device. */
    var watchId = navigator.geolocation.watchPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      if (!locationValid(lat, lon)) return;
      if (sarah.location.from === "device") {
        if (!(pos.timestamp > sarah.location.at)) return;
        var dLat = (lat - sarah.location.lat) * 111320;
        var dLon = (lon - sarah.location.lon) * 111320 *
          Math.cos(sarah.location.lat * Math.PI / 180);
        if (dLat * dLat + dLon * dLon < 25 * 25) return;
      }
      setLocation(lat, lon, "device", pos.timestamp);
    }, function () {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }, { timeout: 8000 });
  })();

  /* the answers — derived at the asking, from the
     givens named in the banner, stored nowhere */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  var answers = {
    date: function () {
      var d = new Date(moment.ms);
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    },
    weekday: function () {
      return ["Sunday", "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday"][new Date(moment.ms).getDay()];
    },
    month: function () { return new Date(moment.ms).getMonth() + 1; },
    year: function () { return new Date(moment.ms).getFullYear(); },
    timeOfDay: function () {
      var d = new Date(moment.ms);
      return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    },
    /* OPEN — see the banner: the timezone age turns
       in is Sarah's ruling to give, not a formula's
       to decide. Until she rules, no answer. */
    age: function () { return null; }
  };

  /* the frame the now hands a module: Sarah's last
     known location and the current instant, read in
     one place. This is the sky's whole knowledge of
     Sarah. */
  function frame() {
    return { lat: sarah.location.lat, lon: sarah.location.lon, nowMs: moment.ms };
  }

  return { moment: moment, sarah: sarah, answers: answers, frame: frame };
})();

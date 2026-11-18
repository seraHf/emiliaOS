/* ================================================================
   emiliaOS — the gifts module (gifts/gifts.js)

   The things Sarah placed in Earth for Emilia, drawn over the
   page's floor by this module, in Gaia only:

   · Optimus Prime (gifts/optimus.glb), on the floor a few
     meters ahead of the origin, facing it. The file is a
     diorama: it holds two of him — a still Optimus who
     stands upright in place, untouched by the clip, and a
     second, animated Optimus who begins in a crouch and
     whose parts the file's one animation carries into the
     truck. A boolean button the page shows in Gaia chooses
     which of him stands in the world — Standing or
     Animated — and only the chosen one is drawn, each
     grounded on the floor and centered on the same spot,
     at the same stature. In Animated, a second button runs
     the transformation: pressed in robot form he transforms
     into the truck; pressed in truck form he resets to the
     robot, as he was. The buttons are this module's own;
     the page's press machine never sees them.

     At load this module tells the two apart at the clip's
     end, where they stand separated: the still is the tall
     cluster still standing where a robot stands, and the
     rest is the transformer.

   · A small chest of drawers beside him, and on top of it a
     framed photograph (gifts/us.jpg) — the two of them, in a
     car, Emilia leaning in. The frame leans back a little,
     the way a photograph stands on a dresser.

   The page hands this module what it hands the sky — the GL
   context, the canvas, the camera, the eye height and field
   of view, the level read live, whether the tool is up, and
   the page's own draw — and takes back its draw with the
   gifts hooked in. The module keeps nothing of the page but
   what it is handed. It snapshots every piece of GL state it
   touches and restores it all before returning, so the floor
   and the sky never know it was there.

   The light here is a fixed, soft key — the sky lights
   nothing in the world, and the gifts follow that rule; a
   later hand can wire the real sun in.
   ================================================================ */
(function () {
  "use strict";

  /* the module's own folder, from the script that loaded it —
     the model and the photograph live beside it, wherever
     the page is served from */
  var BASE = "gifts/";
  (function () {
    var s = document.currentScript;
    if (s && s.src) {
      var i = s.src.lastIndexOf("/");
      if (i >= 0) BASE = s.src.slice(0, i + 1);
    }
  })();
  var MODEL_URL = BASE + "optimus.glb";
  var PHOTO_URL = BASE + "us.jpg";

  /* placement — one unit is one meter, the origin is where
     the page opens. He stands ahead and a little right of it,
     the dresser ahead and a little left, both inside the
     first view on a phone. He faces the origin, so he faces
     whoever arrives. */
  var BOT_POS = { x: 3.0, z: -14.5 };
  /* to scale, leaning big, at Sarah's word: the G1 scale
     charts put Optimus Prime at 6 m and the live-action
     films at 28 ft (8.5 m); he stands at the larger */
  var BOT_HEIGHT = 8.5; /* meters, in robot form */
  var DRESSER_POS = { x: -1.7, z: -6.8 };

  /* ---------- small matrix / quaternion kit (column-major) ---------- */
  function mIdent() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
  function mMul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function mCompose(t, q, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x, y2 = y + y, z2 = z + z;
    var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    var o = new Float32Array(16);
    o[0] = (1 - (yy + zz)) * s[0]; o[1] = (xy + wz) * s[0]; o[2] = (xz - wy) * s[0]; o[3] = 0;
    o[4] = (xy - wz) * s[1]; o[5] = (1 - (xx + zz)) * s[1]; o[6] = (yz + wx) * s[1]; o[7] = 0;
    o[8] = (xz + wy) * s[2]; o[9] = (yz - wx) * s[2]; o[10] = (1 - (xx + yy)) * s[2]; o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
    return o;
  }
  function mTranslate(x, y, z) { var o = mIdent(); o[12] = x; o[13] = y; o[14] = z; return o; }
  function mRotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); }
  function mRotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
  function mScale(k) { return new Float32Array([k,0,0,0, 0,k,0,0, 0,0,k,0, 0,0,0,1]); }
  function mPerspective(fovDeg, aspect, near, far) {
    var f = 1 / Math.tan(fovDeg * Math.PI / 360);
    var o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1;
    o[14] = (2 * far * near) / (near - far);
    return o;
  }
  function qSlerp(a, b, t) {
    var ax = a[0], ay = a[1], az = a[2], aw = a[3];
    var bx = b[0], by = b[1], bz = b[2], bw = b[3];
    var dot = ax * bx + ay * by + az * bz + aw * bw;
    if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }
    if (dot > 0.9995) {
      var x = ax + t * (bx - ax), y = ay + t * (by - ay), z = az + t * (bz - az), w = aw + t * (bw - aw);
      var l = Math.hypot(x, y, z, w) || 1;
      return [x / l, y / l, z / l, w / l];
    }
    var th = Math.acos(Math.min(1, dot)), s = Math.sin(th);
    var wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb, aw * wa + bw * wb];
  }

  window.emiliaOSGiftsInstall = function (handed) {
    var gl = handed.gl, glCanvas = handed.glCanvas, glIs2 = handed.glIs2;
    var camera = handed.camera, eyeHeight = handed.eyeHeight, fovVertical = handed.fovVertical;
    var innerDraw = handed.drawScene;
    if (!gl) return innerDraw;

    /* ---------- shaders ---------- */
    var VS = [
      "attribute vec3 aPos;", "attribute vec3 aNorm;", "attribute vec2 aUV;",
      "uniform mat4 uVP;", "uniform mat4 uModel;",
      "varying vec3 vN;", "varying vec2 vUV;",
      "void main() {",
      "  vN = mat3(uModel) * aNorm;",
      "  vUV = aUV;",
      "  gl_Position = uVP * uModel * vec4(aPos, 1.0);",
      "}"
    ].join("\n");
    var FS = [
      "precision mediump float;",
      "uniform vec4 uColor;", "uniform sampler2D uTex;",
      "uniform float uUseTex;", "uniform float uUnlit;",
      "varying vec3 vN;", "varying vec2 vUV;",
      "void main() {",
      "  vec4 base = uColor;",
      "  if (uUseTex > 0.5) base *= texture2D(uTex, vUV);",
      "  vec3 col = base.rgb;",
      "  if (uUnlit < 0.5) {",
      "    vec3 n = normalize(vN);",
      "    vec3 sunDir = normalize(vec3(-0.45, 0.8, 0.4));",
      "    float dif = max(dot(n, sunDir), 0.0);",
      "    float skyAmb = 0.5 + 0.5 * n.y;",
      "    vec3 light = vec3(0.40) + vec3(0.22) * skyAmb + vec3(1.05, 1.00, 0.92) * dif * 0.72;",
      "    col = base.rgb * light;",
      "  }",
      "  gl_FragColor = vec4(col, base.a);",
      "}"
    ].join("\n");
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("gifts shader:", gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.bindAttribLocation(prog, 1, "aNorm");
    gl.bindAttribLocation(prog, 2, "aUV");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("gifts program failed to link"); return innerDraw; }
    var U = {};
    ["uVP", "uModel", "uColor", "uTex", "uUseTex", "uUnlit"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    /* the page's own attribute state, captured now — while
       the page's setup is exactly as it left it — so every
       gifts draw can put it back untouched */
    var pageAttribs = [];
    for (var ai = 0; ai < 4; ai++) {
      pageAttribs.push({
        enabled: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
        size: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_SIZE),
        type: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_TYPE),
        norm: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
        stride: gl.getVertexAttrib(ai, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
        offset: gl.getVertexAttribOffset(ai, gl.VERTEX_ATTRIB_ARRAY_POINTER)
      });
    }
    var pageArrayBuf = gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    /* ---------- the model ---------- */
    var model = null;        /* parsed + GPU-ready, or null */
    var modelState = "loading"; /* loading | ready | failed */
    var form = "robot";      /* robot | animating | truck */
    var optimusMode = "standing"; /* standing | animated — the boolean: the still figure, or the transformer */
    var animT = 0, animLast = 0;

    function loadModel() {
      fetch(MODEL_URL).then(function (r) {
        if (!r.ok) throw new Error("fetch " + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        model = buildModel(buf);
        model.placement = mIdent();
        modelState = "ready";
        classifyAndPlace();
      }).catch(function (e) {
        modelState = "failed";
        console.warn("gifts: Optimus did not load (" + e.message + ") — the dresser and the photograph stand without him.");
      });
    }

    function buildModel(buf) {
      var dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a GLB");
      var jsonLen = dv.getUint32(12, true);
      var json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
      var bin = null, off = 20 + jsonLen;
      while (off < buf.byteLength) {
        var cl = dv.getUint32(off, true), ct = dv.getUint32(off + 4, true);
        if (ct === 0x004e4942) { bin = new Uint8Array(buf, off + 8, cl); break; }
        off += 8 + cl;
      }
      if (!bin) throw new Error("GLB has no binary chunk");

      var COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
      var NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
      function accRaw(idx) {
        var a = json.accessors[idx], bv = json.bufferViews[a.bufferView];
        var Ctor = COMP[a.componentType], n = NCOMP[a.type];
        var start = (bv.byteOffset || 0) + (a.byteOffset || 0);
        var stride = bv.byteStride || 0, tight = Ctor.BYTES_PER_ELEMENT * n;
        if (!stride || stride === tight) return { data: new Ctor(bin.buffer, bin.byteOffset + start, a.count * n), n: n, count: a.count, a: a };
        var out = new Ctor(a.count * n), src = new Ctor(bin.buffer, bin.byteOffset + (bv.byteOffset || 0));
        var step = stride / Ctor.BYTES_PER_ELEMENT, base = (a.byteOffset || 0) / Ctor.BYTES_PER_ELEMENT;
        for (var i = 0; i < a.count; i++) for (var k = 0; k < n; k++) out[i * n + k] = src[base + i * step + k];
        return { data: out, n: n, count: a.count, a: a };
      }
      function accFloat(idx, want) {
        var r = accRaw(idx), a = r.a, out = new Float32Array(r.count * want);
        var div = 1;
        if (a.normalized) div = a.componentType === 5120 ? 127 : a.componentType === 5121 ? 255 : a.componentType === 5122 ? 32767 : a.componentType === 5123 ? 65535 : 1;
        for (var i = 0; i < r.data.length; i++) out[i] = r.data[i] / div;
        if (a.componentType === 5120 && a.normalized) for (var j = 0; j < out.length; j++) out[j] = Math.max(-1, out[j]);
        return out;
      }

      /* textures from the embedded images */
      var texes = (json.textures || []).map(function (t) {
        var img = json.images[t.source];
        var bv = json.bufferViews[img.bufferView];
        var bytes = bin.subarray((bv.byteOffset || 0), (bv.byteOffset || 0) + bv.byteLength);
        var url = URL.createObjectURL(new Blob([bytes], { type: img.mimeType || "image/png" }));
        var rec = { tex: null };
        var im = new Image();
        im.onload = function () {
          rec.tex = makeTexture(im);
          URL.revokeObjectURL(url);
        };
        im.src = url;
        return rec;
      });
      function makeTexture(im) {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        var pot = (im.width & (im.width - 1)) === 0 && (im.height & (im.height - 1)) === 0;
        if (glIs2 || pot) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        return tex;
      }

      /* nodes: base pose, parents, meshes */
      var nodes = (json.nodes || []).map(function (n) {
        return {
          name: n.name || "",
          t: (n.translation || [0, 0, 0]).slice(), r: (n.rotation || [0, 0, 0, 1]).slice(), s: (n.scale || [1, 1, 1]).slice(),
          curT: null, curR: null, curS: null,
          mesh: typeof n.mesh === "number" ? n.mesh : -1,
          children: n.children || [], parent: -1,
          local: mIdent(), world: mIdent()
        };
      });
      nodes.forEach(function (n, i) { n.children.forEach(function (c) { nodes[c].parent = i; }); });
      var roots = ((json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].nodes) || []).slice();

      /* meshes → GPU primitives */
      var uint32ok = glIs2 || !!gl.getExtension("OES_element_index_uint");
      var meshes = (json.meshes || []).map(function (m) {
        return m.primitives.map(function (p) {
          var pos = accFloat(p.attributes.POSITION, 3);
          var nor = null;
          if (typeof p.attributes.NORMAL === "number") nor = accFloat(p.attributes.NORMAL, 3);
          var uv = typeof p.attributes.TEXCOORD_0 === "number" ? accFloat(p.attributes.TEXCOORD_0, 2) : new Float32Array((pos.length / 3) * 2);
          var idx = null, idxType = gl.UNSIGNED_SHORT;
          if (typeof p.indices === "number") {
            var ir = accRaw(p.indices);
            idx = ir.data; idxType = ir.data instanceof Uint32Array ? gl.UNSIGNED_INT : ir.data instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE;
            if (idxType === gl.UNSIGNED_INT && !uint32ok) idx = null;
          }
          if (!nor) { /* flat normals from the triangles */
            nor = new Float32Array(pos.length);
            var tri = function (ia, ib, ic) {
              var ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
              var ux = pos[ib * 3] - ax, uy = pos[ib * 3 + 1] - ay, uz = pos[ib * 3 + 2] - az;
              var vx = pos[ic * 3] - ax, vy = pos[ic * 3 + 1] - ay, vz = pos[ic * 3 + 2] - az;
              var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
              var l = Math.hypot(nx, ny, nz) || 1;
              [ia, ib, ic].forEach(function (ii) { nor[ii * 3] = nx / l; nor[ii * 3 + 1] = ny / l; nor[ii * 3 + 2] = nz / l; });
            };
            if (idx) for (var f = 0; f + 2 < idx.length; f += 3) tri(idx[f], idx[f + 1], idx[f + 2]);
            else for (var g = 0; g + 2 < pos.length / 3; g += 3) tri(g, g + 1, g + 2);
          }
          var mat = typeof p.material === "number" ? json.materials[p.material] : null;
          var pbr = (mat && mat.pbrMetallicRoughness) || {};
          var color = pbr.baseColorFactor || [1, 1, 1, 1];
          var texRec = null;
          if (pbr.baseColorTexture && typeof pbr.baseColorTexture.index === "number") texRec = texes[pbr.baseColorTexture.index];
          var prim = { count: idx ? idx.length : pos.length / 3, idxType: idxType, color: color, texRec: texRec, doubleSided: !!(mat && mat.doubleSided) };
          prim.vb = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, prim.vb);
          var packed = new Float32Array((pos.length / 3) * 8);
          for (var v = 0; v < pos.length / 3; v++) {
            packed[v * 8] = pos[v * 3]; packed[v * 8 + 1] = pos[v * 3 + 1]; packed[v * 8 + 2] = pos[v * 3 + 2];
            packed[v * 8 + 3] = nor[v * 3]; packed[v * 8 + 4] = nor[v * 3 + 1]; packed[v * 8 + 5] = nor[v * 3 + 2];
            packed[v * 8 + 6] = uv[v * 2]; packed[v * 8 + 7] = uv[v * 2 + 1];
          }
          gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
          if (idx) {
            prim.ib = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, prim.ib);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
          }
          return prim;
        });
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      /* the one animation: channels grouped by node and path */
      var anim = null;
      if (json.animations && json.animations.length) {
        var best = json.animations[0];
        anim = { duration: 0, byNode: {} };
        best.channels.forEach(function (ch) {
          var smp = best.samplers[ch.sampler];
          var times = accFloat(smp.input, 1);
          var vals = accFloat(smp.output, ch.target.path === "rotation" ? 4 : 3);
          anim.duration = Math.max(anim.duration, times[times.length - 1]);
          var rec = anim.byNode[ch.target.node] || (anim.byNode[ch.target.node] = {});
          rec[ch.target.path] = { times: times, vals: vals, interp: smp.interpolation || "LINEAR", n: ch.target.path === "rotation" ? 4 : 3 };
        });
      }
      return { json: json, nodes: nodes, roots: roots, meshes: meshes, anim: anim, placement: mIdent() };
    }

    function sampleChannel(rec, time, out) {
      var times = rec.times, vals = rec.vals, n = rec.n;
      var i = 0;
      if (time <= times[0]) { for (var k = 0; k < n; k++) out[k] = vals[k]; return out; }
      if (time >= times[times.length - 1]) { var o = (times.length - 1) * n; for (var k2 = 0; k2 < n; k2++) out[k2] = vals[o + k2]; return out; }
      while (i < times.length - 2 && times[i + 1] <= time) i++;
      var f = rec.interp === "STEP" ? 0 : (time - times[i]) / Math.max(1e-6, times[i + 1] - times[i]);
      if (n === 4) {
        var q = qSlerp(vals.subarray(i * 4, i * 4 + 4), vals.subarray((i + 1) * 4, (i + 1) * 4 + 4), f);
        for (var k3 = 0; k3 < 4; k3++) out[k3] = q[k3];
      } else {
        for (var k4 = 0; k4 < n; k4++) out[k4] = vals[i * n + k4] + f * (vals[(i + 1) * n + k4] - vals[i * n + k4]);
      }
      return out;
    }

    var _sv = [0, 0, 0, 0];
    function applyPose(time) {
      if (!model) return;
      model.nodes.forEach(function (nd) { nd.curT = nd.curR = nd.curS = null; });
      if (model.anim) {
        Object.keys(model.anim.byNode).forEach(function (ni) {
          var nd = model.nodes[+ni], rec = model.anim.byNode[ni];
          if (rec.translation) nd.curT = sampleChannel(rec.translation, time, [0, 0, 0]).slice();
          if (rec.rotation) nd.curR = sampleChannel(rec.rotation, time, [0, 0, 0, 0]).slice();
          if (rec.scale) nd.curS = sampleChannel(rec.scale, time, [0, 0, 0]).slice();
        });
      }
    }
    function updateWorld() {
      if (!model) return;
      var walk = function (i, parentM) {
        var nd = model.nodes[i];
        nd.local = mCompose(nd.curT || nd.t, nd.curR || nd.r, nd.curS || nd.s);
        nd.world = parentM ? mMul(parentM, nd.local) : nd.local;
        nd.children.forEach(function (c) { walk(c, nd.world); });
      };
      model.roots.forEach(function (r) { walk(r, null); });
    }
    function nodeBounds(nd) {
      var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      model.json.meshes[nd.mesh].primitives.forEach(function (p) {
        var a = model.json.accessors[p.attributes.POSITION];
        for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++) {
          var px = xi ? a.max[0] : a.min[0], py = yi ? a.max[1] : a.min[1], pz = zi ? a.max[2] : a.min[2];
          var m = nd.world;
          var wx = m[0] * px + m[4] * py + m[8] * pz + m[12];
          var wy = m[1] * px + m[5] * py + m[9] * pz + m[13];
          var wz = m[2] * px + m[6] * py + m[10] * pz + m[14];
          if (wx < lo[0]) lo[0] = wx; if (wy < lo[1]) lo[1] = wy; if (wz < lo[2]) lo[2] = wz;
          if (wx > hi[0]) hi[0] = wx; if (wy > hi[1]) hi[1] = wy; if (wz > hi[2]) hi[2] = wz;
        }
      });
      return { lo: lo, hi: hi };
    }
    function poseBounds(which) {
      var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      model.nodes.forEach(function (nd) {
        if (nd.mesh < 0) return;
        if (which === "still" && !nd.isStill) return;
        if (which === "anim" && nd.isStill) return;
        var b = nodeBounds(nd);
        for (var i = 0; i < 3; i++) {
          if (b.lo[i] < lo[i]) lo[i] = b.lo[i];
          if (b.hi[i] > hi[i]) hi[i] = b.hi[i];
        }
      });
      return { lo: lo, hi: hi };
    }
    function det3(m) {
      return m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    }

    /* placement: both figures are scaled by the still's
       upright height — the character's own stature in this
       file — and each is anchored on BOT_POS by its own
       bounds, grounded on the floor: the still by his
       bounds at the clip's first frame, the transformer
       per form (robot at the first frame, truck at the
       last), his placement gliding between the two as
       the clip plays */
    var anchorA = null, anchorB = null, anchorStill = null, hasStill = false, placeK = 1, placeFace = 0;
    function classifyAndPlace() {
      var dur = model.anim ? model.anim.duration : 0;
      applyPose(dur); updateWorld();
      var vis = [];
      model.nodes.forEach(function (nd) {
        if (nd.mesh < 0) return;
        if (Math.abs(det3(nd.world)) < 1e-12) return; /* scaled to nothing in this pose */
        var b = nodeBounds(nd);
        vis.push({ nd: nd, lo: b.lo, hi: b.hi, cx: (b.lo[0] + b.hi[0]) / 2 });
      });
      vis.sort(function (a, b) { return a.cx - b.cx; });
      var clusters = [];
      vis.forEach(function (v) {
        var cl = clusters[clusters.length - 1];
        if (cl && v.lo[0] - cl.hi[0] < 0.05) {
          cl.items.push(v);
          for (var i = 0; i < 3; i++) {
            if (v.lo[i] < cl.lo[i]) cl.lo[i] = v.lo[i];
            if (v.hi[i] > cl.hi[i]) cl.hi[i] = v.hi[i];
          }
        } else clusters.push({ items: [v], lo: v.lo.slice(), hi: v.hi.slice() });
      });
      var still = null;
      clusters.forEach(function (cl) {
        if (!still || (cl.hi[1] - cl.lo[1]) > (still.hi[1] - still.lo[1])) still = cl;
      });
      var stature = 0;
      if (still && clusters.length > 1) {
        still.items.forEach(function (v) { v.nd.isStill = true; });
        stature = still.hi[1] - still.lo[1];
        hasStill = true;
      }
      if (!hasStill) optimusMode = "animated"; /* no still figure in the file: nothing to choose */
      applyPose(0); updateWorld();
      var bS = poseBounds("still");
      if (hasStill) anchorStill = { cx: (bS.lo[0] + bS.hi[0]) / 2, cz: (bS.lo[2] + bS.hi[2]) / 2, lo: bS.lo[1] };
      var b0 = poseBounds("anim");
      if (!(stature > 0.01)) stature = Math.max(0.01, b0.hi[1] - b0.lo[1]);
      placeK = BOT_HEIGHT / stature;
      placeFace = Math.atan2(-BOT_POS.x, -BOT_POS.z); /* model +Z toward the origin */
      anchorA = { cx: (b0.lo[0] + b0.hi[0]) / 2, cz: (b0.lo[2] + b0.hi[2]) / 2, lo: b0.lo[1] };
      applyPose(dur); updateWorld();
      var b1 = poseBounds("anim");
      anchorB = { cx: (b1.lo[0] + b1.hi[0]) / 2, cz: (b1.lo[2] + b1.hi[2]) / 2, lo: b1.lo[1] };
      applyPose(0); updateWorld();
      setPlacement(0);
    }
    function setPlacement(p) {
      if (!anchorA || !anchorB) return;
      var a = anchorA, b = anchorB;
      if (optimusMode === "standing" && anchorStill) { a = anchorStill; b = anchorStill; }
      var cx = a.cx + (b.cx - a.cx) * p;
      var cz = a.cz + (b.cz - a.cz) * p;
      var lo = a.lo + (b.lo - a.lo) * p;
      model.placement = mMul(
        mTranslate(BOT_POS.x, 0, BOT_POS.z),
        mMul(mRotY(placeFace), mMul(mScale(placeK), mTranslate(-cx, -lo, -cz)))
      );
    }

    /* ---------- the dresser and the framed photograph ---------- */
    var furniture = [];   /* {vb, ib, count, color} */
    var photo = { tex: null, vb: null, ib: null, count: 6 };
    (function buildFurniture() {
      var groups = {};
      function group(color) { return groups[color] || (groups[color] = { pos: [], nor: [], idx: [], n: 0 }); }
      var FACES = [
        { n: [1, 0, 0], c: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
        { n: [-1, 0, 0], c: [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]] },
        { n: [0, 1, 0], c: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]] },
        { n: [0, -1, 0], c: [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]] },
        { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
        { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }
      ];
      function box(mat, cx, cy, cz, w, h, d, color) {
        var g = group(color), hx = w / 2, hy = h / 2, hz = d / 2;
        FACES.forEach(function (f) {
          var base = g.n;
          f.c.forEach(function (cn) {
            var px = cx + cn[0] * hx, py = cy + cn[1] * hy, pz = cz + cn[2] * hz;
            g.pos.push(
              mat[0] * px + mat[4] * py + mat[8] * pz + mat[12],
              mat[1] * px + mat[5] * py + mat[9] * pz + mat[13],
              mat[2] * px + mat[6] * py + mat[10] * pz + mat[14]);
            var nx = f.n[0], ny = f.n[1], nz = f.n[2];
            var tx = mat[0] * nx + mat[4] * ny + mat[8] * nz;
            var ty = mat[1] * nx + mat[5] * ny + mat[9] * nz;
            var tz = mat[2] * nx + mat[6] * ny + mat[10] * nz;
            var l = Math.hypot(tx, ty, tz) || 1;
            g.nor.push(tx / l, ty / l, tz / l);
            g.n++;
          });
          g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        });
      }
      var I = mIdent();
      var faceD = Math.atan2(-DRESSER_POS.x, -DRESSER_POS.z);
      var G = mMul(mTranslate(DRESSER_POS.x, 0, DRESSER_POS.z), mRotY(faceD));
      /* the dresser: a plinth, a body, a top slab, two drawer
         fronts with bar handles — walnut tones, dark handles */
      box(G, 0, 0.03, 0, 1.20, 0.06, 0.46, "#5d4633");
      box(G, 0, 0.43, 0, 1.30, 0.74, 0.52, "#77593f");
      box(G, 0, 0.815, 0, 1.36, 0.03, 0.56, "#86664a");
      box(G, 0, 0.615, 0.265, 1.16, 0.30, 0.02, "#86664a");
      box(G, 0, 0.255, 0.265, 1.16, 0.30, 0.02, "#86664a");
      box(G, 0, 0.615, 0.285, 0.34, 0.028, 0.025, "#2f2a26");
      box(G, 0, 0.255, 0.285, 0.34, 0.028, 0.025, "#2f2a26");
      /* the frame, leaning back a little on the dresser top,
         its easel leg behind it — hinged at the frame's back,
         foot on the dresser behind the frame, clear of the
         photograph in front */
      var F = mMul(G, mMul(mTranslate(0, 0.83, -0.04), mRotX(-0.10)));
      box(F, 0, 0.41, 0, 0.62, 0.82, 0.035, "#33302c");
      box(F, 0, 0.41, 0.0195, 0.54, 0.74, 0.004, "#efe9dc");
      box(mMul(F, mMul(mTranslate(0, 0.175, -0.115), mRotX(0.42))), 0, 0, 0, 0.30, 0.38, 0.015, "#33302c");
      Object.keys(groups).forEach(function (color) {
        var g = groups[color];
        var packed = new Float32Array(g.n * 8);
        for (var v = 0; v < g.n; v++) {
          packed[v * 8] = g.pos[v * 3]; packed[v * 8 + 1] = g.pos[v * 3 + 1]; packed[v * 8 + 2] = g.pos[v * 3 + 2];
          packed[v * 8 + 3] = g.nor[v * 3]; packed[v * 8 + 4] = g.nor[v * 3 + 1]; packed[v * 8 + 5] = g.nor[v * 3 + 2];
        }
        var vb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
        var ib = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
        var rgb = [parseInt(color.slice(1, 3), 16) / 255, parseInt(color.slice(3, 5), 16) / 255, parseInt(color.slice(5, 7), 16) / 255, 1];
        furniture.push({ vb: vb, ib: ib, count: g.idx.length, color: rgb });
      });
      /* the photograph itself: one lit-by-nothing quad in the frame */
      var pw = 0.47, ph = pw * 3088 / 2316;
      var quad = [[-pw / 2, 0.41 - ph / 2, 0.0235], [pw / 2, 0.41 - ph / 2, 0.0235], [pw / 2, 0.41 + ph / 2, 0.0235], [-pw / 2, 0.41 + ph / 2, 0.0235]];
      var pp = new Float32Array(4 * 8), uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      quad.forEach(function (q, i) {
        var px = q[0], py = q[1], pz = q[2];
        pp[i * 8] = F[0] * px + F[4] * py + F[8] * pz + F[12];
        pp[i * 8 + 1] = F[1] * px + F[5] * py + F[9] * pz + F[13];
        pp[i * 8 + 2] = F[2] * px + F[6] * py + F[10] * pz + F[14];
        var nx = F[8], ny = F[9], nz = F[10];
        pp[i * 8 + 3] = nx; pp[i * 8 + 4] = ny; pp[i * 8 + 5] = nz;
        pp[i * 8 + 6] = uvs[i][0]; pp[i * 8 + 7] = uvs[i][1];
      });
      photo.vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, photo.vb);
      gl.bufferData(gl.ARRAY_BUFFER, pp, gl.STATIC_DRAW);
      photo.ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, photo.ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      var pim = new Image();
      pim.onload = function () {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pim);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        photo.tex = tex;
      };
      pim.src = PHOTO_URL;
    })();

    /* ---------- the buttons ----------
       The boolean chooses which Optimus stands in the world
       and names him as he stands; Transform, above it, is
       the animated one's alone. */
    var btnStyle = function (bottom) {
      return [
        "position:fixed", "left:50%", "bottom:calc(" + bottom + " * var(--cell, 28px))", "transform:translateX(-50%)",
        "z-index:60", "display:none", "padding:10px 26px", "border-radius:999px",
        "border:1px solid rgba(255,255,255,0.9)", "background:rgba(24,24,24,0.5)", "color:#ffffff",
        "font-family:\"Lucida Console\",\"Lucida Sans Console\",\"Lucida Sans Typewriter\",Monaco,Consolas,monospace",
        "font-size:15px", "letter-spacing:0.14em", "text-transform:uppercase", "cursor:pointer",
        "touch-action:none", "-webkit-user-select:none", "user-select:none", "white-space:nowrap"
      ].join(";");
    };
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Transform";
    btn.style.cssText = btnStyle("5.6");
    document.body.appendChild(btn);
    var modeBtn = document.createElement("button");
    modeBtn.type = "button";
    modeBtn.textContent = "Standing Optimus";
    modeBtn.setAttribute("aria-pressed", "false");
    modeBtn.style.cssText = btnStyle("3.2");
    document.body.appendChild(modeBtn);
    function refreshBtn() {
      var show = handed.level() === "gaia" && !handed.tooling() && modelState === "ready";
      modeBtn.style.display = show && hasStill ? "" : "none";
      modeBtn.textContent = optimusMode === "standing" ? "Standing Optimus" : "Animated Optimus";
      modeBtn.setAttribute("aria-pressed", optimusMode === "animated" ? "true" : "false");
      btn.style.display = show && optimusMode === "animated" ? "" : "none";
      btn.textContent = form === "animating" ? "Transforming…" : form === "truck" ? "Reset" : "Transform";
    }
    btn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    btn.addEventListener("click", function () {
      if (modelState !== "ready" || !model) return;
      if (form === "robot" && model.anim) {
        form = "animating"; animT = 0; animLast = performance.now();
      } else if (form === "truck") {
        applyPose(0); updateWorld(); setPlacement(0); form = "robot";
      }
      refreshBtn();
    });
    modeBtn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    modeBtn.addEventListener("click", function () {
      if (modelState !== "ready" || !model) return;
      optimusMode = optimusMode === "standing" ? "animated" : "standing";
      form = "robot"; animT = 0;
      applyPose(0); updateWorld(); setPlacement(0);
      refreshBtn();
    });
    setInterval(refreshBtn, 200);

    /* ---------- the draw ---------- */
    function bindGeom(vb, ib) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
      gl.disableVertexAttribArray(3);
      if (ib) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    }
    function drawGifts() {
      innerDraw();
      if (handed.level() !== "gaia") return;
      /* snapshot the page's state — all of it we may touch */
      var prevProg = gl.getParameter(gl.CURRENT_PROGRAM);
      var prevAB = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      var prevEAB = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);
      var prevActive = gl.getParameter(gl.ACTIVE_TEXTURE);
      gl.activeTexture(gl.TEXTURE0);
      var prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
      var prevDepth = gl.isEnabled(gl.DEPTH_TEST), prevBlend = gl.isEnabled(gl.BLEND), prevCull = gl.isEnabled(gl.CULL_FACE);
      var prevMask = gl.getParameter(gl.DEPTH_WRITEMASK), prevFunc = gl.getParameter(gl.DEPTH_FUNC);

      if (form === "animating" && model) {
        var now = performance.now();
        animT += Math.max(0, (now - animLast) / 1000);
        animLast = now;
        if (animT >= model.anim.duration) { animT = model.anim.duration; form = "truck"; refreshBtn(); }
        applyPose(animT); updateWorld();
        setPlacement(model.anim.duration ? animT / model.anim.duration : 1);
      }

      var aspect = glCanvas.width / Math.max(1, glCanvas.height);
      var P = mPerspective(fovVertical, aspect, 0.1, 160);
      var cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      var cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      var fwd = [sy * cp, sp, -cy * cp], right = [cy, 0, sy];
      var up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      var eye = [camera.x, eyeHeight, camera.z];
      var V = new Float32Array([
        right[0], up[0], -fwd[0], 0,
        right[1], up[1], -fwd[1], 0,
        right[2], up[2], -fwd[2], 0,
        -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]),
        -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]),
        (fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2]), 1
      ]);
      var VP = mMul(P, V);

      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.uVP, false, VP);
      gl.uniform1i(U.uTex, 0);

      var I = mIdent();
      furniture.forEach(function (part) {
        bindGeom(part.vb, part.ib);
        gl.uniformMatrix4fv(U.uModel, false, I);
        gl.uniform4fv(U.uColor, part.color);
        gl.uniform1f(U.uUseTex, 0); gl.uniform1f(U.uUnlit, 0);
        gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_SHORT, 0);
      });
      if (photo.tex) {
        bindGeom(photo.vb, photo.ib);
        gl.uniformMatrix4fv(U.uModel, false, I);
        gl.uniform4f(U.uColor, 1, 1, 1, 1);
        gl.uniform1f(U.uUseTex, 1); gl.uniform1f(U.uUnlit, 1);
        gl.bindTexture(gl.TEXTURE_2D, photo.tex);
        gl.drawElements(gl.TRIANGLES, photo.count, gl.UNSIGNED_SHORT, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      if (model) {
        model.nodes.forEach(function (nd) {
          if (nd.mesh < 0) return;
          if (optimusMode === "standing" ? !nd.isStill : nd.isStill) return;
          var M = mMul(model.placement, nd.world);
          gl.uniformMatrix4fv(U.uModel, false, M);
          model.meshes[nd.mesh].forEach(function (prim) {
            bindGeom(prim.vb, prim.ib || null);
            gl.uniform4fv(U.uColor, prim.color);
            if (prim.texRec && prim.texRec.tex) {
              gl.uniform1f(U.uUseTex, 1);
              gl.bindTexture(gl.TEXTURE_2D, prim.texRec.tex);
            } else gl.uniform1f(U.uUseTex, 0);
            gl.uniform1f(U.uUnlit, 0);
            if (prim.ib) gl.drawElements(gl.TRIANGLES, prim.count, prim.idxType, 0);
            else gl.drawArrays(gl.TRIANGLES, 0, prim.count);
          });
        });
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      /* restore the page's state, all of it */
      gl.useProgram(prevProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, pageArrayBuf);
      for (var i = 0; i < 4; i++) {
        var pa = pageAttribs[i];
        if (pa.enabled) {
          gl.enableVertexAttribArray(i);
          gl.vertexAttribPointer(i, pa.size, pa.type, pa.norm, pa.stride, pa.offset);
        } else gl.disableVertexAttribArray(i);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, prevAB);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, prevEAB);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);
      gl.activeTexture(prevActive);
      if (prevDepth) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      if (prevBlend) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
      if (prevCull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
      gl.depthMask(prevMask);
      gl.depthFunc(prevFunc);
    }

    loadModel();
    refreshBtn();
    return drawGifts;
  };
})();

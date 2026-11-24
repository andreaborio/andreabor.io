/* The CRT pass over the finished frame, like Balatro's: the glass bulges (barrel), red and blue slip apart towards the edges, bright things bloom, soft
   scanlines, a slow roll, darker edges, a warm tint and a faint flicker. In the prototype it is a WebGL pass over the
   finished frame (the 2D canvas underneath still takes the touches).
   On the ESP32 (no GPU) it is almost free on our dots: the bulge is applied to each dot's position before it is drawn,
   the colour slip and the bloom are a tinted halo around each dot, the scanlines a static mask; the glass highlight
   is one soft sprite moved by the tilt */
'use strict';
const CRT = { on: true };
const crtCv = document.getElementById('crt');
let GL = null;
function initGL(){
  const gl = crtCv.getContext('webgl', { premultipliedAlpha: false }); if (!gl) return null;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }');
  const fs = sh(gl.FRAGMENT_SHADER, `precision mediump float;
    uniform sampler2D T; uniform vec2 R, tilt; uniform float time, dpr; varying vec2 v;
    vec3 tap(vec2 u){ return texture2D(T, u).rgb; }
    void main(){
      vec2 c0 = v * 2.0 - 1.0, o = tilt * 0.025, c = c0 - o;
      vec2 cc = c * (1.0 + 0.085 * dot(c, c)) + o;              // the bulge, its top leaning a little with the tilt
      if (length(cc) > 1.0){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec2 u = cc * 0.5 + 0.5, d = cc * 0.0032;
      vec3 col = vec3(tap(u + d).r, tap(u).g, tap(u - d).b);   // red and blue slip apart towards the edges
      vec3 b = vec3(0.0); float px = 4.0 * dpr / R.x;
      for (int i = 0; i < 8; i++){ float a = float(i) * 0.785398; b += tap(u + vec2(cos(a), sin(a)) * px); }
      col += (b / 8.0) * 0.55;                                 // bloom
      float sl = 0.9 + 0.1 * sin(u.y * R.y / (3.0 * dpr) * 6.28318);
      col *= sl;                                               // scanlines, every 3 px
      float roll = fract(time * 0.12); col += 0.03 * exp(-pow((1.0 - u.y - roll) * 9.0, 2.0));
      col *= 1.0 - 0.38 * smoothstep(0.6, 1.0, length(cc));    // darker edges
      col *= (0.985 + 0.015 * sin(time * 57.0)) * vec3(1.0, 0.99, 0.96);
      col = col * 1.14 + max(col - 0.75, 0.0) * 0.6;           // lift: whites burn to white, as on a tube
      vec2 hl = c0 - (vec2(-0.4, 0.46) - tilt * 0.4);           // the glass catches the light (top left), sliding against the tilt
      col += vec3(0.034, 0.033, 0.031) * exp(-dot(hl, hl) * 4.5);
      gl_FragColor = vec4(col, 1.0);
    }`);
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return { gl, U: { tilt: gl.getUniformLocation(pr, 'tilt'), R: gl.getUniformLocation(pr, 'R'), time: gl.getUniformLocation(pr, 'time'), dpr: gl.getUniformLocation(pr, 'dpr') } };
}
function crtGL(now){
  if (!GL) GL = initGL() || { fail: true };
  if (GL.fail){ document.body.classList.remove('crt'); return; }
  document.body.classList.add('crt');
  if (crtCv.width !== cv.width){ crtCv.width = cv.width; crtCv.height = cv.height; }
  const { gl, U } = GL; gl.viewport(0, 0, crtCv.width, crtCv.height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.uniform2f(U.R, crtCv.width, crtCv.height); gl.uniform1f(U.time, now / 1000); gl.uniform1f(U.dpr, DPR); gl.uniform2f(U.tilt, DEPTH.x, -DEPTH.y);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

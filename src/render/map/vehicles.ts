// The vehicle layer (the M2 spec, item 6; PLAN §6): one MapLibre custom layer that draws every bus
// as a code-drawn top-down glyph, instanced in one draw call. The glyph is laid out in screen pixels
// along the bus's heading, so it stays flat to the screen when the map tilts and never shrinks with
// distance: each family is its minimum long at every camera (Sparrow 20 px, Metro 40 24 px, Goliath
// 32 px), measured from the pixels drawn (I12, e2e/i12.spec.ts; V3's buses were 5 px at zoom 15). A top-down glyph has no "up" to flip, so it is never upside down
// westbound (V1). Positions come from
// the fleet (fleet.ts) each frame; the layer repaints every frame only while the clock runs and
// draws nothing new while paused (I14, RN-04).
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import { BUS_FLOATS, type BusSource } from './fleet';

export const VEHICLE_LAYER = 'vehicles';

export { MODEL_GLYPHS, SPARROW_GLYPH } from './glyphs';

const VERTEX = `#version 300 es
uniform mat4 u_matrix;
uniform vec2 u_viewport;
uniform float u_pixelRatio;
in vec2 a_corner;
in vec2 a_pos;
in float a_heading;
in vec3 a_colour;
in vec2 a_size;
out vec2 v_px;
out vec2 v_size;
out vec3 v_colour;
void main() {
  vec4 c = u_matrix * vec4(a_pos, 0.0, 1.0);
  // The heading's direction on screen: a step along it in mercator (north is -y), projected.
  float h = radians(a_heading);
  vec4 ahead = u_matrix * vec4(a_pos + vec2(sin(h), -cos(h)) * 1e-6, 0.0, 1.0);
  vec2 here = c.xy / c.w * u_viewport * 0.5;
  vec2 there = ahead.xy / ahead.w * u_viewport * 0.5;
  vec2 fwd = there - here;
  fwd = length(fwd) > 0.0 ? normalize(fwd) : vec2(0.0, 1.0);
  vec2 side = vec2(-fwd.y, fwd.x);
  // A pixel of margin all round, so the antialiased edge is never clipped by the quad.
  vec2 size = a_size * u_pixelRatio;
  vec2 px = a_corner * (size + 2.0 * u_pixelRatio);
  gl_Position = vec4((here + fwd * px.x + side * px.y) / (u_viewport * 0.5) * c.w, c.z, c.w);
  v_px = px;
  v_size = size;
  v_colour = a_colour;
}`;

// The glyph: a rounded body in the line's colour inside a dark outline, which reads against both the
// light land and the line it runs on, with a pale windscreen at the front. Drawn from distances in
// pixels, its outer edge exactly the glyph's size and the quad a pixel wider for the antialiasing.
const FRAGMENT = `#version 300 es
precision highp float;
uniform float u_pixelRatio;
in vec2 v_px;
in vec2 v_size;
in vec3 v_colour;
out vec4 colour;
float box(vec2 p, vec2 half_, float r) {
  vec2 q = abs(p) - half_ + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 half_ = v_size * 0.5;
  float outline = 1.5 * u_pixelRatio;
  // The antialiased edge is centred half a pixel outside the size, so every pixel the shape touches shows.
  float d = box(v_px, half_ + 0.5 * u_pixelRatio, 3.0 * u_pixelRatio);
  float body = box(v_px, half_ - outline, 1.5 * u_pixelRatio);
  float glass = box(v_px - vec2(half_.x - outline - 2.5 * u_pixelRatio, 0.0), vec2(1.5 * u_pixelRatio, half_.y - outline - u_pixelRatio), 0.8 * u_pixelRatio);
  vec3 c = mix(vec3(0.16, 0.15, 0.14), v_colour, smoothstep(0.5, -0.5, body));
  c = mix(c, vec3(0.88, 0.92, 0.95), smoothstep(0.5, -0.5, glass));
  colour = vec4(c, 1.0) * smoothstep(0.5, -0.5, d);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`vehicles: ${gl.getShaderInfoLog(shader) ?? 'shader failed'}`);
  return shader;
}

/** Mercator x, y (0–1) of a [lon, lat]. */
function mercator(lon: number, lat: number): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

export interface VehicleLayer extends CustomLayerInterface {
  /** Buses drawn in the last frame; the map's container carries it as data-buses for the e2e tests (TS-07: drawn, not merely sent). */
  readonly drawn: () => number;
}

export function createVehicleLayer(fleet: BusSource): VehicleLayer {
  let map: MapLibreMap | null = null;
  let program: WebGLProgram | null = null;
  let corners: WebGLBuffer | null = null;
  let instances: WebGLBuffer | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let relative = new Float32Array(0);
  let drawn = 0;
  let asked = 0;
  let still = 0;
  const where: Record<string, WebGLUniformLocation | null> = {};

  return {
    id: VEHICLE_LAYER,
    type: 'custom',
    renderingMode: '2d',
    drawn: () => drawn,
    onAdd(m, gl) {
      map = m;
      const g = gl as WebGL2RenderingContext;
      program = g.createProgram()!;
      g.attachShader(program, compile(g, g.VERTEX_SHADER, VERTEX));
      g.attachShader(program, compile(g, g.FRAGMENT_SHADER, FRAGMENT));
      g.linkProgram(program);
      if (!g.getProgramParameter(program, g.LINK_STATUS)) throw new Error(`vehicles: ${g.getProgramInfoLog(program) ?? 'link failed'}`);
      for (const name of ['u_matrix', 'u_viewport', 'u_pixelRatio']) where[name] = g.getUniformLocation(program, name);
      vao = g.createVertexArray();
      g.bindVertexArray(vao);
      corners = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, corners);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), g.STATIC_DRAW);
      const corner = g.getAttribLocation(program, 'a_corner');
      g.enableVertexAttribArray(corner);
      g.vertexAttribPointer(corner, 2, g.FLOAT, false, 0, 0);
      instances = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, instances);
      const stride = BUS_FLOATS * 4;
      for (const [name, size, offset] of [['a_pos', 2, 0], ['a_heading', 1, 2], ['a_colour', 3, 3], ['a_size', 2, 6]] as const) {
        const at = g.getAttribLocation(program, name);
        g.enableVertexAttribArray(at);
        g.vertexAttribPointer(at, size, g.FLOAT, false, stride, offset * 4);
        g.vertexAttribDivisor(at, 1);
      }
      g.bindVertexArray(null);
    },
    render(gl, options: CustomRenderMethodInput) {
      const g = gl as WebGL2RenderingContext;
      if (!map || !program || !vao) return;
      const { count, data } = fleet.frame(performance.now());
      const box = map.getContainer().dataset;
      if (count !== drawn) box.buses = String(count);
      drawn = count;
      // Paused, frames are few: the container carries where each bus is drawn and counts the frames,
      // for the e2e tests to see that nothing moves when a line changes (the M4 spec, item 4).
      if (!fleet.running) {
        const at: string[] = [];
        for (let i = 0; i < count; i++) at.push(`${data[BUS_FLOATS * i]!.toFixed(6)},${data[BUS_FLOATS * i + 1]!.toFixed(6)}`);
        box.busesAt = at.join(' ');
        box.stillFrames = String(++still);
      }
      if (count > 0) {
        // Positions relative to the camera's centre, so float32 keeps them to a fraction of a pixel at
        // any zoom; the matrix carries the centre instead, worked out in float64.
        const centre = map.getCenter();
        const [rx, ry] = mercator(centre.lng, centre.lat);
        if (relative.length < data.length) relative = new Float32Array(data.length);
        for (let i = 0; i < count; i++) {
          const at = BUS_FLOATS * i;
          const [x, y] = mercator(data[at]!, data[at + 1]!);
          relative[at] = x - rx;
          relative[at + 1] = y - ry;
          relative[at + 2] = data[at + 2]!;
          relative[at + 3] = data[at + 3]!;
          relative[at + 4] = data[at + 4]!;
          relative[at + 5] = data[at + 5]!;
          relative[at + 6] = data[at + 6]!;
          relative[at + 7] = data[at + 7]!;
        }
        const m = options.defaultProjectionData.mainMatrix as ArrayLike<number>;
        const matrix = new Float32Array(16);
        for (let i = 0; i < 16; i++) matrix[i] = m[i]!;
        for (let i = 0; i < 4; i++) matrix[12 + i] = m[i]! * rx + m[4 + i]! * ry + m[12 + i]!;
        const ratio = map.getPixelRatio();
        g.useProgram(program);
        g.uniformMatrix4fv(where.u_matrix!, false, matrix);
        g.uniform2f(where.u_viewport!, g.drawingBufferWidth, g.drawingBufferHeight);
        g.uniform1f(where.u_pixelRatio!, ratio);
        g.bindVertexArray(vao);
        g.bindBuffer(g.ARRAY_BUFFER, instances);
        g.bufferData(g.ARRAY_BUFFER, relative.subarray(0, BUS_FLOATS * count), g.DYNAMIC_DRAW);
        g.enable(g.BLEND);
        g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
        g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, count);
        g.bindVertexArray(null);
      }
      // Time runs: draw the next frame too. Paused: nothing moves, so no frame is asked for (I14); the
      // container counts the frames asked for, for the e2e tests.
      if (fleet.running) {
        map.getContainer().dataset.asked = String(++asked);
        map.triggerRepaint();
      }
    },
    onRemove(_m, gl) {
      const g = gl as WebGL2RenderingContext;
      if (program) g.deleteProgram(program);
      if (corners) g.deleteBuffer(corners);
      if (instances) g.deleteBuffer(instances);
      if (vao) g.deleteVertexArray(vao);
      map = null;
    },
  };
}

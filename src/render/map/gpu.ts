// The GPU ladder (PLAN §6 "No GPU"; the M5 spec, item 5). Since Chrome 139 a machine without a usable
// GPU gets no WebGL at all (blink-dev, PLAN §6's source), and a browser that renders in software says
// so through WebGL's "major performance caveat". Three rungs:
// - full: as built, flat and tilted;
// - low: Low graphics, 2D only, the buses drawn at most 30 times a second and at one pixel a pixel;
// - none: no map, and a calm card asking for hardware acceleration, with saves and Export intact.
// No earlier version had a ladder; V1 had only a lost-context card (`Intralines@7af45b1:src/map/MapView.tsx:124-131`).

export type GraphicsRung = 'full' | 'low' | 'none';

/** Low graphics draws the buses at most this often (PLAN §6). */
export const LOW_GRAPHICS_FPS = 30;

/**
 * Software rasterizers by the renderer name a browser reports: Chrome's SwiftShader (which some builds
 * grant WebGL2 without the caveat, as the e2e tests' Chromium does), Mesa's llvmpipe and softpipe, and
 * Windows' Microsoft Basic Render Driver.
 */
export function isSoftwareRenderer(name: string): boolean {
  return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(name);
}

/** What the probe found: WebGL2 at all, and whether only in software (a major performance caveat, or a software renderer's name). */
export interface WebGLProbe {
  readonly webgl2: boolean;
  readonly caveat: boolean;
}

/** The rung for a probe, unless `?gpu=` asked for one; without WebGL2 there is no map whatever is asked. */
export function rungFor(probe: WebGLProbe, asked: GraphicsRung | null): GraphicsRung {
  if (!probe.webgl2) return 'none';
  if (asked) return asked;
  return probe.caveat ? 'low' : 'full';
}

/** Asks a scratch canvas for WebGL2, first refusing software rendering, reads its renderer's name, and gives the contexts back. */
export function probeWebGL(): WebGLProbe {
  const tryContext = (attributes: WebGLContextAttributes): string | null => {
    const gl = document.createElement('canvas').getContext('webgl2', attributes);
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  };
  const strict = tryContext({ failIfMajorPerformanceCaveat: true });
  if (strict !== null) return { webgl2: true, caveat: isSoftwareRenderer(strict) };
  return { webgl2: tryContext({}) !== null, caveat: true };
}

/** How long to wait before asking for the next frame, so frames come at most `maxFps` a second; 0 asks now. */
export function frameDelayMs(lastAskMs: number, nowMs: number, maxFps: number | undefined): number {
  if (!maxFps) return 0;
  return Math.max(0, lastAskMs + 1_000 / maxFps - nowMs);
}

/**
 * Frames a second and the slowest twentieth's frame time over a sliding window, for the `?fps` readout. The rate is the frames
 * drawn in the window over its length, the window starting no earlier than the meter's first frame: over the time from the first
 * frame kept to the last, the two frames drawn as time ran again after a pause, or after a stall longer than the window, a few
 * milliseconds apart, read 33 to 294 a second where the buses drew 3 or 4 (the systems audit's twenty-first round), and CI's
 * Low graphics test read 47 and 147 against a cap of 31.
 */
export class FpsMeter {
  private readonly times: number[] = [];
  private first: number | null = null;
  constructor(private readonly windowMs = 2_000) {}

  frame(nowMs: number): void {
    this.first ??= nowMs;
    this.times.push(nowMs);
    while (this.times.length > 0 && this.times[0]! < nowMs - this.windowMs) this.times.shift();
  }

  /** Null until two frames fall in the window. */
  summary(nowMs: number): { fps: number; p95Ms: number } | null {
    const kept = this.times.filter((t) => t >= nowMs - this.windowMs);
    if (kept.length < 2) return null;
    const gaps = kept.slice(1).map((t, k) => t - kept[k]!).sort((a, b) => a - b);
    const start = Math.max(nowMs - this.windowMs, this.first!);
    const drawn = kept.filter((t) => t > start).length;
    return { fps: nowMs > start ? (drawn * 1_000) / (nowMs - start) : 0, p95Ms: gaps[Math.ceil(gaps.length * 0.95) - 1]! };
  }
}

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

/** Frames a second and the slowest twentieth's frame time over a sliding window, for the `?fps` readout. */
export class FpsMeter {
  private readonly times: number[] = [];
  constructor(private readonly windowMs = 2_000) {}

  frame(nowMs: number): void {
    this.times.push(nowMs);
    while (this.times.length > 0 && this.times[0]! < nowMs - this.windowMs) this.times.shift();
  }

  /** Null until two frames fall in the window. */
  summary(nowMs: number): { fps: number; p95Ms: number } | null {
    const kept = this.times.filter((t) => t >= nowMs - this.windowMs);
    if (kept.length < 2) return null;
    const gaps = kept.slice(1).map((t, k) => t - kept[k]!).sort((a, b) => a - b);
    const span = kept.at(-1)! - kept[0]!;
    return { fps: span > 0 ? ((kept.length - 1) * 1_000) / span : 0, p95Ms: gaps[Math.ceil(gaps.length * 0.95) - 1]! };
  }
}

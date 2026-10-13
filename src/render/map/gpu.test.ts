// The GPU ladder (the M5 spec, item 5): which rung a probe and `?gpu=` give, and the `?fps` meter.
// Shown failing (TS-04) with software rendering taken for hardware, and with an asked-for rung
// granted on a machine without WebGL2.
import { describe, expect, it } from 'vitest';
import { FpsMeter, frameDelayMs, isSoftwareRenderer, LOW_GRAPHICS_FPS, rungFor } from './gpu';

describe('the GPU ladder', () => {
  it('draws in full on hardware, in Low graphics in software, and not at all without WebGL2', () => {
    expect(rungFor({ webgl2: true, caveat: false }, null)).toBe('full');
    expect(rungFor({ webgl2: true, caveat: true }, null)).toBe('low');
    expect(rungFor({ webgl2: false, caveat: true }, null)).toBe('none');
  });

  it('takes the rung `?gpu=` asks for, except a map where there is no WebGL2', () => {
    expect(rungFor({ webgl2: true, caveat: true }, 'full')).toBe('full');
    expect(rungFor({ webgl2: true, caveat: false }, 'low')).toBe('low');
    expect(rungFor({ webgl2: true, caveat: false }, 'none')).toBe('none');
    expect(rungFor({ webgl2: false, caveat: true }, 'full')).toBe('none');
  });
});

describe('software renderers by name', () => {
  it('knows SwiftShader, llvmpipe and Windows’ basic driver, and not a GPU', () => {
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)')).toBe(false);
    expect(isSoftwareRenderer('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
  });
});

describe('Low graphics’ frame cap', () => {
  it('asks for the next frame no sooner than a thirtieth of a second after the last, and at once in full graphics', () => {
    expect(frameDelayMs(1_000, 1_010, LOW_GRAPHICS_FPS)).toBeCloseTo(1_000 / 30 - 10, 6);
    expect(frameDelayMs(1_000, 1_040, LOW_GRAPHICS_FPS)).toBe(0);
    expect(frameDelayMs(-Infinity, 0, LOW_GRAPHICS_FPS)).toBe(0); // the first frame
    expect(frameDelayMs(1_000, 1_001, undefined)).toBe(0);
  });
});

describe('the fps meter', () => {
  it('counts frames a second over its window and the slowest twentieth’s frame time', () => {
    const meter = new FpsMeter(2_000);
    expect(meter.summary(0)).toBeNull();
    // 30 frames a second for 3 s, one of them late by 100 ms.
    for (let k = 0; k <= 90; k++) meter.frame(k * (1_000 / 30) + (k > 80 ? 100 : 0));
    const now = 90 * (1_000 / 30) + 100;
    const s = meter.summary(now)!;
    expect(s.fps).toBeGreaterThan(26);
    expect(s.fps).toBeLessThan(31);
    expect(s.p95Ms).toBeGreaterThan(33);
    expect(meter.summary(now + 5_000)).toBeNull(); // nothing drawn lately
  });
});

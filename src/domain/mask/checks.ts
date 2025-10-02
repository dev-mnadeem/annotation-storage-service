import { AREA_EPSILON, MIN_RING_VERTICES } from '../../config/constants';
import { computeSegmentationArea, ringArea, rleCoverage, vertices } from './area';
import type { ImageFrame, Segmentation } from './types';

/** What a check is handed. Everything it needs is here — checks do no I/O and have no state. */
export interface MaskContext {
  readonly segmentation: Segmentation;
  readonly frame: ImageFrame;
  /** Area computed by the server from `segmentation`. Never the client's number. */
  readonly computedArea: number;
  /** Area the client claimed, if it sent one at all. */
  readonly declaredArea?: number;
}

export interface MaskViolation {
  readonly check: string;
  readonly code: string;
  readonly message: string;
}

/**
 * One integrity rule. Adding a rule means adding an object to `MASK_CHECKS` — no route,
 * controller or schema has to change, which is the point of keeping them in a registry.
 */
export interface MaskCheck {
  /** Stable identifier, reported back in the violation so clients can special-case a rule. */
  readonly id: string;
  /** Skip rules that do not apply to this encoding rather than making every rule defensive. */
  appliesTo(seg: Segmentation): boolean;
  /** Return `null` when the mask satisfies the rule. */
  run(ctx: MaskContext): MaskViolation | null;
}

function violation(check: MaskCheck, code: string, message: string): MaskViolation {
  return { check: check.id, code, message };
}

/** An RLE mask declares its own frame size, and it has to be the frame it is stored against. */
export const RleFrameSizeCheck: MaskCheck = {
  id: 'rle-frame-size',
  appliesTo: (seg) => seg.type === 'rle',
  run(ctx) {
    if (ctx.segmentation.type !== 'rle') return null;
    const [height, width] = ctx.segmentation.size;
    if (width === ctx.frame.width && height === ctx.frame.height) return null;
    return violation(
      this,
      'rle_size_mismatch',
      `RLE size ${height}x${width} does not match image dimensions ${ctx.frame.height}x${ctx.frame.width}`,
    );
  },
};

/**
 * A COCO run-length mask is a complete walk of the frame, so the runs must sum to exactly
 * height * width. Truncated or padded run lists decode into a shifted mask, and nothing
 * downstream would notice — the area would simply be wrong.
 */
export const RleCoverageCheck: MaskCheck = {
  id: 'rle-coverage',
  appliesTo: (seg) => seg.type === 'rle',
  run(ctx) {
    if (ctx.segmentation.type !== 'rle') return null;
    const [height, width] = ctx.segmentation.size;
    const expected = height * width;
    const actual = rleCoverage(ctx.segmentation);
    if (actual === expected) return null;
    return violation(
      this,
      'rle_counts_incomplete',
      `RLE counts sum to ${actual} pixels but the ${height}x${width} frame has ${expected}`,
    );
  },
};

/** A vertex outside the frame means the client drew against a different image, or a resized one. */
export const PolygonBoundsCheck: MaskCheck = {
  id: 'polygon-bounds',
  appliesTo: (seg) => seg.type === 'polygon',
  run(ctx) {
    if (ctx.segmentation.type !== 'polygon') return null;
    for (const [x, y] of vertices(ctx.segmentation)) {
      if (x < 0 || y < 0 || x > ctx.frame.width || y > ctx.frame.height) {
        return violation(
          this,
          'polygon_out_of_bounds',
          `vertex (${x}, ${y}) falls outside the ${ctx.frame.width}x${ctx.frame.height} image`,
        );
      }
    }
    return null;
  },
};

/** A ring with no enclosed area is a line, not a region, and contributes nothing but noise. */
export const RingShapeCheck: MaskCheck = {
  id: 'ring-shape',
  appliesTo: (seg) => seg.type === 'polygon',
  run(ctx) {
    if (ctx.segmentation.type !== 'polygon') return null;
    for (const poly of ctx.segmentation.polygons) {
      for (const ring of poly.rings) {
        if (ring.length < MIN_RING_VERTICES) {
          return violation(this, 'ring_too_short', `a ring has ${ring.length} vertices`);
        }
        if (ringArea(ring) === 0) {
          return violation(this, 'ring_degenerate', 'a ring encloses zero area');
        }
      }
    }
    return null;
  },
};

/** Holes that cancel the outline, or an empty run list, both land here. */
export const PositiveAreaCheck: MaskCheck = {
  id: 'positive-area',
  appliesTo: () => true,
  run(ctx) {
    if (ctx.computedArea > 0) return null;
    return violation(this, 'empty_mask', 'the mask encloses no pixels');
  },
};

/** A mask larger than its own image is self-overlapping or in the wrong coordinate space. */
export const AreaWithinFrameCheck: MaskCheck = {
  id: 'area-within-frame',
  appliesTo: () => true,
  run(ctx) {
    const frameArea = ctx.frame.width * ctx.frame.height;
    if (ctx.computedArea <= frameArea + AREA_EPSILON) return null;
    return violation(
      this,
      'area_exceeds_image',
      `mask area ${ctx.computedArea} exceeds the image area ${frameArea}`,
    );
  },
};

/**
 * Clients may send their own `area` so the two computations can be compared. The stored value
 * is always the server's; a disagreement means the client's geometry code and ours differ,
 * which is worth a 400 rather than a silent overwrite.
 */
export const DeclaredAreaCheck: MaskCheck = {
  id: 'declared-area',
  appliesTo: () => true,
  run(ctx) {
    if (ctx.declaredArea === undefined) return null;
    if (Math.abs(ctx.declaredArea - ctx.computedArea) <= AREA_EPSILON) return null;
    return violation(
      this,
      'area_mismatch',
      `declared area ${ctx.declaredArea} does not match the computed area ${ctx.computedArea}`,
    );
  },
};

/**
 * Ordered on purpose: structural problems are reported before derived ones, so a client that
 * sent a truncated run list is told that, not that its area looks wrong.
 */
export const MASK_CHECKS: readonly MaskCheck[] = [
  RleFrameSizeCheck,
  RleCoverageCheck,
  PolygonBoundsCheck,
  RingShapeCheck,
  PositiveAreaCheck,
  AreaWithinFrameCheck,
  DeclaredAreaCheck,
];

export interface MaskVerdict {
  readonly area: number;
  readonly violations: MaskViolation[];
}

/**
 * Runs every applicable check and returns all violations rather than the first, so a client
 * fixing a mask learns everything wrong with it in one round trip.
 */
export function inspectMask(
  segmentation: Segmentation,
  frame: ImageFrame,
  declaredArea?: number,
  registry: readonly MaskCheck[] = MASK_CHECKS,
): MaskVerdict {
  const computedArea = computeSegmentationArea(segmentation);
  const ctx: MaskContext = { segmentation, frame, computedArea, declaredArea };
  const violations: MaskViolation[] = [];
  for (const check of registry) {
    if (!check.appliesTo(segmentation)) continue;
    const result = check.run(ctx);
    if (result) violations.push(result);
  }
  return { area: computedArea, violations };
}

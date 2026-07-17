/**
 * Gloss classification for paint formulations, derived from PVC / CPVC.
 *
 * Gloss Type follows standard PVC bands: low pigment loading leaves more
 * binder at the surface (high gloss); as PVC rises the film surface gets
 * progressively duller until, past ~70%, it is fully flat.
 *
 * Expected Performance follows the PVC:CPVC ratio (Λ). Below CPVC (Λ < 1)
 * pigment is fully bound and films are strong; approaching 1 hiding improves
 * but washability drops; above CPVC (Λ > 1) there is not enough binder to
 * wet all pigment, giving porous, weak films with chalking risk.
 */

export interface GlossInfo {
  type: string;
  feel: string;
}

export const getGlossInfo = (pvcVal: number | string | undefined | null): GlossInfo => {
  const pvc = typeof pvcVal === 'string' ? parseFloat(pvcVal) : pvcVal;
  if (pvc === undefined || pvc === null || isNaN(pvc)) {
    return { type: '--', feel: '--' };
  }
  if (pvc <= 18) return { type: 'HIGH GLOSS / FULL GLOSS', feel: 'Very shiny, mirror-like' };
  if (pvc <= 25) return { type: 'GLOSS', feel: 'Shiny, smooth' };
  if (pvc <= 35) return { type: 'SEMI-GLOSS', feel: 'Medium shine' };
  if (pvc <= 45) return { type: 'SATIN / SILK', feel: 'Soft shine, smooth' };
  if (pvc <= 55) return { type: 'EGGSHELL / LOW SHEEN', feel: 'Very mild shine' };
  if (pvc <= 70) return { type: 'MATT', feel: 'Almost no shine' };
  return { type: 'FLAT / DEAD MATT', feel: 'No visible shine' };
};

export interface PerformanceInfo {
  ratio: string;
  performance: string;
}

export const getPerformanceInfo = (
  pvcVal: number | string | undefined | null,
  cpvcVal: number | string | undefined | null
): PerformanceInfo => {
  const pvc = typeof pvcVal === 'string' ? parseFloat(pvcVal) : pvcVal;
  const cpvc = typeof cpvcVal === 'string' ? parseFloat(cpvcVal) : cpvcVal;

  if (
    pvc === undefined ||
    pvc === null ||
    isNaN(pvc) ||
    cpvc === undefined ||
    cpvc === null ||
    isNaN(cpvc) ||
    cpvc === 0
  ) {
    return { ratio: '--', performance: '--' };
  }

  const ratio = pvc / cpvc;

  let performance = '';
  if (ratio < 0.2) {
    performance = '--';
  } else if (ratio <= 0.4) {
    performance = 'Very strong film, high gloss, low hiding unless pigment is strong';
  } else if (ratio <= 0.55) {
    performance = 'Good durability and cleanability';
  } else if (ratio <= 0.75) {
    performance = 'Balanced sheen and strength';
  } else if (ratio <= 0.95) {
    performance = 'Good hiding, economical, acceptable durability';
  } else if (ratio <= 1.05) {
    performance = 'High hiding, but washability starts reducing';
  } else {
    performance = 'Porous, weak film, chalking risk';
  }

  return { ratio: ratio.toFixed(2), performance };
};

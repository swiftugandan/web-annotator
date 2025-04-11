import { DRAWING_CONFIG, COLORS } from './constants.js';
import { pointLineDistance } from './geometryUtils.js';

/**
 * Draws a smooth curve through points using cardinal spline interpolation
 * with physics-based properties like pressure and velocity.
 * Moved from drawingTools.js
 */
export function drawSmoothPath(annotation, ctx) {
  const points = annotation.points;
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = annotation.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Start at the first point
  ctx.moveTo(points[0][0], points[0][1]);

  // For just two points, draw a straight line
  if (points.length === 2) {
    ctx.lineWidth = annotation.width * (annotation.pressures?.[1] || 1.0);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.stroke();
    return;
  }

  // Tension controls how tight the curve fits to points (0.0-1.0)
  const tension = DRAWING_CONFIG.TENSION;

  // Detect if we have a high-speed flick and adjust smoothing accordingly
  const hasHighVelocitySegments = annotation.velocities &&
    annotation.velocities.some(v => v > DRAWING_CONFIG.HIGH_VELOCITY_THRESHOLD);

  // Reduce control point influence for high-speed strokes
  const velocityAdjustedTension = hasHighVelocitySegments ? tension * DRAWING_CONFIG.VELOCITY_TENSION_FACTOR : tension;

  for (let i = 0; i < points.length - 1; i++) {
    // Get current point and the next point
    const current = points[i];
    const next = points[i + 1];

    // Apply pressure-sensitive line width
    const pressure = annotation.pressures?.[i] || 1.0;
    ctx.lineWidth = annotation.width * pressure;

    // Retrieve stored control points if available
    const storedCp1 = annotation.controlPoints?.[i]?.cp1;
    const storedCp2 = annotation.controlPoints?.[i]?.cp2;

    if (storedCp1 && storedCp2) {
      ctx.bezierCurveTo(storedCp1.x, storedCp1.y, storedCp2.x, storedCp2.y, next[0], next[1]);
    } else {
      // Fallback: Recalculate control points
      let cp1x, cp1y, cp2x, cp2y;
      const prev = points[i - 1];

      if (i === 0) {
          cp1x = current[0];
          cp1y = current[1];
          cp2x = (current[0] + next[0]) / 2;
          cp2y = (current[1] + next[1]) / 2;
      } else {
          const currentVelocity = annotation.velocities?.[i] || 0;
          const nextVelocity = annotation.velocities?.[i+1] || 0;
          let segmentTension = velocityAdjustedTension * (1 - Math.min(Math.max(currentVelocity, nextVelocity) / DRAWING_CONFIG.VELOCITY_TENSION_SCALE, DRAWING_CONFIG.VELOCITY_TENSION_REDUCTION_MAX));

          cp1x = current[0] + (next[0] - prev[0]) * segmentTension;
          cp1y = current[1] + (next[1] - prev[1]) * segmentTension;
          cp2x = (current[0] + next[0]) / 2;
          cp2y = (current[1] + next[1]) / 2;
      }
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next[0], next[1]);
    }

    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(next[0], next[1]);
  }
}


/**
 * Draw path with straight lines (used for simple paths or fallback).
 * Moved from drawingTools.js
 */
export function drawPathOld(annotation, ctx) {
  ctx.beginPath();
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.width;
  ctx.lineCap = 'round';

  const points = annotation.points;
  if (points.length > 0) {
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
      if (annotation.pressures && annotation.pressures[i]) {
        ctx.lineWidth = annotation.width * annotation.pressures[i];
      }
      ctx.lineTo(points[i][0], points[i][1]);
    }
  }

  ctx.stroke();
}

/**
 * Draws a path from saved annotation data, choosing between smooth and old.
 * Moved from drawingTools.js
 */
export function drawPath(annotation, ctx) {
  if (annotation.points.length > 2) {
    drawSmoothPath(annotation, ctx);
  } else {
    drawPathOld(annotation, ctx);
  }
}

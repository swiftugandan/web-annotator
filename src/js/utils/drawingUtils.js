import { DRAWING_CONFIG, COLORS, PERFECT_FREEHAND_CONFIG, PERFECT_FREEHAND_PRESETS } from './constants.js';
import { pointLineDistance } from './geometryUtils.js';
import { getStroke, getSvgPathFromStroke } from './perfectFreehand.js';

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
      const prev = points[i - 1]; // P[i-1]
      const nextNext = points[i + 2]; // P[i+2]

      // Calculate segmentTension based on velocity
      const currentVelocity = annotation.velocities?.[i] || 0;
      const nextVelocity = annotation.velocities?.[i + 1] || 0;
      // Ensure velocityAdjustedTension is available or recalculate if needed
      // (Assuming velocityAdjustedTension is defined correctly in the outer scope)
      let segmentTension = velocityAdjustedTension * (1 - Math.min(Math.max(currentVelocity, nextVelocity) / DRAWING_CONFIG.VELOCITY_TENSION_SCALE, DRAWING_CONFIG.VELOCITY_TENSION_REDUCTION_MAX));
      // Clamp tension to avoid extreme curves
      segmentTension = Math.max(0, Math.min(1, segmentTension));

      // --- Calculate CP1 ---
      if (i === 0) {
          // First segment: Use midpoint between current and next as cp1
          // Provides a smoother start compared to just using current point
          cp1x = (current[0] + next[0]) / 2;
          cp1y = (current[1] + next[1]) / 2;
      } else {
          // Standard cp1 calculation P[i] + (P[i+1] - P[i-1]) * tension
          cp1x = current[0] + (next[0] - prev[0]) * segmentTension;
          cp1y = current[1] + (next[1] - prev[1]) * segmentTension;
      }

      // --- Calculate CP2 ---
      if (i >= points.length - 2) { // Check if 'next' is the last point (no nextNext)
          // Last segment: Use midpoint between current and next as cp2
          cp2x = (current[0] + next[0]) / 2;
          cp2y = (current[1] + next[1]) / 2;
      } else {
          // Standard cp2 calculation P[i+1] - (P[i+2] - P[i]) * tension
          cp2x = next[0] - (nextNext[0] - current[0]) * segmentTension;
          cp2y = next[1] - (nextNext[1] - current[1]) * segmentTension;
      }

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next[0], next[1]);
    }

    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(next[0], next[1]);
  }
}

/**
 * Draws a path using the perfect-freehand algorithm
 * @param {Object} annotation - The annotation object containing points and properties
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 */
export function drawPerfectFreehandPath(annotation, ctx) {
  const points = annotation.points;
  if (points.length < 2) return;

  // Prepare input points with pressure
  const inputPoints = points.map((point, index) => {
    return [
      point[0], 
      point[1], 
      annotation.pressures?.[index] || 0.5
    ];
  });

  // Configure options for perfect-freehand
  const options = {
    size: annotation.width * 2, // Convert line width to diameter
    thinning: PERFECT_FREEHAND_CONFIG.THINNING,
    smoothing: PERFECT_FREEHAND_CONFIG.SMOOTHING,
    streamline: PERFECT_FREEHAND_CONFIG.STREAMLINE,
    simulatePressure: PERFECT_FREEHAND_CONFIG.SIMULATE_PRESSURE,
    easing: t => t, // Default easing function
    last: true,
    start: {
      cap: PERFECT_FREEHAND_CONFIG.START.CAP,
      taper: PERFECT_FREEHAND_CONFIG.START.TAPER,
      easing: PERFECT_FREEHAND_CONFIG.START.EASING
    },
    end: {
      cap: PERFECT_FREEHAND_CONFIG.END.CAP,
      taper: PERFECT_FREEHAND_CONFIG.END.TAPER,
      easing: PERFECT_FREEHAND_CONFIG.END.EASING
    }
  };

  // Get the stroke outline points
  const outlinePoints = getStroke(inputPoints, options);
  
  // Don't draw if we don't have enough points
  if (outlinePoints.length < 3) return;
  
  // Draw the outline as a filled path
  ctx.fillStyle = annotation.color;
  ctx.beginPath();
  
  // Move to the first point
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
  
  // Draw lines to each point
  for (let i = 1; i < outlinePoints.length; i++) {
    ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
  }
  
  // Close the path and fill
  ctx.closePath();
  ctx.fill();
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
  if (PERFECT_FREEHAND_CONFIG.USE_PERFECT_FREEHAND && annotation.points.length > 2) {
    drawPerfectFreehandPath(annotation, ctx);
  } else if (annotation.points.length > 2) {
    drawSmoothPath(annotation, ctx);
  } else {
    drawPathOld(annotation, ctx);
  }
}

/**
 * Sets the perfect-freehand configuration using a predefined preset
 * @param {string} presetName - Name of the preset to use
 * @returns {boolean} True if preset was found and applied, false otherwise
 */
export function setPerfectFreehandPreset(presetName) {
  const preset = PERFECT_FREEHAND_PRESETS[presetName];
  if (!preset) return false;
  
  // Apply the preset to the configuration
  Object.keys(preset).forEach(key => {
    if (key === 'START' || key === 'END') {
      Object.keys(preset[key]).forEach(propKey => {
        PERFECT_FREEHAND_CONFIG[key][propKey] = preset[key][propKey];
      });
    } else {
      PERFECT_FREEHAND_CONFIG[key] = preset[key];
    }
  });
  
  return true;
}

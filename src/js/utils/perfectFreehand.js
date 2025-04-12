/**
 * Implementation of the perfect-freehand algorithm
 * Based on https://github.com/steveruizok/perfect-freehand
 */

/**
 * Generate stroke points with pressure and streamline effects
 * @param {Array} points - Input points in the format [[x, y, pressure], ...] or [{x, y, pressure}, ...]
 * @param {Object} options - Options for the stroke
 * @returns {Array} Stroke points with additional properties
 */
export function getStrokePoints(inputPoints, options = {}) {
  const {
    size = 8,
    thinning = 0.5,
    smoothing = 0.5,
    streamline = 0.5,
    simulatePressure = true,
    easing = t => t,
    start = {},
    end = {},
    last = true
  } = options;

  // Format points to array format [x, y, pressure]
  const points = inputPoints.map(point => {
    if (Array.isArray(point)) {
      return [point[0], point[1], point[2] || 0.5];
    } else {
      return [point.x, point.y, point.pressure || 0.5];
    }
  });

  if (points.length === 0) return [];

  // Algorithm constants
  const streamlineAmount = streamline;
  const streamlineFactor = 1 - streamlineAmount;

  // Initialize with first point
  const strokePoints = [
    {
      point: [points[0][0], points[0][1]],
      pressure: simulatePressure ? 0.5 : points[0][2],
      vector: [0, 0],
      distance: 0,
      runningLength: 0
    }
  ];

  // We need at least two points for a stroke
  if (points.length < 2) return strokePoints;

  // Compute additional stroke points
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const point = points[i];

    // Get pressure (either from point or simulate based on velocity)
    let pressure = points[i][2];
    if (simulatePressure) {
      // Simulate pressure based on point distance (velocity)
      const distance = Math.hypot(point[0] - prevPoint[0], point[1] - prevPoint[1]);
      // Lower pressure for faster strokes
      const velocity = Math.min(distance / (1 + strokePoints[strokePoints.length - 1].distance), 1);
      pressure = 1 - Math.min(velocity, 1);
    }

    // Get last stroke point
    const last = strokePoints[strokePoints.length - 1];
    const lastPoint = last.point;

    // Apply streamlining by interpolating between the last point and the new point
    const nx = lastPoint[0] + (point[0] - lastPoint[0]) * streamlineFactor;
    const ny = lastPoint[1] + (point[1] - lastPoint[1]) * streamlineFactor;

    // Calculate vector, distance, and running length
    const vector = [nx - lastPoint[0], ny - lastPoint[1]];
    const distance = Math.hypot(vector[0], vector[1]);
    const runningLength = last.runningLength + distance;

    // Apply easing to pressure
    const easedPressure = easing(pressure);

    // Add new stroke point
    strokePoints.push({
      point: [nx, ny],
      pressure: easedPressure,
      vector,
      distance,
      runningLength
    });
  }

  // For last point, make sure we use the actual input point location (if last is true)
  if (last && points.length > 1) {
    const lastPoint = strokePoints[strokePoints.length - 1];
    const lastInputPoint = points[points.length - 1];
    lastPoint.point = [lastInputPoint[0], lastInputPoint[1]];
  }

  return strokePoints;
}

/**
 * Generate outline points for a stroke
 * @param {Array} strokePoints - Output from getStrokePoints
 * @param {Object} options - Options for generating the outline
 * @returns {Array} Outline points
 */
export function getStrokeOutlinePoints(strokePoints, options = {}) {
  const {
    size = 8,
    thinning = 0.5,
    smoothing = 0.5,
    simulatePressure = true,
    easing = t => t,
    start = {},
    end = {},
    last = true
  } = options;

  if (strokePoints.length === 0) return [];

  // Initialize variables for outline generation
  const totalLength = strokePoints[strokePoints.length - 1].runningLength;
  const taperStart = start.taper === true ? totalLength : start.taper || 0;
  const taperEnd = end.taper === true ? totalLength : end.taper || 0;

  const leftPoints = [];
  const rightPoints = [];

  // Calculate the outline points
  for (let i = 0; i < strokePoints.length; i++) {
    const { point, pressure, vector, distance, runningLength } = strokePoints[i];

    // Calculate taper effects
    let taper = 1;
    if (taperStart && runningLength < taperStart) {
      // Taper at the start
      taper = runningLength / taperStart;
      // Apply easing to the taper if provided
      if (start.easing) {
        taper = start.easing(taper);
      }
    } else if (taperEnd && totalLength - runningLength < taperEnd) {
      // Taper at the end
      taper = (totalLength - runningLength) / taperEnd;
      // Apply easing to the taper if provided
      if (end.easing) {
        taper = end.easing(taper);
      }
    }

    // Calculate the stroke width at this point
    const width = (size * (thinning ? pressure * thinning + (1 - thinning) : 1)) * taper;

    // If the width is <= 0, skip this point
    if (width <= 0) continue;

    // Calculate perpendicular vector
    let [px, py] = vector;
    if (i === 0) {
      // For the first point, use the vector to the next point
      const next = strokePoints[1]?.point || point;
      px = next[0] - point[0];
      py = next[1] - point[1];
    }

    // Normalize the perpendicular vector
    const length = Math.hypot(px, py);
    if (length === 0) continue;

    const nx = px / length;
    const ny = py / length;
    const tx = -ny; // Perpendicular x
    const ty = nx;  // Perpendicular y

    // Calculate left and right points
    const lx = point[0] + tx * width / 2;
    const ly = point[1] + ty * width / 2;
    const rx = point[0] - tx * width / 2;
    const ry = point[1] - ty * width / 2;

    leftPoints.push([lx, ly]);
    rightPoints.push([rx, ry]);
  }

  // Combine the points to form the outline
  const outlinePoints = [...leftPoints];

  // For caps, handle based on options
  if (strokePoints.length > 1) {
    // Handle end cap
    if (end.cap !== false) {
      outlinePoints.push(rightPoints[rightPoints.length - 1]);
    }

    // Reverse and add right points
    for (let i = rightPoints.length - 2; i >= 0; i--) {
      outlinePoints.push(rightPoints[i]);
    }

    // Handle start cap
    if (start.cap !== false) {
      outlinePoints.push(leftPoints[0]);
    }
  }

  // Apply smoothing to the outline points if needed
  if (smoothing > 0 && outlinePoints.length > 3) {
    return smoothOutlinePoints(outlinePoints, smoothing);
  }

  return outlinePoints;
}

/**
 * Smooth outline points using quadratic bezier interpolation
 * @param {Array} points - Outline points to smooth
 * @param {number} amount - Smoothing amount (0-1)
 * @returns {Array} Smoothed outline points
 */
function smoothOutlinePoints(points, amount) {
  if (points.length < 3) return points;

  const smoothed = [];
  const len = points.length;

  // First point
  smoothed.push([points[0][0], points[0][1]]);

  // Middle points
  for (let i = 1; i < len - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate midpoints
    const mid1x = (prev[0] + curr[0]) / 2;
    const mid1y = (prev[1] + curr[1]) / 2;
    const mid2x = (curr[0] + next[0]) / 2;
    const mid2y = (curr[1] + next[1]) / 2;

    // Calculate control point
    const cpx = curr[0] + (mid2x - mid1x) * amount;
    const cpy = curr[1] + (mid2y - mid1y) * amount;

    // Add smoothed point
    smoothed.push([cpx, cpy]);
  }

  // Last point
  smoothed.push([points[len - 1][0], points[len - 1][1]]);

  return smoothed;
}

/**
 * Main function to get a stroke from input points
 * @param {Array} points - Input points
 * @param {Object} options - Options for the stroke
 * @returns {Array} Outline points for the stroke
 */
export function getStroke(points, options = {}) {
  const strokePoints = getStrokePoints(points, options);
  return getStrokeOutlinePoints(strokePoints, options);
}

/**
 * Convert stroke points to SVG path data
 * @param {Array} points - Points returned by getStroke
 * @param {boolean} closed - Whether the path should be closed
 * @returns {string} SVG path data
 */
export function getSvgPathFromStroke(points, closed = true) {
  const len = points.length;

  if (len < 4) {
    return '';
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }

  if (closed) {
    result += 'Z';
  }

  return result;
}

/**
 * Helper function to average two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Average of a and b
 */
function average(a, b) {
  return (a + b) / 2;
}
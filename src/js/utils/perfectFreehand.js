/**
 * Implementation of the perfect-freehand algorithm
 * Based on https://github.com/steveruizok/perfect-freehand
 * Translated from TypeScript to JavaScript.
 */

// Constants
const FIXED_PI = Math.PI * 2;

// Vector utility functions
const add = (A, B) => [A[0] + B[0], A[1] + B[1]];
const sub = (A, B) => [A[0] - B[0], A[1] - B[1]];
const mul = (A, s) => [A[0] * s, A[1] * s];
const div = (A, s) => [A[0] / s, A[1] / s];
const vec = (A, B) => [B[0] - A[0], B[1] - A[1]];
const dist = (A, B) => Math.hypot(B[0] - A[0], B[1] - A[1]);
const dist2 = (A, B) => (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2;
const len = (A) => Math.hypot(A[0], A[1]);
const uni = (A) => {
  const l = len(A);
  return l === 0 ? [0, 0] : div(A, l);
};
const per = (A) => [A[1], -A[0]];
const neg = (A) => [-A[0], -A[1]];
const lrp = (a, b, t) => add(a, mul(sub(b, a), t));
const prj = (A, B, t) => {
  const L = len(B);
  if (L === 0) return [...A];
  return add(A, mul(B, t / L));
};
const rotAround = (A, C, r) => {
  const s = Math.sin(r);
  const c = Math.cos(r);
  const px = A[0] - C[0];
  const py = A[1] - C[1];
  const nx = px * c - py * s;
  const ny = px * s + py * c;
  return [nx + C[0], ny + C[1]];
};

/**
 * Get stroke points with computed pressure, vector, distance, and running length.
 * @param {Array} points - Input points in the format [[x, y, pressure], ...] or [{x, y, pressure}, ...]
 * @param {Object} options - Options for the stroke
 * @returns {Array} Stroke points with additional properties
 */
export function getStrokePoints(inputPoints, options = {}) {
  const {
    size = 16,
    thinning = 0.5,
    smoothing = 0.5,
    streamline = 0.5,
    simulatePressure = true,
    easing = (t) => t,
    start = {},
    end = {},
    last = false
  } = options;

  // Format input points to array format [[x, y, pressure], ...] or [{x, y, pressure}, ...]
  const points = inputPoints.map(point => {
    if (Array.isArray(point)) {
      return {
        point: [point[0], point[1]],
        pressure: point[2] !== undefined ? point[2] : 0.5,
      };
    } else {
      return {
        point: [point.x, point.y],
        pressure: point.pressure !== undefined ? point.pressure : 0.5,
      };
    }
  });

  if (!points.length) return [];

  // We need at least two points for a stroke
  if (points.length === 1) {
    const { point, pressure } = points[0];
    return [{ point, pressure, vector: [0, 0], distance: 0, runningLength: 0 }];
  }

  // If we're using streamline, add extra points between the first and second point
  let pts = [];
  let streamlineAmount = streamline;
  
  // Add the first point
  pts.push({
    ...points[0],
      vector: [0, 0],
      distance: 0,
      runningLength: 0
  });

  // Add each point, based on its distance from the previous point and the streamline amount
  let prev = points[0];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    
    // Calculate vector, distance and running length
    const prevPoint = prev.point;
    let currPoint = curr.point;
    
    // Apply streamlining: interpolate between the previous point and the current point
    if (streamline > 0) {
      currPoint = lrp(prevPoint, currPoint, 1 - streamlineAmount);
    }
    
    const vector = uni(vec(prevPoint, currPoint));
    const distance = dist(prevPoint, currPoint);
    
    totalLength += distance;
    
    // Apply pressure calculation
    let pressure = curr.pressure;
    
    if (simulatePressure) {
      // Simulate pressure based on the distance between the current and previous point
      // and also on the distance between the current and next point, if a next point exists
      const prevDist = distance;
      let nextDist = 0;
      
      if (i < points.length - 1) {
        nextDist = dist(curr.point, points[i + 1].point);
      }
      
      const totalDist = prevDist + nextDist;
      const normalizedDist = prevDist / Math.max(totalDist, 1);
      
      pressure = Math.max(0.1, 1 - normalizedDist);
    }
    
    // Apply easing function to pressure
    const easedPressure = easing(pressure);

    // Add the point to our points array
    pts.push({
      point: currPoint,
      pressure: easedPressure,
      vector,
      distance,
      runningLength: totalLength
    });
    
    // Set the previous point to the current point for the next iteration
    prev = { ...curr, point: currPoint };
  }

  // Handle the last option (whether the stroke is complete)
  if (last && points.length > 1) {
    const lastPt = pts[pts.length - 1];
    lastPt.point = points[points.length - 1].point;
  }

  return pts;
}

/**
 * Calculate the radius of the stroke at a given point based on pressure.
 * @param {number} pressure - Pressure at the point (0-1).
 * @param {Object} options - Options for the stroke.
 * @returns {number} The radius of the stroke.
 */
function getStrokeRadius(pressure, options = {}) {
  const {
    size = 16,
    thinning = 0.5,
    easing = (t) => t
  } = options;
  
  // Calculate the radius based on pressure and thinning
  // With no thinning (thinning = 0), the radius is constant regardless of pressure
  // With full thinning (thinning = 1), the radius is directly proportional to pressure
  if (!thinning) return size / 2;
  return size * easing(0.5 - thinning * (0.5 - pressure)) / 2;
}

/**
 * Generate outline points for a stroke
 * @param {Array} strokePoints - Output from getStrokePoints
 * @param {Object} options - Options for generating the outline
 * @returns {Array} Outline points
 */
export function getStrokeOutlinePoints(strokePoints, options = {}) {
  const {
    size = 16,
    thinning = 0.5,
    smoothing = 0.5,
    simulatePressure = true,
    easing = (t) => t,
    start = {},
    end = {},
    last = false
  } = options;

  // Extract cap and taper options with defaults
  const {
    cap: capStart = true,
    taper: taperStart = 0,
    easing: easingStart = (t) => t
  } = start;

  const {
    cap: capEnd = true,
    taper: taperEnd = 0,
    easing: easingEnd = (t) => t
  } = end;

  // If we don't have enough points, return an empty array
  if (!strokePoints.length) return [];
  
  // If we only have one point, draw a dot
  if (strokePoints.length === 1) {
    const pt = strokePoints[0];
    const radius = getStrokeRadius(pt.pressure, options);
    
    if (radius <= 0) return [];
    
    // Create a small circle centered at the point
    const circle = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = pt.point[0] + Math.cos(angle) * radius;
      const y = pt.point[1] + Math.sin(angle) * radius;
      circle.push([x, y]);
    }
    
    return circle;
  }

  // We have at least two points, compute outline
  const totalLength = strokePoints[strokePoints.length - 1].runningLength;
  
  // Compute the actual taper distances
  const taperStartEnd = taperStart === true ? totalLength : taperStart;
  const taperEndStart = taperEnd === true ? totalLength : taperEnd;
  
  // Calculate the min distance between points
  const minDistance = size * smoothing;
  
  // Arrays to hold our left and right edge points
  const leftPoints = [];
  const rightPoints = [];

  // Variables for tracking the previous points
  let pl = strokePoints[0].point;  // Previous left point
  let pr = strokePoints[0].point;  // Previous right point
  let tl = pl;                     // Current left point
  let tr = pr;                     // Current right point
  
  // Add the starting point
  if (taperStartEnd) {
    // If we're tapering the start, add the start point
    leftPoints.push(strokePoints[0].point);
    rightPoints.push(strokePoints[0].point);
  } else {
    // Calculate the perpendicular vector to the first segment
    const firstPoint = strokePoints[0];
    const nextPoint = strokePoints[1];
    const initialNormal = per(uni(vec(firstPoint.point, nextPoint.point)));
    const radius = getStrokeRadius(firstPoint.pressure, options);
    
    // Add the left and right starting points
    leftPoints.push(sub(firstPoint.point, mul(initialNormal, radius)));
    rightPoints.push(add(firstPoint.point, mul(initialNormal, radius)));
  }
  
  // Process middle points
  for (let i = 1; i < strokePoints.length - 1; i++) {
    const { point, pressure, vector, runningLength } = strokePoints[i];
    const nextVector = strokePoints[i + 1].vector;
    
    // Calculate the radius of the stroke at this point
    let radius = getStrokeRadius(pressure, options);
    
    // Apply tapering if needed
    if (taperStartEnd > 0 && runningLength < taperStartEnd) {
      // Taper at the start
      const taperAmount = runningLength / taperStartEnd;
      radius *= easingStart(taperAmount);
    } else if (taperEndStart > 0 && totalLength - runningLength < taperEndStart) {
      // Taper at the end
      const taperAmount = (totalLength - runningLength) / taperEndStart;
      radius *= easingEnd(taperAmount);
    }
    
    // Skip if the radius is too small
    if (radius <= 0) continue;
    
    // Calculate the normal with smoothing between current and next segment
    // We'll create a smooth transition between the normal of the current segment 
    // and the normal of the next segment
    const nextNormal = per(nextVector); 
    const prevNormal = per(vector);
    const avgNormal = uni(add(prevNormal, nextNormal));
    
    // Calculate left and right points at this position
    tl = sub(point, mul(avgNormal, radius));
    tr = add(point, mul(avgNormal, radius));
    
    // Add points if they're far enough apart from previous ones
    if (dist2(pl, tl) > minDistance) {
      leftPoints.push(tl);
      pl = tl;
    }
    
    if (dist2(pr, tr) > minDistance) {
      rightPoints.push(tr);
      pr = tr;
    }
  }
  
  // Add the endpoint
  const lastPoint = strokePoints[strokePoints.length - 1];
  let lastRadius = getStrokeRadius(lastPoint.pressure, options);
  
  // Apply any end taper
  if (taperEndStart > 0) {
    if (totalLength < taperEndStart) {
      lastRadius *= easingEnd(totalLength / taperEndStart);
    } else if (totalLength - lastPoint.runningLength < taperEndStart) {
      const taperAmount = (totalLength - lastPoint.runningLength) / taperEndStart;
      lastRadius *= easingEnd(taperAmount);
    }
  }
  
  if (taperEndStart) {
    // If tapering the end, add the end point
    leftPoints.push(lastPoint.point);
    rightPoints.push(lastPoint.point);
  } else {
    // Add the left and right end points
    const finalNormal = per(lastPoint.vector);
    leftPoints.push(sub(lastPoint.point, mul(finalNormal, lastRadius)));
    rightPoints.push(add(lastPoint.point, mul(finalNormal, lastRadius)));
  }
  
  // Create caps
  const startCap = [];
  const endCap = [];
  
  // Only create caps if we're not tapering
  if (capStart && taperStartEnd === 0) {
    // Create the start cap
    const firstPoint = strokePoints[0].point;
    const startNormal = per(neg(strokePoints[1].vector));
    const startRadius = getStrokeRadius(strokePoints[0].pressure, options);
    
    // For rounded cap, add curved points
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const angle = Math.PI * (1 - t);
      startCap.push(rotAround(add(firstPoint, mul(startNormal, startRadius)), firstPoint, angle));
    }
  }
  
  if (capEnd && taperEndStart === 0) {
    // Create the end cap
    const lastNormal = per(lastPoint.vector);
    const endRadius = lastRadius;
    
    // For rounded cap, add curved points
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const angle = Math.PI * t;
      endCap.push(rotAround(add(lastPoint.point, mul(lastNormal, endRadius)), lastPoint.point, angle));
    }
  }
  
  // Combine all the points to create the outline
  // Start with all left side points
  const outlinePoints = [...leftPoints];
  
  // Add end cap points if any
  if (endCap.length) {
    outlinePoints.push(...endCap);
  }
  
  // Add right side points in reverse order
  outlinePoints.push(...rightPoints.reverse());
  
  // Add start cap points if any
  if (startCap.length) {
    outlinePoints.push(...startCap);
  }

  return outlinePoints;
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

  if (len < 2) {
    return '';
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} `;

  // If only 2-3 points, draw a simple curve
  if (len < 4) {
    if (len === 2) {
      result += `L${b[0].toFixed(2)},${b[1].toFixed(2)}`;
    } else {
      result += `Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${c[0].toFixed(2)},${c[1].toFixed(2)}`;
    }
  } else {
    // For more points, use quadratic bezier for smooth curves 
    result += `Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} `;

    // Add remaining points with T (smooth quadratic) commands
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
      result += `T${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
    }
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
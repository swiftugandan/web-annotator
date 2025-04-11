/**
 * Calculates the minimum distance from a point (px, py) to a line segment (x1, y1) - (x2, y2).
 * Moved from drawingTools.js
 */
export function pointLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Rotates a point around a center point by a given angle.
 * Moved from drawingTools.js
 *
 * @param {object} point - The point to rotate {x, y}.
 * @param {object} center - The center of rotation {x, y}.
 * @param {number} angle - The rotation angle in radians.
 * @returns {object} The new rotated point {x, y}.
 */
export function rotatePoint(point, center, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Standard rotation formula:
    // x' = cx + (x - cx) * cos - (y - cy) * sin
    // y' = cy + (x - cx) * sin + (y - cy) * cos
    const nx = center.x + (cos * (point.x - center.x)) - (sin * (point.y - center.y));
    const ny = center.y + (sin * (point.x - center.x)) + (cos * (point.y - center.y));
    return { x: nx, y: ny };
}

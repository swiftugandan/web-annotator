import { ERASER_CONFIG, COLORS } from '../utils/constants.js';
import { pointLineDistance } from '../utils/geometryUtils.js';

/**
 * Handles eraser logic.
 */
export class EraserTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx; // Need context
        this.redrawAll = controller.redrawAll.bind(controller); // Need redraw function
    }

    start(e) {
        this.state.isDrawing = true; // Use isDrawing state for eraser as well
        [this.state.lastX, this.state.lastY] = [e.clientX, e.clientY];
        // No initial annotation needed for eraser
    }

    draw(e) {
        if (!this.state.isDrawing) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const ctx = this.ctx;

        // --- Temporary Eraser Visualization --- (From original draw function)
        ctx.save();
        // Draw semi-transparent stroke first for visualization
        ctx.beginPath();
        ctx.moveTo(this.state.lastX, this.state.lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = COLORS.ERASER_VISUALIZATION; 
        ctx.lineWidth = this.state.eraserWidth || 20;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Apply destination-out to actually "erase" visually on the current frame
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(this.state.lastX, this.state.lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = COLORS.ERASER_EFFECT; // Fully opaque black for erasing
        ctx.lineWidth = this.state.eraserWidth || 20;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; // Reset composite mode
        ctx.restore();
        // --- End Visualization ---

        // Perform actual erasure logic on annotation data
        if (this._eraseIntersectingPaths(currentX, currentY)) {
            // If annotations were modified, trigger a full redraw
            this.redrawAll();
        }

        [this.state.lastX, this.state.lastY] = [currentX, currentY];
    }

    stop() {
        this.state.isDrawing = false;
        // Final redraw might be necessary if erasure happened on mouseup
        this.redrawAll(); 
    }

    /**
     * Erases parts of drawing paths that intersect with the current eraser stroke.
     * Modifies the annotations array directly.
     * Returns true if any annotation was modified, false otherwise.
     */
    _eraseIntersectingPaths(currentX, currentY) {
        const eraserRadius = (this.state.eraserWidth || 20) / 2; // Use radius for checks
        let needsRedraw = false;
        const eraserStartX = this.state.lastX;
        const eraserStartY = this.state.lastY;
        const shapeTool = this.controller.shapeTool; // Get shape tool instance for hit detection

        // Iterate backwards to allow safe removal/modification
        for (let i = this.state.annotations.length - 1; i >= 0; i--) {
            const annotation = this.state.annotations[i];

            if (annotation.type === 'draw') {
                const points = annotation.points;
                const originalLength = points.length;
                const newSegmentsPoints = []; // Array to hold points of new segments
                let currentSegmentPoints = [];
                let segmentErased = false;

                for (let j = 0; j < points.length; j++) {
                    const point = points[j];

                    if (j > 0) {
                        const prevPoint = points[j - 1];
                        const isSegmentErased = this._isSegmentIntersectingEraser(
                            prevPoint[0], prevPoint[1],
                            point[0], point[1],
                            eraserStartX, eraserStartY,
                            currentX, currentY,
                            eraserRadius
                        );

                        if (isSegmentErased) {
                            segmentErased = true;
                            needsRedraw = true;

                            // If current segment has points, save it
                            if (currentSegmentPoints.length > 1) {
                                newSegmentsPoints.push([...currentSegmentPoints]);
                            }
                            // Start a new segment (don't include the start point of the erased segment)
                            currentSegmentPoints = [];
                        } else {
                            // Add the start point if it wasn't added yet
                            if (currentSegmentPoints.length === 0) {
                                currentSegmentPoints.push(prevPoint);
                            }
                            // Add the end point of the non-erased segment
                            currentSegmentPoints.push(point);
                        }
                    } else {
                         // Always add the very first point to the initial segment
                         currentSegmentPoints.push(point);
                    }
                }

                // Add the last segment if it has enough points
                if (currentSegmentPoints.length > 1) {
                    newSegmentsPoints.push(currentSegmentPoints);
                }

                if (segmentErased) {
                    // Remove the original annotation
                    this.state.annotations.splice(i, 1);

                    // Add new annotations for each remaining segment
                    for (const segmentPoints of newSegmentsPoints) {
                        if (segmentPoints.length >= 2) {
                            // TODO: Properly handle pressures, velocities, timestamps, control points for split segments
                            // This is complex. For now, create simplified new annotations.
                             this.state.annotations.push({
                                ...annotation, // Copy basic properties like color, width
                                points: segmentPoints,
                                // Reset or recalculate physics/control points - simplified for now
                                pressures: segmentPoints.map(() => 1.0),
                                velocities: segmentPoints.map(() => 0),
                                timestamps: segmentPoints.map(() => Date.now()),
                                controlPoints: []
                            });
                        }
                    }
                    // Adjust selectedShapeIndex if necessary (though unlikely needed here)
                     if (this.state.selectedShapeIndex > i) {
                           this.state.selectedShapeIndex--;
                     }
                }
            } else if (annotation.type === 'shape' && shapeTool) {
                // --- Add Shape Erasure Logic --- 
                let shapeErased = false;
                const steps = ERASER_CONFIG.SAMPLE_STEPS; // Number of points to check along eraser segment

                // Check multiple points along the eraser's path for intersection
                for (let j = 0; j <= steps; j++) {
                    const t = j / steps;
                    const checkX = eraserStartX + t * (currentX - eraserStartX);
                    const checkY = eraserStartY + t * (currentY - eraserStartY);

                    // Use ShapeTool's hit detection. Assumes shapeTool has access to the same context.
                    if (shapeTool._isPointInsideShape(checkX, checkY, annotation)) {
                        // If any point on the eraser path intersects the shape, delete the whole shape
                        this.state.annotations.splice(i, 1);
                        needsRedraw = true;
                        shapeErased = true;

                        // If the currently selected shape is the one being erased, deselect it.
                        if (this.state.selectedShapeIndex === i) {
                           this.controller.deselectShape();
                        } 
                        // If a shape *before* the selected one is erased, adjust the index.
                        else if (this.state.selectedShapeIndex > i) {
                           this.state.selectedShapeIndex--;
                        }
                        break; // Stop checking points for this shape once erased
                    }
                }
                 // --- End Shape Erasure Logic ---
            }
            // TODO: Add erasure logic for text if desired
        }

        return needsRedraw;
    }

    /**
     * Checks if a line segment intersects with the eraser stroke (approximated as a line).
     */
    _isSegmentIntersectingEraser(x1, y1, x2, y2, eraserX1, eraserY1, eraserX2, eraserY2, eraserRadius) {
        // Check distance from segment endpoints to eraser line
        if (pointLineDistance(x1, y1, eraserX1, eraserY1, eraserX2, eraserY2) < eraserRadius ||
            pointLineDistance(x2, y2, eraserX1, eraserY1, eraserX2, eraserY2) < eraserRadius) {
            return true;
        }

        // Check distance from eraser endpoints to segment line
        if (pointLineDistance(eraserX1, eraserY1, x1, y1, x2, y2) < eraserRadius ||
            pointLineDistance(eraserX2, eraserY2, x1, y1, x2, y2) < eraserRadius) {
            return true;
        }

        // More robust check: Sample points along the segment
        const steps = ERASER_CONFIG.SAMPLE_STEPS;
        for (let i = 1; i < steps; i++) { // Start from 1, end before steps to avoid endpoints
            const t = i / steps;
            const x = x1 + t * (x2 - x1);
            const y = y1 + t * (y2 - y1);
            if (pointLineDistance(x, y, eraserX1, eraserY1, eraserX2, eraserY2) < eraserRadius) {
                return true;
            }
        }

        return false;
    }
}

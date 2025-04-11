import { ERASER_CONFIG, COLORS } from '../utils/constants.js';
import { pointLineDistance } from '../utils/geometryUtils.js';

/**
 * Handles eraser tool functionality for removing annotations from the canvas.
 */
export class EraserTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx;
        this.redrawAll = controller.redrawAll.bind(controller);
    }

    start(e) {
        this.state.isDrawing = true;
        [this.state.lastX, this.state.lastY] = [e.clientX, e.clientY];
    }

    draw(e) {
        if (!this.state.isDrawing) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        
        this._visualizeEraserStroke(currentX, currentY);
        
        if (this._eraseIntersectingPaths(currentX, currentY)) {
            this.redrawAll();
        }

        [this.state.lastX, this.state.lastY] = [currentX, currentY];
    }

    stop() {
        this.state.isDrawing = false;
        this.redrawAll();
    }

    /**
     * Visualizes the eraser stroke on the canvas
     */
    _visualizeEraserStroke(currentX, currentY) {
        const ctx = this.ctx;
        const eraserWidth = this.state.eraserWidth || 20;
        
        ctx.save();
        
        // Draw semi-transparent stroke for visualization
        ctx.beginPath();
        ctx.moveTo(this.state.lastX, this.state.lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = COLORS.ERASER_VISUALIZATION;
        ctx.lineWidth = eraserWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Apply actual erasure effect visually
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(this.state.lastX, this.state.lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = COLORS.ERASER_EFFECT;
        ctx.lineWidth = eraserWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.restore();
    }

    /**
     * Erases parts of drawing paths that intersect with the eraser stroke.
     * @returns {boolean} True if any annotation was modified
     */
    _eraseIntersectingPaths(currentX, currentY) {
        const eraserRadius = (this.state.eraserWidth || 20) / 2;
        let needsRedraw = false;
        const eraserStartX = this.state.lastX;
        const eraserStartY = this.state.lastY;
        const shapeTool = this.controller.shapeTool;

        // Iterate backwards to allow safe removal/modification
        for (let i = this.state.annotations.length - 1; i >= 0; i--) {
            const annotation = this.state.annotations[i];

            if (annotation.type === 'draw') {
                if (this._eraseFreehandDrawing(annotation, i, eraserStartX, eraserStartY, currentX, currentY, eraserRadius)) {
                    needsRedraw = true;
                }
            } else if (annotation.type === 'shape' && shapeTool) {
                if (this._eraseShape(annotation, i, eraserStartX, eraserStartY, currentX, currentY)) {
                    needsRedraw = true;
                }
            }
            // Add support for other annotation types here if needed
        }

        return needsRedraw;
    }

    /**
     * Erases parts of a freehand drawing annotation
     * @returns {boolean} True if the annotation was modified
     */
    _eraseFreehandDrawing(annotation, index, eraserStartX, eraserStartY, currentX, currentY, eraserRadius) {
        const points = annotation.points;
        const newSegmentsPoints = [];
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

                    // Save current segment if it has multiple points
                    if (currentSegmentPoints.length > 1) {
                        newSegmentsPoints.push([...currentSegmentPoints]);
                    }
                    // Start a new segment
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
            this.state.annotations.splice(index, 1);

            // Add new annotations for each remaining segment
            this._createNewSegmentAnnotations(annotation, newSegmentsPoints);
            
            // Adjust selectedShapeIndex if necessary
            this._adjustSelectionIndexAfterErasure(index);
            
            return true;
        }
        
        return false;
    }

    /**
     * Creates new annotation segments from erased segments
     */
    _createNewSegmentAnnotations(originalAnnotation, segmentsPoints) {
        for (const segmentPoints of segmentsPoints) {
            if (segmentPoints.length >= 2) {
                const newAnnotation = {
                    ...originalAnnotation,
                    points: segmentPoints,
                    pressures: segmentPoints.map(() => 1.0),
                    velocities: segmentPoints.map(() => 0),
                    timestamps: segmentPoints.map(() => Date.now()),
                    controlPoints: []
                };
                this.state.annotations.push(newAnnotation);
            }
        }
    }

    /**
     * Erases a shape annotation if it intersects with the eraser
     * @returns {boolean} True if the shape was erased
     */
    _eraseShape(annotation, index, eraserStartX, eraserStartY, currentX, currentY) {
        const shapeTool = this.controller.shapeTool;
        const steps = ERASER_CONFIG.SAMPLE_STEPS;

        // Check multiple points along the eraser's path for intersection
        for (let j = 0; j <= steps; j++) {
            const t = j / steps;
            const checkX = eraserStartX + t * (currentX - eraserStartX);
            const checkY = eraserStartY + t * (currentY - eraserStartY);

            if (shapeTool._isPointInsideShape(checkX, checkY, annotation)) {
                this.state.annotations.splice(index, 1);
                
                if (this.state.selectedShapeIndex === index) {
                    this.controller.deselectShape();
                } else if (this.state.selectedShapeIndex > index) {
                    this.state.selectedShapeIndex--;
                }
                
                return true;
            }
        }
        
        return false;
    }

    /**
     * Adjusts the selected shape index after an annotation is erased
     */
    _adjustSelectionIndexAfterErasure(erasedIndex) {
        if (this.state.selectedShapeIndex > erasedIndex) {
            this.state.selectedShapeIndex--;
        }
    }

    /**
     * Checks if a line segment intersects with the eraser stroke
     * @returns {boolean} True if the segment intersects with the eraser
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

        // Sample points along the segment for more robust detection
        const steps = ERASER_CONFIG.SAMPLE_STEPS;
        for (let i = 1; i < steps; i++) {
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

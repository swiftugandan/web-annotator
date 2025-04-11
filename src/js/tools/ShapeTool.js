import { SHAPE_TYPES, SHAPE_HANDLES, COLORS } from '../utils/constants.js';
import { rotatePoint, pointLineDistance } from '../utils/geometryUtils.js';

/**
 * Handles shape drawing, selection, resizing, and rotation logic.
 */
export class ShapeTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx;
        this.redrawAll = controller.redrawAll.bind(controller);
    }

    //--- Shape Creation ---

    start(e) {
        this.state.isDrawingShape = true;
        this.state.shapeStartX = e.clientX;
        this.state.shapeStartY = e.clientY;

        this.state.annotations.push({
            type: 'shape',
            shapeType: this.state.currentShapeType || SHAPE_TYPES.RECTANGLE,
            color: this.state.drawColor,
            width: this.state.drawWidth,
            rotation: 0,
            startX: this.state.shapeStartX,
            startY: this.state.shapeStartY,
            endX: this.state.shapeStartX,
            endY: this.state.shapeStartY
        });
    }

    update(e) {
        if (!this.state.isDrawingShape) return;

        const currentShape = this.state.annotations[this.state.annotations.length - 1];
        currentShape.endX = e.clientX;
        currentShape.endY = e.clientY;

        this.redrawAll();
    }

    stop(e) {
        if (!this.state.isDrawingShape) return;
        this.state.isDrawingShape = false;

        this.state.selectedShapeIndex = this.state.annotations.length - 1;
        this.state.interactionMode = 'none';
        this.redrawAll();
        this.controller.canvasManager.updateCursor(e.clientX, e.clientY);
    }

    //--- Shape Interaction ---

    startInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;

        // Check for handle interaction on selected shape
        if (this.state.selectedShapeIndex !== null) {
            const selectedShape = this.state.annotations[this.state.selectedShapeIndex];
            const handle = this.getInteractionHandleAtPoint(mouseX, mouseY, selectedShape);
            if (handle) {
                this.state.activeHandle = handle;
                if (handle === 'rotate') {
                    this.state.interactionMode = 'rotating';
                    this.state.shapeCenter = this._getShapeCenter(selectedShape);
                } else {
                    this.state.interactionMode = 'resizing';
                }
                return true;
            }
        }

        // Check for click on any shape (select/move)
        const clickedShapeIndex = this.getShapeAtPoint(mouseX, mouseY);
        if (clickedShapeIndex !== null) {
            this.state.selectedShapeIndex = clickedShapeIndex;
            this.state.interactionMode = 'moving';
            this.redrawAll();
            return true;
        }

        // Clicked on empty space - deselect and start drawing new shape
        this.state.selectedShapeIndex = null;
        this.state.interactionMode = 'none';
        this.start(e);
        this.redrawAll();
        return false;
    }

    handleMoveInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        if (this.state.interactionMode === 'moving' && this.state.selectedShapeIndex !== null) {
            this._moveShape(mouseX, mouseY);
        } else if (this.state.interactionMode === 'resizing' && this.state.selectedShapeIndex !== null) {
            this._resizeShape(mouseX, mouseY);
        } else if (this.state.interactionMode === 'rotating' && this.state.selectedShapeIndex !== null) {
            this._rotateShape(mouseX, mouseY);
        } else if (this.state.isDrawingShape) {
            this.update(e);
        } else {
            this.controller.canvasManager.updateCursor(mouseX, mouseY);
        }

        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;
    }

    stopInteraction(e) {
        if (['moving', 'resizing', 'rotating'].includes(this.state.interactionMode)) {
            if (this.state.selectedShapeIndex !== null) {
                 const shape = this.state.annotations[this.state.selectedShapeIndex];
                 this._normalizeShape(shape);
                 this.redrawAll();
             }
            this.state.interactionMode = 'none';
            this.state.activeHandle = null;
            this.controller.canvasManager.updateCursor(e.clientX, e.clientY);
        } else if (this.state.isDrawingShape) {
            this.stop(e);
        }
    }

    _moveShape(mouseX, mouseY) {
        const shape = this.state.annotations[this.state.selectedShapeIndex];
        const dx = mouseX - this.state.dragStartX;
        const dy = mouseY - this.state.dragStartY;

        shape.startX += dx;
        shape.startY += dy;
        shape.endX += dx;
        shape.endY += dy;
        this.redrawAll();
    }

    _resizeShape(mouseX, mouseY) {
        const shape = this.state.annotations[this.state.selectedShapeIndex];
        const handle = this.state.activeHandle;
        const directDx = mouseX - this.state.dragStartX;
        const directDy = mouseY - this.state.dragStartY;

        if (shape.shapeType === SHAPE_TYPES.LINE || shape.shapeType === SHAPE_TYPES.ARROW) {
            // For lines/arrows, directly move the start or end point based on handle
            switch (handle) {
                // Handles associated with the start point
                case 'tl':
                case 't':
                case 'l':
                case 'bl':
                    shape.startX += directDx;
                    shape.startY += directDy;
                    break;
                // Handles associated with the end point
                case 'tr':
                case 'br':
                case 'b':
                case 'r':
                    shape.endX += directDx;
                    shape.endY += directDy;
                    break;
            }
        } else {
            const center = this._getShapeCenter(shape);
            const rotation = shape.rotation || 0;
            const lastUnrotated = rotatePoint({ x: this.state.dragStartX, y: this.state.dragStartY }, center, -rotation);
            const currentUnrotated = rotatePoint({ x: mouseX, y: mouseY }, center, -rotation);
            const dx = currentUnrotated.x - lastUnrotated.x;
            const dy = currentUnrotated.y - lastUnrotated.y;

            // Normalize start/end for calculations
            let x1 = Math.min(shape.startX, shape.endX);
            let y1 = Math.min(shape.startY, shape.endY);
            let x2 = Math.max(shape.startX, shape.endX);
            let y2 = Math.max(shape.startY, shape.endY);

            // Apply resizing based on handle (using unrotated coordinates)
            switch (handle) {
                case 'tl': x1 += dx; y1 += dy; break;
                case 'tr': x2 += dx; y1 += dy; break;
                case 'bl': x1 += dx; y2 += dy; break;
                case 'br': x2 += dx; y2 += dy; break;
                case 't':  y1 += dy; break;
                case 'b':  y2 += dy; break;
                case 'l':  x1 += dx; break;
                case 'r':  x2 += dx; break;
            }

            // Update shape properties
            shape.startX = x1;
            shape.startY = y1;
            shape.endX = x2;
            shape.endY = y2;
        }

        this.redrawAll();
    }

    _rotateShape(mouseX, mouseY) {
        const shape = this.state.annotations[this.state.selectedShapeIndex];
        const center = this.state.shapeCenter;

        const prevAngle = Math.atan2(this.state.dragStartY - center.y, this.state.dragStartX - center.x);
        const currentAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
        const deltaAngle = currentAngle - prevAngle;

        shape.rotation = (shape.rotation || 0) + deltaAngle;
        this.redrawAll();
    }

    _normalizeShape(shape) {
        if (!shape.rotation && (shape.shapeType === SHAPE_TYPES.RECTANGLE || shape.shapeType === SHAPE_TYPES.CIRCLE)) {
            const x1 = Math.min(shape.startX, shape.endX);
            const y1 = Math.min(shape.startY, shape.endY);
            const x2 = Math.max(shape.startX, shape.endX);
            const y2 = Math.max(shape.startY, shape.endY);
            shape.startX = x1;
            shape.startY = y1;
            shape.endX = x2;
            shape.endY = y2;
        }
    }

    //--- Hit Detection ---

    getShapeAtPoint(x, y) {
        for (let i = this.state.annotations.length - 1; i >= 0; i--) {
            const annotation = this.state.annotations[i];
            if (annotation.type !== 'shape') continue;

            if (this._isPointInsideShape(x, y, annotation)) {
                return i;
            }
        }
        return null;
    }

    getInteractionHandleAtPoint(x, y, annotation) {
        if (!annotation || annotation.type !== 'shape') return null;

        const handlePositions = this._getHandlePositions(annotation);
        const rotationTouchRadius = SHAPE_HANDLES.ROTATION_RADIUS + SHAPE_HANDLES.HIT_TOLERANCE;
        const resizeTouchRadius = (SHAPE_HANDLES.SIZE / 2) + SHAPE_HANDLES.HIT_TOLERANCE;

        for (const key in handlePositions) {
            const pos = handlePositions[key];
            const touchRadius = (key === 'rotate') ? rotationTouchRadius : resizeTouchRadius;

            if (Math.abs(x - pos.x) <= touchRadius && Math.abs(y - pos.y) <= touchRadius) {
                return key;
            }
        }
        return null;
    }

    _isPointInsideShape(x, y, annotation) {
        const ctx = this.ctx;
        const center = this._getShapeCenter(annotation);
        const rotation = annotation.rotation || 0;
        const unrotatedPoint = rotatePoint({ x, y }, center, -rotation);

        ctx.beginPath();
        const minX = Math.min(annotation.startX, annotation.endX);
        const minY = Math.min(annotation.startY, annotation.endY);
        const maxX = Math.max(annotation.startX, annotation.endX);
        const maxY = Math.max(annotation.startY, annotation.endY);
        const width = maxX - minX;
        const height = maxY - minY;

        let hit = false;

        switch (annotation.shapeType) {
            case SHAPE_TYPES.RECTANGLE:
                ctx.rect(minX, minY, width, height);
                hit = ctx.isPointInPath(unrotatedPoint.x, unrotatedPoint.y) || ctx.isPointInStroke(unrotatedPoint.x, unrotatedPoint.y);
                break;
            case SHAPE_TYPES.CIRCLE:
                const radius = Math.max(width, height) / 2;
                const circleCenterX = minX + width / 2;
                const circleCenterY = minY + height / 2;
                ctx.ellipse(circleCenterX, circleCenterY, radius, radius, 0, 0, 2 * Math.PI);
                hit = ctx.isPointInPath(unrotatedPoint.x, unrotatedPoint.y) || ctx.isPointInStroke(unrotatedPoint.x, unrotatedPoint.y);
                break;
            case SHAPE_TYPES.LINE:
            case SHAPE_TYPES.ARROW:
                const dist = pointLineDistance(unrotatedPoint.x, unrotatedPoint.y, annotation.startX, annotation.startY, annotation.endX, annotation.endY);
                const tolerance = (annotation.width / 2) + SHAPE_HANDLES.HIT_TOLERANCE;
                const lineMinX = Math.min(annotation.startX, annotation.endX) - tolerance;
                const lineMaxX = Math.max(annotation.startX, annotation.endX) + tolerance;
                const lineMinY = Math.min(annotation.startY, annotation.endY) - tolerance;
                const lineMaxY = Math.max(annotation.startY, annotation.endY) + tolerance;

                hit = (unrotatedPoint.x >= lineMinX && unrotatedPoint.x <= lineMaxX &&
                       unrotatedPoint.y >= lineMinY && unrotatedPoint.y <= lineMaxY &&
                       dist <= tolerance);
                break;
        }
        ctx.closePath();
        return hit;
    }

    //--- Drawing Shapes and Handles ---

    drawAllShapes(ctx) {
        this.state.annotations.forEach((annotation, index) => {
            if (annotation.type === 'shape') {
                this.drawShape(annotation, ctx);
                if (index === this.state.selectedShapeIndex) {
                    this.drawSelectionHandles(annotation, ctx);
                }
            }
        });
    }

    drawShape(annotation, ctx) {
        ctx.save();
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.width;
        ctx.fillStyle = annotation.color;

        const center = this._getShapeCenter(annotation);
        ctx.translate(center.x, center.y);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-center.x, -center.y);

        ctx.beginPath();
        const x1 = Math.min(annotation.startX, annotation.endX);
        const y1 = Math.min(annotation.startY, annotation.endY);
        const x2 = Math.max(annotation.startX, annotation.endX);
        const y2 = Math.max(annotation.startY, annotation.endY);
        const width = x2 - x1;
        const height = y2 - y1;

        switch(annotation.shapeType) {
            case SHAPE_TYPES.RECTANGLE:
                ctx.rect(x1, y1, width, height);
                break;
            case SHAPE_TYPES.CIRCLE:
                const radius = Math.max(width, height) / 2;
                ctx.ellipse(x1 + width / 2, y1 + height / 2, radius, radius, 0, 0, 2 * Math.PI);
                break;
            case SHAPE_TYPES.LINE:
                ctx.moveTo(annotation.startX, annotation.startY);
                ctx.lineTo(annotation.endX, annotation.endY);
                break;
            case SHAPE_TYPES.ARROW:
                this._drawArrow(ctx, annotation.startX, annotation.startY, annotation.endX, annotation.endY, annotation.width);
                break;
        }

        if (annotation.shapeType !== SHAPE_TYPES.ARROW) {
            ctx.stroke();
        }
        ctx.restore();
    }

    drawSelectionHandles(annotation, ctx) {
        const handlePositions = this._getHandlePositions(annotation);
        const handleSize = SHAPE_HANDLES.SIZE;
        const halfHandleSize = handleSize / 2;
        const rotationHandleRadius = SHAPE_HANDLES.ROTATION_RADIUS;
        const center = this._getShapeCenter(annotation);
        const rotation = annotation.rotation || 0;

        // Draw dashed bounding box (rotated)
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);
        ctx.translate(-center.x, -center.y);
        ctx.setLineDash(COLORS.SELECTION_DASH);
        ctx.strokeStyle = COLORS.HANDLE_STROKE;
        ctx.lineWidth = 1;
        const minX = Math.min(annotation.startX, annotation.endX);
        const minY = Math.min(annotation.startY, annotation.endY);
        const width = Math.abs(annotation.endX - annotation.startX);
        const height = Math.abs(annotation.endY - annotation.startY);
        ctx.strokeRect(minX, minY, width, height);
        ctx.setLineDash([]);
        ctx.restore();

        // Draw handles at rotated positions
        for (const key in handlePositions) {
            const pos = handlePositions[key];
            if (key === 'rotate') {
                // Draw rotation handle
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, rotationHandleRadius, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.ROTATION_HANDLE_FILL;
                ctx.fill();
                ctx.strokeStyle = COLORS.ROTATION_HANDLE_STROKE;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Draw line from top-center handle to rotation handle
                const topCenterHandle = handlePositions['t'];
                ctx.beginPath();
                ctx.moveTo(topCenterHandle.x, topCenterHandle.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.strokeStyle = COLORS.ROTATION_LINE;
                ctx.stroke();
            } else {
                // Draw resize handles
                ctx.fillStyle = COLORS.HANDLE_FILL;
                ctx.strokeStyle = COLORS.HANDLE_STROKE;
                ctx.lineWidth = 1;
                ctx.fillRect(pos.x - halfHandleSize, pos.y - halfHandleSize, handleSize, handleSize);
                ctx.strokeRect(pos.x - halfHandleSize, pos.y - halfHandleSize, handleSize, handleSize);
            }
        }
    }

    //--- Helper Methods ---

    _getShapeCenter(annotation) {
        return {
            x: annotation.startX + (annotation.endX - annotation.startX) / 2,
            y: annotation.startY + (annotation.endY - annotation.startY) / 2
        };
    }

    _getHandlePositions(annotation) {
        const minX = Math.min(annotation.startX, annotation.endX);
        const minY = Math.min(annotation.startY, annotation.endY);
        const maxX = Math.max(annotation.startX, annotation.endX);
        const maxY = Math.max(annotation.startY, annotation.endY);
        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;
        const rotation = annotation.rotation || 0;
        const rotationHandleOffset = SHAPE_HANDLES.ROTATION_OFFSET;

        const unrotatedHandles = {
            tl: { x: minX, y: minY },
            tr: { x: maxX, y: minY },
            bl: { x: minX, y: maxY },
            br: { x: maxX, y: maxY },
            t:  { x: centerX, y: minY },
            b:  { x: centerX, y: maxY },
            l:  { x: minX, y: centerY },
            r:  { x: maxX, y: centerY },
            rotate: { x: centerX, y: minY - rotationHandleOffset }
        };

        const rotatedHandles = {};
        const rotationCenter = { x: centerX, y: centerY };
        for (const key in unrotatedHandles) {
            rotatedHandles[key] = rotatePoint(unrotatedHandles[key], rotationCenter, rotation);
        }
        return rotatedHandles;
    }

    _drawArrowhead(ctx, fromX, fromY, toX, toY, lineWidth) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowWidth = Math.max(SHAPE_HANDLES.ARROW_MIN_WIDTH, lineWidth * SHAPE_HANDLES.ARROW_WIDTH_FACTOR);
        const headLength = Math.max(SHAPE_HANDLES.ARROW_MIN_HEAD_LENGTH, lineWidth * SHAPE_HANDLES.ARROW_HEAD_LENGTH_FACTOR);

        ctx.save();
        ctx.beginPath();
        ctx.translate(toX, toY);
        ctx.rotate(angle);
        ctx.moveTo(0, 0);
        ctx.lineTo(-headLength, -arrowWidth / 2);
        ctx.lineTo(-headLength * 0.9, 0);
        ctx.lineTo(-headLength, arrowWidth / 2);
        ctx.closePath();
        ctx.restore();
        ctx.fill();
    }

    _drawArrow(ctx, fromX, fromY, toX, toY, lineWidth) {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        this._drawArrowhead(ctx, fromX, fromY, toX, toY, lineWidth);
    }

    deleteSelectedShape() {
        if (this.state.selectedShapeIndex !== null) {
            this.state.annotations.splice(this.state.selectedShapeIndex, 1);
            this.state.selectedShapeIndex = null;
            this.state.interactionMode = 'none';
            this.redrawAll();
            this.controller.canvasManager.updateCursor(this.state.lastX, this.state.lastY);
        }
    }
}

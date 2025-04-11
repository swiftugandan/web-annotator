import { Z_INDEX, TOOLS, COLORS } from '../utils/constants.js';
import { drawPath } from '../utils/drawingUtils.js';

/**
 * Manages the annotation canvas, its context, event listeners, and rendering.
 */
export class CanvasManager {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.elements = {}; // Store canvas, overlay, blocker
        this.ctx = null; // Canvas 2D context

        this.createOverlayAndCanvas();
        this.setupCanvasEvents();
        this.setupKeyboardShortcuts();
        this.setupWindowResize();
    }

    createOverlayAndCanvas() {
         // Create a blocker div to capture clicks when inactive (optional but good UX)
        this.elements.blocker = document.createElement('div');
        Object.assign(this.elements.blocker.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: Z_INDEX.OVERLAY -1, // Below the overlay
            background: 'transparent' // Does not visually block, just captures events
        });
        document.body.appendChild(this.elements.blocker);

        // Create overlay div to ensure body height
        this.elements.overlay = document.createElement('div');
        this.elements.overlay.id = 'annotator-overlay';
        Object.assign(this.elements.overlay.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            minHeight: '100vh',
            pointerEvents: 'none', // Allow clicks to pass through overlay
            zIndex: Z_INDEX.OVERLAY
        });
        document.body.appendChild(this.elements.overlay);

        // Create canvas
        this.elements.canvas = document.createElement('canvas');
        this.elements.canvas.id = 'annotator-canvas';
        Object.assign(this.elements.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'auto', // Capture mouse events on canvas
            zIndex: Z_INDEX.CANVAS
            // background: 'rgba(0,0,255,0.05)' // Optional: Slight background for debugging
        });
        this.elements.canvas.width = window.innerWidth;
        this.elements.canvas.height = window.innerHeight;
        document.body.appendChild(this.elements.canvas);
        this.ctx = this.elements.canvas.getContext('2d');

        // Set initial cursor
        this.updateCursor(0, 0); // Initial update
    }

    setupCanvasEvents() {
      this.elements.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.elements.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
      this.elements.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
      this.elements.canvas.addEventListener('mouseout', this.handleMouseUp.bind(this)); // Treat mouse out as mouse up
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    setupWindowResize() {
        window.addEventListener('resize', this.handleWindowResize.bind(this));
    }

    //--- Event Handlers ---

    handleMouseDown(e) {
        if (this.state.isDraggingToolbar) return;
        const tool = this.state.tool;

        if (tool === TOOLS.DRAW) {
            this.controller.drawingTool.start(e);
        } else if (tool === TOOLS.ERASER) {
            this.controller.eraserTool.start(e);
        } else if (tool === TOOLS.SHAPES) {
            const handled = this.controller.shapeTool.startInteraction(e);
            if (handled) e.stopPropagation();
        } else if (tool === TOOLS.TEXT) {
            const handled = this.controller.textTool.startInteraction(e);
            if (handled) e.stopPropagation();
        }

        if (tool !== TOOLS.SHAPES && this.state.selectedShapeIndex !== null) {
            this.controller.deselectShape();
        }
    }

    handleMouseMove(e) {
        if (this.state.isDraggingToolbar) return;
        const tool = this.state.tool;

        if (this.state.isDrawing) { // Drawing or Erasing
            if (tool === TOOLS.DRAW) {
                this.controller.drawingTool.draw(e);
            } else if (tool === TOOLS.ERASER) {
                this.controller.eraserTool.draw(e);
            }
        } else if (tool === TOOLS.SHAPES) {
             this.controller.shapeTool.handleMoveInteraction(e);
        } else if (tool === TOOLS.TEXT) {
             this.controller.textTool.handleMoveInteraction(e);
        } else {
             this.updateCursor(e.clientX, e.clientY);
        }
        this.state.lastX = e.clientX;
        this.state.lastY = e.clientY;
    }

    handleMouseUp(e) {
        if (this.state.isDraggingToolbar) return;
        const tool = this.state.tool;

        if (this.state.isDrawing) { // Drawing or Erasing finished
            if (tool === TOOLS.DRAW) {
                this.controller.drawingTool.stop();
            } else if (tool === TOOLS.ERASER) {
                this.controller.eraserTool.stop();
            }
        } else if (tool === TOOLS.SHAPES) {
            this.controller.shapeTool.stopInteraction(e);
        } else if (tool === TOOLS.TEXT) {
            this.controller.textTool.stopInteraction(e);
        }
         this.updateCursor(e.clientX, e.clientY);
    }

    handleKeyDown(e) {
        const isDeletionKey = e.key === 'Delete' || e.key === 'Backspace';

        if (isDeletionKey) {
            if (this.state.selectedShapeIndex !== null && this.state.tool === TOOLS.SHAPES) {
                 this.controller.shapeTool.deleteSelectedShape();
            } else if (this.state.selectedTextIndex !== null && this.state.tool === TOOLS.TEXT) {
                 this.controller.textTool.deleteSelectedText();
            }
        }
    }

    handleWindowResize() {
        // Debounce resize event? For now, simple resize.
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;

        if (this.elements.canvas.width !== currentWidth || this.elements.canvas.height !== currentHeight) {
            // Create a temporary canvas to store the current drawing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.elements.canvas.width;
            tempCanvas.height = this.elements.canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.drawImage(this.elements.canvas, 0, 0);
            }

            // Resize the main canvas
            this.elements.canvas.width = currentWidth;
            this.elements.canvas.height = currentHeight;

            // Restore the drawing from the temporary canvas (optional, redrawAll is better)
            // this.ctx.drawImage(tempCanvas, 0, 0);

            // Better: Redraw all annotations based on the potentially updated viewport
            this.redrawAnnotations();
        }
    }

    //--- Rendering ---

    redrawAnnotations() {
        if (!this.ctx || !this.elements.canvas) return;
        this.ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);

        this.state.annotations.forEach((annotation, index) => {
            if (annotation.type === 'draw') {
                drawPath(annotation, this.ctx);
            } else if (annotation.type === 'shape') {
                 // Shape drawing and handles are managed by ShapeTool
                 // called within redrawAnnotations
            } else if (annotation.type === 'text') {
                 // Text drawing and handles are managed by TextTool
                 // called within redrawAnnotations
            }
        });

        // Call specialized drawing methods from managers/tools
        this.controller.shapeTool?.drawAllShapes(this.ctx);
        this.controller.textTool?.drawAllTexts(this.ctx);

        // Note: The above structure assumes redrawAnnotations is the single point of truth.
        // If performance becomes an issue, more granular redraws might be needed.
    }

    //--- Cursor Management ---

    updateCursor(mouseX, mouseY) {
        if (!this.elements.canvas) return;
        let cursorStyle = 'default';

        if (this.state.isDraggingToolbar) {
            cursorStyle = 'grabbing'; // Should be handled by toolbar manager, but good fallback
        } else if (this.state.interactionMode === 'moving') {
            cursorStyle = 'move';
        } else if (this.state.interactionMode === 'rotating') {
            cursorStyle = 'grabbing'; // Or specific rotation cursor
        } else if (this.state.interactionMode === 'resizing') {
             cursorStyle = this._getResizeCursor(this.state.activeHandle, this.state.selectedShapeIndex !== null ? this.state.annotations[this.state.selectedShapeIndex].rotation || 0 : 0);
        } else {
            switch (this.state.tool) {
                case TOOLS.DRAW:
                    cursorStyle = 'crosshair';
                    break;
                case TOOLS.ERASER:
                    const eraserCursorBase64 = 'data:image/png;base64,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9ARR5RGTudnn3q89vVNBihLK+eLrXRxQ+J96dOqM9y2fVbyewwduLg5/PtR/i98zfeQ5ELqIXQ4ueL1E/VHMtS9V72fZt2tf0yOg/2N+4Jz+4X7+kP8Xeg/wHdDfGVg5z2L+uuaedm6vdS9e/4L+yr6p/TT9av6b/R/t3/i8Cf4JPhHaOfkZP5JXnP+ZX8n8uXPLn4+fm2/eP3/1P/n/yANyAT0B3AAAAHNQTFRFAAAA////////////////////////////////////////////////////////////////////////////////////////////////////////////iuBoOwAAABJ0Uk5TAA0zP0tYYG9whZSlxM7f8P2Coc7sAAAB6UlEQVR42rWW63qkIAyFERUUFQSct+X9n3OLjr3Y0TbwZ9nFt03IyQGTwPinmLl1IRzSdvBYgaD3q6xIkAUE6g9QkDxUoLV+A1WAj4oRreCcnKRAmxULKUj9CXaL2JwD5W+guq+joCIgVHAXdRkVRCALCFXcYC+jIAlKQKji9tPZKXAV7Z9iiQXI33J5e61iZYDrWmtXNXcSdRUAY7SzEbXWCeVALyDOerp0mguQ3QD2MqvXJRbw4J4ShHVH+8hAp/qxxGwVaFFtACt6oADDMvqVlAOqv0DBIp3ThofMK39JGHoFkf6oEwD3xJGj+FhPcz0EKXwCM/q9Zui6VG84L4D4oSdAw83rM4CG8XU9BeDsD6iOD0A69QcoN0AMZtLPAJJ5aF+AdExYXwGcf4J80AjA9gH0Ww1gM93afQYYKnj1qKHHbfYXgBVcDzAjYFFT2ILWbwBLX3owqR5WALiESTk+Hgc7nFUbRgEwdYSdQPbLlgLQ9Y5CxU43rQCwZwPzOu+FbgT36HQGGMZHYxfATK975AAuKUdvdzBh9iwLwE0BfzlMHeCXOlkA6OWM/3UG+AWa0NfgXB2G9m+QcEhLXsBd5wqArmA23EEQIXprbR5gnwcRmhXM8z7tG/4B6VIj8oIUpjIAAAAASUVORK5CYII=';
                    cursorStyle = `url(${eraserCursorBase64}) 12 12, auto`;
                    break;
                case TOOLS.TEXT:
                    cursorStyle = 'text';
                    
                    // Check for handles on selected text
                    if (this.state.selectedTextIndex !== null) {
                        const selectedText = this.state.annotations[this.state.selectedTextIndex];
                        const handle = this.controller.textTool.getInteractionHandleAtPoint(mouseX, mouseY, selectedText);
                        
                        if (handle) {
                            if (handle === 'rotate') {
                                cursorStyle = 'grab';
                            } else {
                                cursorStyle = this._getResizeCursor(handle, selectedText.rotation || 0);
                            }
                            this.elements.canvas.style.cursor = cursorStyle;
                            return;
                        }
                        
                        // Check if hovering over existing text (for moving)
                        if (this.controller.textTool._isPointInsideText(mouseX, mouseY, selectedText)) {
                            cursorStyle = 'move';
                            this.elements.canvas.style.cursor = cursorStyle;
                            return;
                        }
                    }
                    
                    // Check if hovering over any text
                    const hoveredTextIndex = this.controller.textTool.getTextAtPoint(mouseX, mouseY);
                    if (hoveredTextIndex !== null) {
                        cursorStyle = 'move';
                    }
                    break;
                case TOOLS.SHAPES:
                    // Check hover over handles first
                    if (this.state.selectedShapeIndex !== null) {
                        const handle = this.controller.shapeTool.getInteractionHandleAtPoint(mouseX, mouseY, this.state.annotations[this.state.selectedShapeIndex]);
                        if (handle) {
                            if (handle === 'rotate') {
                                cursorStyle = 'grab';
                            } else {
                                // cursorStyle = 'pointer'; // Or specific resize cursor
                                 cursorStyle = this._getResizeCursor(handle, this.state.annotations[this.state.selectedShapeIndex].rotation || 0);
                            }
                             this.elements.canvas.style.cursor = cursorStyle;
                             return; // Don't override with shape hover
                        }
                    }
                    // Check hover over any shape
                    const hoveredShapeIndex = this.controller.shapeTool.getShapeAtPoint(mouseX, mouseY);
                    if (hoveredShapeIndex !== null) {
                        cursorStyle = 'move';
                    } else {
                        cursorStyle = 'crosshair'; // Default for drawing new shape
                    }
                    break;
                default:
                    cursorStyle = 'default';
            }
        }

        this.elements.canvas.style.cursor = cursorStyle;
    }

     _getResizeCursor(handle, rotation) {
         // Basic angle ranges for cursor rotation (simplified)
         const degree = rotation * (180 / Math.PI);
         const tolerance = 22.5;
         let cursorBase = 'nesw-resize'; // Default

         switch (handle) {
             case 'tl':
             case 'br':
                 cursorBase = 'nwse-resize';
                 break;
             case 'tr':
             case 'bl':
                 cursorBase = 'nesw-resize';
                 break;
             case 't':
             case 'b':
                 cursorBase = 'ns-resize';
                 break;
             case 'l':
             case 'r':
                 cursorBase = 'ew-resize';
                 break;
             default: return 'pointer'; // Default for unknown handle
         }

          // Adjust cursor based on rotation (very simplified)
         // This needs a more robust mapping of handle + angle to appropriate cursor
         // For now, just return the base cursor
         // Example: if angle is near 45 deg, ns-resize becomes nesw-resize
         // if (Math.abs(degree % 90) > tolerance && Math.abs(degree % 90) < 90 - tolerance) {
             // Rotate cursor? This is complex and browser support varies.
             // CSS transform on the canvas itself might be an alternative visually.
         // }

         return cursorBase;
     }

    // Method to be called by the controller to clean up
    destroy() {
        if (this.elements.canvas) {
            this.elements.canvas.remove();
        }
        if (this.elements.overlay) {
            this.elements.overlay.remove();
        }
         if (this.elements.blocker) {
            this.elements.blocker.remove();
        }
        // Remove global listeners
        window.removeEventListener('resize', this.handleWindowResize);
        document.removeEventListener('keydown', this.handleKeyDown);
    }
}

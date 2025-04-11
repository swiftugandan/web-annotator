import { TOOLS, SHAPE_HANDLES, COLORS, IMAGE_CONFIG } from '../utils/constants.js';
import { rotatePoint } from '../utils/geometryUtils.js';

/**
 * Handles image insertion, selection, resizing, and rotation logic.
 */
export class ImageTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx;
        this.redrawAll = controller.redrawAll.bind(controller);
        this.imageCache = new Map(); // Cache for loaded images
    }

    //--- Image Creation ---

    /**
     * Inserts an image at the specified position
     * @param {string} base64Data - Base64 encoded image data
     * @param {number} x - X position to place the image
     * @param {number} y - Y position to place the image
     * @param {number} width - Optional width for the image
     * @param {number} height - Optional height for the image
     */
    insertImage(base64Data, x, y, width = IMAGE_CONFIG.DEFAULT_WIDTH, height = IMAGE_CONFIG.DEFAULT_HEIGHT) {
        // Create image annotation
        this.state.annotations.push({
            type: 'image',
            base64Data: base64Data,
            startX: x,
            startY: y,
            endX: x + width,
            endY: y + height,
            rotation: 0,
            aspectRatio: width / height
        });

        // Select the newly added image
        this.state.selectedImageIndex = this.state.annotations.length - 1;
        this.state.interactionMode = 'none';
        this.redrawAll();
    }

    /**
     * Handles file selection for image upload
     */
    handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            
            // Pre-load the image to get its natural dimensions
            const img = new Image();
            img.onload = () => {
                // Calculate dimensions maintaining aspect ratio
                const aspectRatio = img.width / img.height;
                let width = IMAGE_CONFIG.DEFAULT_WIDTH;
                let height = width / aspectRatio;
                
                // Ensure the image isn't too large
                if (width > IMAGE_CONFIG.MAX_SIZE || height > IMAGE_CONFIG.MAX_SIZE) {
                    if (width > height) {
                        width = IMAGE_CONFIG.MAX_SIZE;
                        height = width / aspectRatio;
                    } else {
                        height = IMAGE_CONFIG.MAX_SIZE;
                        width = height * aspectRatio;
                    }
                }
                
                // Position in center of screen
                const canvasRect = this.controller.canvasManager.elements.canvas.getBoundingClientRect();
                const x = canvasRect.width / 2 - width / 2;
                const y = canvasRect.height / 2 - height / 2;
                
                this.insertImage(base64Data, x, y, width, height);
            };
            img.src = base64Data;
        };
        reader.readAsDataURL(file);
    }

    //--- Image Interaction ---

    startInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;

        // Check for handle interaction on selected image
        if (this.state.selectedImageIndex !== null) {
            const selectedImage = this.state.annotations[this.state.selectedImageIndex];
            const handle = this.getInteractionHandleAtPoint(mouseX, mouseY, selectedImage);
            if (handle) {
                this.state.activeHandle = handle;
                if (handle === 'rotate') {
                    this.state.interactionMode = 'rotating';
                    this.state.shapeCenter = this._getImageCenter(selectedImage);
                } else {
                    this.state.interactionMode = 'resizing';
                }
                return true;
            }
        }

        // Check for click on any image (select/move)
        const clickedImageIndex = this.getImageAtPoint(mouseX, mouseY);
        if (clickedImageIndex !== null) {
            this.state.selectedImageIndex = clickedImageIndex;
            this.state.interactionMode = 'moving';
            this.redrawAll();
            return true;
        }

        // Clicked on empty space - deselect
        this.state.selectedImageIndex = null;
        this.state.interactionMode = 'none';
        this.redrawAll();
        return false;
    }

    handleMoveInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        if (this.state.interactionMode === 'moving' && this.state.selectedImageIndex !== null) {
            this._moveImage(mouseX, mouseY);
        } else if (this.state.interactionMode === 'resizing' && this.state.selectedImageIndex !== null) {
            this._resizeImage(mouseX, mouseY);
        } else if (this.state.interactionMode === 'rotating' && this.state.selectedImageIndex !== null) {
            this._rotateImage(mouseX, mouseY);
        } else {
            this.controller.canvasManager.updateCursor(mouseX, mouseY);
        }

        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;
    }

    stopInteraction(e) {
        if (['moving', 'resizing', 'rotating'].includes(this.state.interactionMode)) {
            if (this.state.selectedImageIndex !== null) {
                 const image = this.state.annotations[this.state.selectedImageIndex];
                 this._normalizeImage(image);
                 this.redrawAll();
             }
            this.state.interactionMode = 'none';
            this.state.activeHandle = null;
            this.controller.canvasManager.updateCursor(e.clientX, e.clientY);
        }
    }

    _moveImage(mouseX, mouseY) {
        const image = this.state.annotations[this.state.selectedImageIndex];
        const dx = mouseX - this.state.dragStartX;
        const dy = mouseY - this.state.dragStartY;

        image.startX += dx;
        image.startY += dy;
        image.endX += dx;
        image.endY += dy;
        this.redrawAll();
    }

    _resizeImage(mouseX, mouseY) {
        const image = this.state.annotations[this.state.selectedImageIndex];
        const handle = this.state.activeHandle;
        
        const center = this._getImageCenter(image);
        const rotation = image.rotation || 0;
        const lastUnrotated = rotatePoint({ x: this.state.dragStartX, y: this.state.dragStartY }, center, -rotation);
        const currentUnrotated = rotatePoint({ x: mouseX, y: mouseY }, center, -rotation);
        const dx = currentUnrotated.x - lastUnrotated.x;
        const dy = currentUnrotated.y - lastUnrotated.y;

        // Normalize start/end for calculations
        let x1 = Math.min(image.startX, image.endX);
        let y1 = Math.min(image.startY, image.endY);
        let x2 = Math.max(image.startX, image.endX);
        let y2 = Math.max(image.startY, image.endY);
        const width = x2 - x1;
        const height = y2 - y1;
        const aspectRatio = image.aspectRatio || width / height;
        
        // Store original values to calculate changes
        const originalWidth = width;
        const originalHeight = height;
        
        // Apply resizing based on handle (using unrotated coordinates)
        switch (handle) {
            case 'tl': x1 += dx; y1 += dy; break;
            case 'tr': x2 += dx; y1 += dy; break;
            case 'bl': x1 += dx; y2 += dy; break;
            case 'br': x2 += dx; y2 += dy; break;
            case 't': y1 += dy; break;
            case 'b': y2 += dy; break;
            case 'l': x1 += dx; break;
            case 'r': x2 += dx; break;
        }
        
        // Calculate new width and height
        const newWidth = x2 - x1;
        const newHeight = y2 - y1;
        
        // Update image properties
        image.startX = x1;
        image.startY = y1;
        image.endX = x2;
        image.endY = y2;

        this.redrawAll();
    }

    _rotateImage(mouseX, mouseY) {
        const image = this.state.annotations[this.state.selectedImageIndex];
        const center = this._getImageCenter(image);

        const prevAngle = Math.atan2(this.state.dragStartY - center.y, this.state.dragStartX - center.x);
        const currentAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
        const deltaAngle = currentAngle - prevAngle;

        image.rotation = (image.rotation || 0) + deltaAngle;
        this.redrawAll();
    }

    _normalizeImage(image) {
        if (!image.rotation) {
            const x1 = Math.min(image.startX, image.endX);
            const y1 = Math.min(image.startY, image.endY);
            const x2 = Math.max(image.startX, image.endX);
            const y2 = Math.max(image.startY, image.endY);
            image.startX = x1;
            image.startY = y1;
            image.endX = x2;
            image.endY = y2;
        }
    }

    //--- Hit Detection ---

    getImageAtPoint(x, y) {
        for (let i = this.state.annotations.length - 1; i >= 0; i--) {
            const annotation = this.state.annotations[i];
            if (annotation.type !== 'image') continue;

            if (this._isPointInsideImage(x, y, annotation)) {
                return i;
            }
        }
        return null;
    }

    getInteractionHandleAtPoint(x, y, annotation) {
        if (!annotation || annotation.type !== 'image') return null;

        const handlePositions = this._getHandlePositions(annotation);
        const rotationTouchRadius = SHAPE_HANDLES.ROTATION_RADIUS + SHAPE_HANDLES.HIT_TOLERANCE;
        const resizeTouchRadius = (SHAPE_HANDLES.SIZE / 2) + SHAPE_HANDLES.HIT_TOLERANCE;

        // Check rotation handle first
        const rotateHandle = handlePositions['rotate'];
        const distanceToRotate = Math.sqrt(
            Math.pow(x - rotateHandle.x, 2) + Math.pow(y - rotateHandle.y, 2)
        );
        if (distanceToRotate <= rotationTouchRadius) {
            return 'rotate';
        }

        // Check resize handles
        for (const handleName of ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r']) {
            const handle = handlePositions[handleName];
            const distance = Math.sqrt(
                Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2)
            );
            if (distance <= resizeTouchRadius) {
                return handleName;
            }
        }

        return null;
    }

    _isPointInsideImage(x, y, annotation) {
        const center = this._getImageCenter(annotation);
        const rotation = annotation.rotation || 0;
        
        // Convert point to coordinates relative to the center
        const relativeX = x - center.x;
        const relativeY = y - center.y;
        
        // Apply inverse rotation to get the point in the image's coordinate system
        const rotatedX = relativeX * Math.cos(-rotation) - relativeY * Math.sin(-rotation);
        const rotatedY = relativeX * Math.sin(-rotation) + relativeY * Math.cos(-rotation);
        
        // Convert back to absolute coordinates
        const unrotatedX = rotatedX + center.x;
        const unrotatedY = rotatedY + center.y;
        
        // Check if the unrotated point is inside the rectangle
        return (
            unrotatedX >= Math.min(annotation.startX, annotation.endX) &&
            unrotatedX <= Math.max(annotation.startX, annotation.endX) &&
            unrotatedY >= Math.min(annotation.startY, annotation.endY) &&
            unrotatedY <= Math.max(annotation.startY, annotation.endY)
        );
    }

    //--- Drawing ---

    drawAllImages(ctx) {
        this.state.annotations.forEach((annotation, index) => {
            if (annotation.type === 'image') {
                this.drawImage(annotation, ctx);
                if (index === this.state.selectedImageIndex) {
                    this.drawSelectionHandles(annotation, ctx);
                }
            }
        });
    }

    drawImage(annotation, ctx) {
        if (!annotation.base64Data) return;
        
        // Get cached image or create a new one
        let img;
        if (this.imageCache.has(annotation.base64Data)) {
            img = this.imageCache.get(annotation.base64Data);
        } else {
            img = new Image();
            img.src = annotation.base64Data;
            this.imageCache.set(annotation.base64Data, img);
            
            // If image is not loaded yet, wait for it to load
            if (!img.complete) {
                img.onload = () => this.redrawAll();
                return;
            }
        }

        ctx.save();
        
        // Calculate dimensions and center
        const center = this._getImageCenter(annotation);
        const width = Math.abs(annotation.endX - annotation.startX);
        const height = Math.abs(annotation.endY - annotation.startY);
        
        // Apply rotation
        ctx.translate(center.x, center.y);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-center.x, -center.y);
        
        // Draw the image
        ctx.drawImage(
            img,
            Math.min(annotation.startX, annotation.endX),
            Math.min(annotation.startY, annotation.endY),
            width,
            height
        );
        
        ctx.restore();
    }

    drawSelectionHandles(annotation, ctx) {
        const handlePositions = this._getHandlePositions(annotation);
        const handleSize = SHAPE_HANDLES.SIZE;
        const halfHandleSize = handleSize / 2;
        const rotationHandleRadius = SHAPE_HANDLES.ROTATION_RADIUS;
        const center = this._getImageCenter(annotation);
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

    _getImageCenter(annotation) {
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

    deleteSelectedImage() {
        if (this.state.selectedImageIndex !== null) {
            this.state.annotations.splice(this.state.selectedImageIndex, 1);
            this.state.selectedImageIndex = null;
            this.state.interactionMode = 'none';
            this.redrawAll();
            this.controller.canvasManager.updateCursor(this.state.lastX, this.state.lastY);
        }
    }
    
    /**
     * Generate a file upload input for image selection
     */
    createFileUploadInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });
        document.body.appendChild(input);
        input.click();
        
        // Remove the input after selection
        setTimeout(() => {
            document.body.removeChild(input);
        }, 5000);
    }
} 
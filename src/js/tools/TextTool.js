import { COLORS, Z_INDEX } from '../utils/constants.js';
import { rotatePoint } from '../utils/geometryUtils.js';

/**
 * Handles text annotation creation, selection, moving, resizing, and rotation.
 */
export class TextTool {
    constructor(controller) {
        this.controller = controller;
        this.state = controller.state;
        this.ctx = controller.canvasManager.ctx;
        this.redrawAll = controller.redrawAll.bind(controller);
        this.activeTextWidgetId = null;
        this.state.isCtrlPressed = false;
        
        // Add keyboard event listeners for Ctrl key tracking
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    _handleKeyDown(e) {
        if (e.key === 'Control') {
            this.state.isCtrlPressed = true;
            if (this.state.interactionMode === 'resizing' && this.state.selectedTextIndex !== null) {
                this.redrawAll(); // Redraw to show Ctrl indicator on handles
            }
        }
    }
    
    _handleKeyUp(e) {
        if (e.key === 'Control') {
            this.state.isCtrlPressed = false;
            if (this.state.interactionMode === 'resizing' && this.state.selectedTextIndex !== null) {
                this.redrawAll(); // Redraw to remove Ctrl indicator
            }
        }
    }

    //--- Text Creation ---

    start(e) {
        this.createTextWidget(e.clientX, e.clientY);
    }

    update(e) {
        // Nothing to do during drag for text tool
    }

    stop(e) {
        // Nothing to do on mouse up for text tool
    }

    createTextWidget(x, y) {
        // Create text annotation
        const textId = Date.now().toString();
        const newText = {
            type: 'text',
            id: textId,
            text: '',
            x: x,
            y: y,
            width: 200,
            height: 100,
            color: this._ensureHexColor(this.state.drawColor),
            fontSize: 16,
            rotation: 0,
            editable: true
        };

        // Add to annotations
        this.state.annotations.push(newText);
        
        // Create editable widget
        this._createTextEditWidget(newText);
        
        // Set as selected
        this.state.selectedTextIndex = this.state.annotations.length - 1;
        this.redrawAll();
    }

    _createTextEditWidget(textAnnotation) {
        // Remove any existing text widget
        this._removeTextEditWidget();
        
        // Create a text edit widget
        const textWidget = document.createElement('div');
        textWidget.id = `text-widget-${textAnnotation.id}`;
        textWidget.contentEditable = true;
        this.activeTextWidgetId = textWidget.id;
        
        // Set the text content if it exists
        if (textAnnotation.text) {
            textWidget.innerText = textAnnotation.text;
        } else {
            textWidget.innerText = 'Type here...';
            // Select all text when it's a placeholder
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(textWidget);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 10);
        }
        
        // Calculate center point for transform-origin
        const centerX = textAnnotation.width / 2;
        const centerY = textAnnotation.height / 2;
        
        // Ensure color is in hex format
        const hexColor = this._ensureHexColor(textAnnotation.color);
        
        Object.assign(textWidget.style, {
            position: 'fixed',
            left: `${textAnnotation.x}px`,
            top: `${textAnnotation.y}px`,
            width: `${textAnnotation.width}px`,
            minHeight: `${textAnnotation.height}px`,
            padding: '5px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: `2px solid ${hexColor}`,
            borderRadius: '3px',
            color: hexColor,
            fontSize: `${textAnnotation.fontSize}px`,
            fontFamily: 'Arial, sans-serif',
            zIndex: Z_INDEX.TEXT_WIDGET,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transform: `rotate(${textAnnotation.rotation || 0}rad)`,
            transformOrigin: `${centerX}px ${centerY}px`, // Set to center of element
            outline: 'none' // Remove the focus outline for cleaner appearance
        });
        
        document.body.appendChild(textWidget);
        
        // Focus the text widget after a short delay to ensure it's in the DOM
        setTimeout(() => {
            textWidget.focus();
            // Place cursor at the end if there's existing text
            if (textAnnotation.text) {
                const range = document.createRange();
                range.selectNodeContents(textWidget);
                range.collapse(false); // collapse to end
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 50);
        
        // Add event listeners
        textWidget.addEventListener('blur', () => {
            this._saveTextContent(textAnnotation, textWidget);
            this._removeTextEditWidget();
            this.redrawAll();
        });
        
        textWidget.addEventListener('keydown', (e) => {
            // Only stop propagation for keys we're handling
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                textWidget.blur();
            } else if (e.key === 'Enter' && e.shiftKey) {
                // Allow line breaks with Shift+Enter
            } else if (e.key === 'Enter') {
                // Blur on Enter to save the text (similar to "done" button behavior)
                e.preventDefault();
                textWidget.blur();
            }
        });
        
        // Click listener to stop clicks from going through to canvas
        textWidget.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    _saveTextContent(textAnnotation, textWidget) {
        let content = textWidget.innerText.trim();
        
        // Don't save the placeholder text
        if (content === 'Type here...') {
            content = '';
        }
        
        textAnnotation.text = content;
        textAnnotation.editable = false;
        
        // If no text was entered, remove the annotation
        if (!content) {
            const index = this.state.annotations.findIndex(a => 
                a.type === 'text' && a.id === textAnnotation.id);
            
            if (index !== -1) {
                this.state.annotations.splice(index, 1);
                if (this.state.selectedTextIndex === index) {
                    this.state.selectedTextIndex = null;
                } else if (this.state.selectedTextIndex > index) {
                    // Adjust index if we removed an annotation before the selected one
                    this.state.selectedTextIndex--;
                }
            }
        }
    }

    _removeTextEditWidget() {
        if (this.activeTextWidgetId) {
            const widget = document.getElementById(this.activeTextWidgetId);
            if (widget) {
                widget.remove();
            }
            this.activeTextWidgetId = null;
        }
    }

    //--- Text Interaction ---

    startInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;

        // Check if we have an active text widget - if so, this is an interaction with the widget itself
        if (this.activeTextWidgetId) {
            const widget = document.getElementById(this.activeTextWidgetId);
            if (widget && widget.contains(e.target)) {
                // User is interacting with the text widget, let it handle the event
                return true;
            }
        }

        // 1. Check for handle interaction on selected text
        if (this.state.selectedTextIndex !== null) {
            const selectedText = this.state.annotations[this.state.selectedTextIndex];
            const handle = this.getInteractionHandleAtPoint(mouseX, mouseY, selectedText);
            if (handle) {
                this.state.activeHandle = handle;
                if (handle === 'rotate') {
                    this.state.interactionMode = 'rotating';
                    this.state.textCenter = this._getTextCenter(selectedText);
                } else {
                    this.state.interactionMode = 'resizing';
                    // Show tooltip about Ctrl+resize feature
                    this._showTooltip("Hold Ctrl while resizing to adjust font size", mouseX, mouseY);
                }
                return true; // Interaction started (handle)
            }
            
            // Check if clicked inside the text (for moving)
            if (this._isPointInsideText(mouseX, mouseY, selectedText)) {
                // Handle double-click to edit
                if (e.detail === 2) {
                    this._createTextEditWidget(selectedText);
                    return true;
                }
                this.state.interactionMode = 'moving';
                return true; // Interaction started (moving)
            }
        }

        // 2. Check for click on any text (select/edit)
        const clickedTextIndex = this.getTextAtPoint(mouseX, mouseY);
        if (clickedTextIndex !== null) {
            const text = this.state.annotations[clickedTextIndex];
            this.state.selectedTextIndex = clickedTextIndex;
            
            // Handle double-click to edit
            if (e.detail === 2) {
                this._createTextEditWidget(text);
            } else {
                this.state.interactionMode = 'moving';
            }
            
            this.redrawAll();
            return true;
        }

        // 3. Clicked on empty space - deselect and start new text
        this.state.selectedTextIndex = null;
        this.state.interactionMode = 'none';
        this.start(e); // Start creating new text
        return true; // We're creating a new text, so handle the event
    }

    handleMoveInteraction(e) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        if (this.state.interactionMode === 'moving' && this.state.selectedTextIndex !== null) {
            this._moveText(mouseX, mouseY);
        } else if (this.state.interactionMode === 'resizing' && this.state.selectedTextIndex !== null) {
            this._resizeText(mouseX, mouseY, e.ctrlKey);
        } else if (this.state.interactionMode === 'rotating' && this.state.selectedTextIndex !== null) {
            this._rotateText(mouseX, mouseY);
        }

        // Update drag start for next move event AFTER calculations
        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;
    }

    stopInteraction(e) {
        if (['moving', 'resizing', 'rotating'].includes(this.state.interactionMode)) {
            this.state.interactionMode = 'none';
            this.state.activeHandle = null;
            this.controller.canvasManager.updateCursor(e.clientX, e.clientY);
            this._removeTooltip(); // Ensure tooltip is removed when interaction ends
        }
    }

    _moveText(mouseX, mouseY) {
        const text = this.state.annotations[this.state.selectedTextIndex];
        const dx = mouseX - this.state.dragStartX;
        const dy = mouseY - this.state.dragStartY;

        text.x += dx;
        text.y += dy;
        this.redrawAll();
    }

    _resizeText(mouseX, mouseY, isCtrlPressed = false) {
        const text = this.state.annotations[this.state.selectedTextIndex];
        const handle = this.state.activeHandle;
        
        const center = this._getTextCenter(text);
        const rotation = text.rotation || 0;
        
        // Store original dimensions for font scaling
        const originalWidth = text.width;
        const originalHeight = text.height;
        const originalFontSize = text.fontSize;
        
        // Use negative rotation to convert from global (rotated) to local (unrotated) coordinates
        // This is the inverse of what we do when drawing
        const lastUnrotated = rotatePoint({ x: this.state.dragStartX, y: this.state.dragStartY }, center, -rotation);
        const currentUnrotated = rotatePoint({ x: mouseX, y: mouseY }, center, -rotation);
        const dx = currentUnrotated.x - lastUnrotated.x;
        const dy = currentUnrotated.y - lastUnrotated.y;
        
        // Calculate corners in unrotated space
        let x1 = text.x;
        let y1 = text.y;
        let x2 = text.x + text.width;
        let y2 = text.y + text.height;
        
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
        
        // Ensure minimum size
        const minSize = 30;
        if (x2 - x1 < minSize) x2 = x1 + minSize;
        if (y2 - y1 < minSize) y2 = y1 + minSize;
        
        // Update text properties
        text.x = x1;
        text.y = y1;
        text.width = x2 - x1;
        text.height = y2 - y1;
        
        // If ctrl is pressed, adjust the font size based on the resize proportions
        if (isCtrlPressed) {
            // Calculate the average scale factor (from width and height changes)
            const widthRatio = text.width / originalWidth;
            const heightRatio = text.height / originalHeight;
            
            // Use the larger of the two ratios to ensure text is always readable
            const scaleRatio = (widthRatio + heightRatio) / 2;
            
            // Calculate new font size with limits
            const newFontSize = originalFontSize * scaleRatio;
            const minFontSize = 8;
            const maxFontSize = 72;
            
            // Apply font size with min/max limits
            text.fontSize = Math.max(minFontSize, Math.min(maxFontSize, newFontSize));
        }
        
        this.redrawAll();
    }

    _rotateText(mouseX, mouseY) {
        const text = this.state.annotations[this.state.selectedTextIndex];
        const center = this.state.textCenter || this._getTextCenter(text);

        const prevAngle = Math.atan2(this.state.dragStartY - center.y, this.state.dragStartX - center.x);
        const currentAngle = Math.atan2(mouseY - center.y, mouseX - center.x);
        const deltaAngle = currentAngle - prevAngle;

        text.rotation = (text.rotation || 0) + deltaAngle;
        this.redrawAll();
    }

    //--- Hit Detection ---

    getTextAtPoint(x, y) {
        for (let i = this.state.annotations.length - 1; i >= 0; i--) {
            const annotation = this.state.annotations[i];
            if (annotation.type !== 'text') continue;

            if (this._isPointInsideText(x, y, annotation)) {
                return i;
            }
        }
        return null;
    }

    getInteractionHandleAtPoint(x, y, text) {
        if (text.type !== 'text') return null;
        
        const handlePositions = this._getHandlePositions(text);
        const handleSize = 8; // Size of the handle hitbox
        
        // Check each handle
        for (const [handleName, pos] of Object.entries(handlePositions)) {
            const dx = x - pos.x;
            const dy = y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= handleSize) {
                return handleName;
            }
        }
        
        return null;
    }

    _isPointInsideText(x, y, text) {
        // For unrotated text, simple bounding box check
        if (!text.rotation) {
            return (
                x >= text.x &&
                x <= text.x + text.width &&
                y >= text.y &&
                y <= text.y + text.height
            );
        }
        
        // For rotated text, convert point to local coordinates
        const center = this._getTextCenter(text);
        // Using negative rotation to convert from global to local coordinates
        const rotatedPoint = rotatePoint({ x, y }, center, -text.rotation);
        
        // Check if rotated point is inside unrotated bounding box
        return (
            rotatedPoint.x >= text.x &&
            rotatedPoint.x <= text.x + text.width &&
            rotatedPoint.y >= text.y &&
            rotatedPoint.y <= text.y + text.height
        );
    }

    //--- Drawing ---

    drawAllTexts(ctx) {
        this.state.annotations.forEach((annotation, index) => {
            if (annotation.type === 'text') {
                this.drawText(annotation, ctx);
                if (index === this.state.selectedTextIndex) {
                    this.drawSelectionHandles(annotation, ctx);
                }
            }
        });
    }

    drawText(annotation, ctx) {
        if (!annotation.text) {
            // Draw a placeholder empty text box if selected
            if (annotation === this.state.annotations[this.state.selectedTextIndex]) {
                ctx.save();
                
                const centerX = annotation.x + annotation.width / 2;
                const centerY = annotation.y + annotation.height / 2;
                
                ctx.translate(centerX, centerY);
                ctx.rotate(annotation.rotation || 0);
                ctx.translate(-centerX, -centerY);
                
                // Draw empty box with dashed border
                ctx.strokeStyle = this._ensureHexColor(annotation.color);
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
                
                // Draw placeholder text
                ctx.fillStyle = this._ensureHexColor(annotation.color);
                ctx.font = `${annotation.fontSize}px Arial, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.fillText("Text", centerX, centerY);
                
                ctx.restore();
            }
            return; 
        }
        
        ctx.save();
        
        const centerX = annotation.x + annotation.width / 2;
        const centerY = annotation.y + annotation.height / 2;
        
        // Apply rotation around center - use the same rotation direction as the handles
        ctx.translate(centerX, centerY);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-centerX, -centerY);
        
        // Draw background (optional)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        // Draw text
        ctx.fillStyle = this._ensureHexColor(annotation.color);
        ctx.font = `${annotation.fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        
        // Handle multiline text
        const lines = annotation.text.split('\n');
        const lineHeight = annotation.fontSize * 1.2;
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const words = line.split(' ');
            let currentLine = '';
            let y = annotation.y + 5 + (lineIndex * lineHeight); // Add small padding
            
            if (y > annotation.y + annotation.height - lineHeight) {
                break; // Stop if we've exceeded the height
            }
            
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > annotation.width - 10 && i > 0) {
                    ctx.fillText(currentLine, annotation.x + 5, y);
                    currentLine = words[i] + ' ';
                    y += lineHeight;
                    
                    // Check if we've exceeded the height
                    if (y > annotation.y + annotation.height - lineHeight) {
                        break;
                    }
                } else {
                    currentLine = testLine;
                }
            }
            
            // Draw the last line or single line if it fits
            ctx.fillText(currentLine, annotation.x + 5, y);
        }
        
        ctx.restore();
    }

    drawSelectionHandles(annotation, ctx) {
        ctx.save();
        
        // Draw selection outline
        ctx.strokeStyle = COLORS.TEXT_HIGHLIGHT;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        
        const centerX = annotation.x + annotation.width / 2;
        const centerY = annotation.y + annotation.height / 2;
        
        // Apply the same rotation as the text
        ctx.translate(centerX, centerY);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-centerX, -centerY);
        
        ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        // Draw handles using the pre-calculated positions from _getHandlePositions
        const handlePositions = this._getHandlePositions(annotation);
        ctx.setLineDash([]);
        
        // Since our handle positions are already rotated, we should restore the context first
        ctx.restore();
        ctx.save();
        
        // Check if Ctrl is pressed for font resize indicator
        const isCtrlPressed = this.state.isCtrlPressed && this.state.interactionMode === 'resizing';
        
        Object.values(handlePositions).forEach(pos => {
            if (pos.type === 'resize') {
                // Resize handle
                if (isCtrlPressed) {
                    // Special color when resizing font (Ctrl pressed)
                    ctx.fillStyle = 'rgba(255, 165, 0, 0.7)'; // Orange for font resize
                    ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
                } else {
                    ctx.fillStyle = COLORS.HANDLE_FILL;
                    ctx.strokeStyle = COLORS.HANDLE_STROKE;
                }
            } else {
                // Rotation handle
                ctx.fillStyle = COLORS.ROTATION_HANDLE_FILL;
                ctx.strokeStyle = COLORS.ROTATION_HANDLE_STROKE;
            }
            
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Show special indicator on handles when Ctrl is pressed
            if (isCtrlPressed && pos.type === 'resize') {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        ctx.restore();
    }

    _getTextCenter(annotation) {
        return {
            x: annotation.x + annotation.width / 2,
            y: annotation.y + annotation.height / 2
        };
    }

    _getHandlePositions(annotation) {
        const handles = {};
        const x = annotation.x;
        const y = annotation.y;
        const w = annotation.width;
        const h = annotation.height;
        const center = this._getTextCenter(annotation);
        const rotation = annotation.rotation || 0;
        
        // Corner handles (unrotated positions)
        const corners = {
            'tl': { x: x, y: y },
            'tr': { x: x + w, y: y },
            'bl': { x: x, y: y + h },
            'br': { x: x + w, y: y + h }
        };
        
        // Side handles (unrotated positions)
        const sides = {
            't': { x: x + w/2, y: y },
            'r': { x: x + w, y: y + h/2 },
            'b': { x: x + w/2, y: y + h },
            'l': { x: x, y: y + h/2 }
        };
        
        // Apply rotation to corner and side handles
        for (const [key, pos] of Object.entries({...corners, ...sides})) {
            // Using positive rotation to align with how the text box is rotated
            const rotated = rotatePoint(pos, center, rotation);
            handles[key] = { ...rotated, type: 'resize' };
        }
        
        // Add rotation handle (top-middle, offset above the text)
        const rotationHandleY = y - 20; // 20px above the top
        const rotationHandle = { x: x + w/2, y: rotationHandleY };
        // Using positive rotation to be consistent with other handles
        const rotatedRotationHandle = rotatePoint(rotationHandle, center, rotation);
        handles['rotate'] = { ...rotatedRotationHandle, type: 'rotation' };
        
        return handles;
    }

    deleteSelectedText() {
        if (this.state.selectedTextIndex !== null) {
            this.state.annotations.splice(this.state.selectedTextIndex, 1);
            this.state.selectedTextIndex = null;
            this.state.interactionMode = 'none';
            this.state.activeHandle = null;
            this.redrawAll();
        }
    }

    _showTooltip(message, x, y) {
        // Remove any existing tooltips
        this._removeTooltip();
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'text-tool-tooltip';
        tooltip.innerText = message;
        
        // Style the tooltip
        Object.assign(tooltip.style, {
            position: 'fixed',
            left: `${x + 15}px`,
            top: `${y + 15}px`,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: Z_INDEX.TOOLBAR + 1,
            transition: 'opacity 0.3s',
            opacity: '0.9'
        });
        
        // Add to DOM
        document.body.appendChild(tooltip);
        
        // Automatically hide after 3 seconds
        setTimeout(() => {
            this._removeTooltip();
        }, 3000);
    }
    
    _removeTooltip() {
        const tooltip = document.getElementById('text-tool-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    // Helper function to ensure color is in hex format
    _ensureHexColor(color) {
        // If it's already a hex color, return it
        if (color && color.startsWith('#')) {
            return color;
        }
        
        // Create a temporary element to convert named colors to hex
        const tempElem = document.createElement('div');
        tempElem.style.color = color || '#ff0000'; // Default to red if color is invalid
        document.body.appendChild(tempElem);
        
        // Get computed style (will convert named colors to rgb)
        const computedColor = window.getComputedStyle(tempElem).color;
        document.body.removeChild(tempElem);
        
        // Convert rgb to hex
        if (computedColor.startsWith('rgb')) {
            // Extract the RGB values
            const rgb = computedColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                // Convert to hex
                const hex = '#' + 
                    parseInt(rgb[0]).toString(16).padStart(2, '0') +
                    parseInt(rgb[1]).toString(16).padStart(2, '0') +
                    parseInt(rgb[2]).toString(16).padStart(2, '0');
                return hex;
            }
        }
        
        // If all else fails, return a safe default
        return '#ff0000';
    }
} 
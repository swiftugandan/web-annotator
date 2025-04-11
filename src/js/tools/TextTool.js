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

    //--- Event Handlers ---

    _handleKeyDown(e) {
        if (e.key === 'Control') {
            this.state.isCtrlPressed = true;
            if (this.state.interactionMode === 'resizing' && this.state.selectedTextIndex !== null) {
                this.redrawAll();
            }
        }
    }
    
    _handleKeyUp(e) {
        if (e.key === 'Control') {
            this.state.isCtrlPressed = false;
            if (this.state.interactionMode === 'resizing' && this.state.selectedTextIndex !== null) {
                this.redrawAll();
            }
        }
    }

    //--- Text Creation ---

    start(e) {
        this.createTextWidget(e.clientX, e.clientY);
    }

    update() {
        // Nothing to do during drag for text tool
    }

    stop() {
        // Nothing to do on mouse up for text tool
    }

    createTextWidget(x, y) {
        const textId = Date.now().toString();
        const newText = {
            type: 'text',
            id: textId,
            text: '',
            x,
            y,
            width: 200,
            height: 100,
            color: this._ensureHexColor(this.state.drawColor),
            fontSize: 16,
            rotation: 0,
            editable: true
        };

        this.state.annotations.push(newText);
        this._createTextEditWidget(newText);
        this.state.selectedTextIndex = this.state.annotations.length - 1;
        this.redrawAll();
    }

    _createTextEditWidget(textAnnotation) {
        this._removeTextEditWidget();
        
        const textWidget = document.createElement('div');
        textWidget.id = `text-widget-${textAnnotation.id}`;
        textWidget.contentEditable = true;
        this.activeTextWidgetId = textWidget.id;
        
        if (textAnnotation.text) {
            textWidget.innerText = textAnnotation.text;
        } else {
            textWidget.innerText = 'Type here...';
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(textWidget);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }, 10);
        }
        
        const centerX = textAnnotation.width / 2;
        const centerY = textAnnotation.height / 2;
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
            transformOrigin: `${centerX}px ${centerY}px`,
            outline: 'none'
        });
        
        document.body.appendChild(textWidget);
        
        setTimeout(() => {
            textWidget.focus();
            if (textAnnotation.text) {
                const range = document.createRange();
                range.selectNodeContents(textWidget);
                range.collapse(false);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }, 50);
        
        textWidget.addEventListener('blur', () => {
            this._saveTextContent(textAnnotation, textWidget);
            this._removeTextEditWidget();
            this.redrawAll();
        });
        
        textWidget.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                textWidget.blur();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textWidget.blur();
            }
        });
        
        textWidget.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    _saveTextContent(textAnnotation, textWidget) {
        let content = textWidget.innerText.trim();
        
        if (content === 'Type here...') {
            content = '';
        }
        
        textAnnotation.text = content;
        textAnnotation.editable = false;
        
        if (!content) {
            const index = this.state.annotations.findIndex(a => 
                a.type === 'text' && a.id === textAnnotation.id);
            
            if (index !== -1) {
                this.state.annotations.splice(index, 1);
                if (this.state.selectedTextIndex === index) {
                    this.state.selectedTextIndex = null;
                } else if (this.state.selectedTextIndex > index) {
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

        if (this._isInteractingWithWidget(e)) {
            return true;
        }

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
                    this._showTooltip("Hold Ctrl while resizing to adjust font size", mouseX, mouseY);
                }
                return true;
            }
            
            if (this._isPointInsideText(mouseX, mouseY, selectedText)) {
                if (e.detail === 2) {
                    this._createTextEditWidget(selectedText);
                    return true;
                }
                this.state.interactionMode = 'moving';
                return true;
            }
        }

        const clickedTextIndex = this.getTextAtPoint(mouseX, mouseY);
        if (clickedTextIndex !== null) {
            const text = this.state.annotations[clickedTextIndex];
            this.state.selectedTextIndex = clickedTextIndex;
            
            if (e.detail === 2) {
                this._createTextEditWidget(text);
            } else {
                this.state.interactionMode = 'moving';
            }
            
            this.redrawAll();
            return true;
        }

        this.state.selectedTextIndex = null;
        this.state.interactionMode = 'none';
        this.start(e);
        return true;
    }

    _isInteractingWithWidget(e) {
        if (this.activeTextWidgetId) {
            const widget = document.getElementById(this.activeTextWidgetId);
            if (widget && widget.contains(e.target)) {
                return true;
            }
        }
        return false;
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

        this.state.dragStartX = mouseX;
        this.state.dragStartY = mouseY;
    }

    stopInteraction(e) {
        if (['moving', 'resizing', 'rotating'].includes(this.state.interactionMode)) {
            this.state.interactionMode = 'none';
            this.state.activeHandle = null;
            this.controller.canvasManager.updateCursor(e.clientX, e.clientY);
            this._removeTooltip();
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
        
        const originalWidth = text.width;
        const originalHeight = text.height;
        const originalFontSize = text.fontSize;
        
        const lastUnrotated = rotatePoint(
            { x: this.state.dragStartX, y: this.state.dragStartY }, 
            center, 
            -rotation
        );
        const currentUnrotated = rotatePoint(
            { x: mouseX, y: mouseY }, 
            center, 
            -rotation
        );
        const dx = currentUnrotated.x - lastUnrotated.x;
        const dy = currentUnrotated.y - lastUnrotated.y;
        
        // Calculate corners in unrotated space
        let x1 = text.x;
        let y1 = text.y;
        let x2 = text.x + text.width;
        let y2 = text.y + text.height;
        
        this._applyHandleResize(handle, dx, dy, x1, y1, x2, y2, text);
        
        if (isCtrlPressed) {
            this._adjustFontSize(text, originalWidth, originalHeight, originalFontSize);
        }
        
        this.redrawAll();
    }

    _applyHandleResize(handle, dx, dy, x1, y1, x2, y2, text) {
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
    }

    _adjustFontSize(text, originalWidth, originalHeight, originalFontSize) {
        const widthRatio = text.width / originalWidth;
        const heightRatio = text.height / originalHeight;
        const scaleRatio = (widthRatio + heightRatio) / 2;
        
        const newFontSize = originalFontSize * scaleRatio;
        const minFontSize = 8;
        const maxFontSize = 72;
        
        text.fontSize = Math.max(minFontSize, Math.min(maxFontSize, newFontSize));
    }

    _rotateText(mouseX, mouseY) {
        const text = this.state.annotations[this.state.selectedTextIndex];
        const center = this.state.textCenter || this._getTextCenter(text);

        const prevAngle = Math.atan2(
            this.state.dragStartY - center.y, 
            this.state.dragStartX - center.x
        );
        const currentAngle = Math.atan2(
            mouseY - center.y, 
            mouseX - center.x
        );
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
        const handleSize = 8;
        
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
        if (!text.rotation) {
            return (
                x >= text.x &&
                x <= text.x + text.width &&
                y >= text.y &&
                y <= text.y + text.height
            );
        }
        
        const center = this._getTextCenter(text);
        const rotatedPoint = rotatePoint({ x, y }, center, -text.rotation);
        
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
            this._drawEmptyTextBox(annotation, ctx);
            return; 
        }
        
        ctx.save();
        
        const centerX = annotation.x + annotation.width / 2;
        const centerY = annotation.y + annotation.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-centerX, -centerY);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        this._drawTextContent(annotation, ctx);
        
        ctx.restore();
    }

    _drawEmptyTextBox(annotation, ctx) {
        // Only draw placeholder if selected
        if (annotation !== this.state.annotations[this.state.selectedTextIndex]) {
            return;
        }
        
        ctx.save();
        
        const centerX = annotation.x + annotation.width / 2;
        const centerY = annotation.y + annotation.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-centerX, -centerY);
        
        ctx.strokeStyle = this._ensureHexColor(annotation.color);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        ctx.fillStyle = this._ensureHexColor(annotation.color);
        ctx.font = `${annotation.fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText("Text", centerX, centerY);
        
        ctx.restore();
    }

    _drawTextContent(annotation, ctx) {
        ctx.fillStyle = this._ensureHexColor(annotation.color);
        ctx.font = `${annotation.fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        
        const lines = annotation.text.split('\n');
        const lineHeight = annotation.fontSize * 1.2;
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const words = line.split(' ');
            let currentLine = '';
            let y = annotation.y + 5 + (lineIndex * lineHeight);
            
            if (y > annotation.y + annotation.height - lineHeight) {
                break;
            }
            
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > annotation.width - 10 && i > 0) {
                    ctx.fillText(currentLine, annotation.x + 5, y);
                    currentLine = words[i] + ' ';
                    y += lineHeight;
                    
                    if (y > annotation.y + annotation.height - lineHeight) {
                        break;
                    }
                } else {
                    currentLine = testLine;
                }
            }
            
            ctx.fillText(currentLine, annotation.x + 5, y);
        }
    }

    drawSelectionHandles(annotation, ctx) {
        ctx.save();
        
        ctx.strokeStyle = COLORS.TEXT_HIGHLIGHT;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        
        const centerX = annotation.x + annotation.width / 2;
        const centerY = annotation.y + annotation.height / 2;
        
        ctx.translate(centerX, centerY);
        ctx.rotate(annotation.rotation || 0);
        ctx.translate(-centerX, -centerY);
        
        ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        
        const handlePositions = this._getHandlePositions(annotation);
        ctx.setLineDash([]);
        
        ctx.restore();
        ctx.save();
        
        const isCtrlPressed = this.state.isCtrlPressed && this.state.interactionMode === 'resizing';
        
        Object.values(handlePositions).forEach(pos => {
            if (pos.type === 'resize') {
                if (isCtrlPressed) {
                    ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
                    ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
                } else {
                    ctx.fillStyle = COLORS.HANDLE_FILL;
                    ctx.strokeStyle = COLORS.HANDLE_STROKE;
                }
            } else {
                ctx.fillStyle = COLORS.ROTATION_HANDLE_FILL;
                ctx.strokeStyle = COLORS.ROTATION_HANDLE_STROKE;
            }
            
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
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
            'tl': { x, y },
            'tr': { x: x + w, y },
            'bl': { x, y: y + h },
            'br': { x: x + w, y: y + h }
        };
        
        // Side handles (unrotated positions)
        const sides = {
            't': { x: x + w/2, y },
            'r': { x: x + w, y: y + h/2 },
            'b': { x: x + w/2, y: y + h },
            'l': { x, y: y + h/2 }
        };
        
        // Apply rotation to corner and side handles
        for (const [key, pos] of Object.entries({...corners, ...sides})) {
            const rotated = rotatePoint(pos, center, rotation);
            handles[key] = { ...rotated, type: 'resize' };
        }
        
        // Add rotation handle
        const rotationHandleY = y - 20;
        const rotationHandle = { x: x + w/2, y: rotationHandleY };
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
        this._removeTooltip();
        
        const tooltip = document.createElement('div');
        tooltip.id = 'text-tool-tooltip';
        tooltip.innerText = message;
        
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
        
        document.body.appendChild(tooltip);
        
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

    _ensureHexColor(color) {
        if (color && color.startsWith('#')) {
            return color;
        }
        
        const tempElem = document.createElement('div');
        tempElem.style.color = color || '#ff0000';
        document.body.appendChild(tempElem);
        
        const computedColor = window.getComputedStyle(tempElem).color;
        document.body.removeChild(tempElem);
        
        if (computedColor.startsWith('rgb')) {
            const rgb = computedColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const hex = '#' + 
                    parseInt(rgb[0]).toString(16).padStart(2, '0') +
                    parseInt(rgb[1]).toString(16).padStart(2, '0') +
                    parseInt(rgb[2]).toString(16).padStart(2, '0');
                return hex;
            }
        }
        
        return '#ff0000';
    }
} 
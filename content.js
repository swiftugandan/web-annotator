// Prevent multiple injections
if (window.__annotatorInjected) {
    console.log('Annotator already injected. Close existing instance first.');
} else {
    window.__annotatorInjected = true;
    console.log('Injecting Annotator...');

    // Dynamically import the controller
    import(chrome.runtime.getURL('src/js/core/AnnotatorController.js'))
        .then(({ AnnotatorController }) => {
            // Instantiate the main controller to start the application
            new AnnotatorController();
        })
        .catch(error => {
            console.error('Failed to load AnnotatorController:', error);
            window.__annotatorInjected = false; // Reset flag on failure
        });
}

(async function() {
  // Avoid multiple injections
  if (window.__annotatorInjected) return;
  window.__annotatorInjected = true;

  // Constants
  const COLORS = {
    ACTIVE_BUTTON: '#ea4335',
    INACTIVE_BUTTON: '#4285f4'
  };

  const TOOLS = {
    DRAW: 'draw',
    TEXT: 'text',
    ERASER: 'eraser',
    SHAPES: 'shapes'
  };

  // Create button style
  const buttonStyle = `
    margin: 0;
    padding: 10px 15px;
    cursor: pointer;
    background: ${COLORS.INACTIVE_BUTTON};
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    font-size: 14px;
    transition: background 0.2s;
  `;

  // Import modules
  try {
    const { createTextWidget, removeTextWidget, setAnnotations, setRedrawFunction } = await import(chrome.runtime.getURL('js/textWidget.js'));
    const { createUIElements, Z_INDEX } = await import(chrome.runtime.getURL('js/uiElements.js'));
    const { startDrawing, draw, redrawAnnotations, startShape, updateShape, endShape, drawShape, getShapeAtPoint, getResizeHandleAtPoint, getInteractionHandleAtPoint } = await import(chrome.runtime.getURL('js/drawingTools.js'));

    // State management
    const state = {
      isDrawing: false,
      isDrawingShape: false,
      currentShapeType: 'rectangle', // Default shape type
      shapeStartX: 0,
      shapeStartY: 0,
      lastX: 0,
      lastY: 0,
      drawColor: 'red',
      drawWidth: 3,
      eraserWidth: 20,
      tool: TOOLS.DRAW,
      annotations: [],
      activeTextWidget: null,
      isDraggingText: false,
      activeTextAnnotation: null,
      textOffsetX: 0,
      textOffsetY: 0,
      isDraggingToolbar: false,
      toolbarOffsetX: 0,
      toolbarOffsetY: 0,
      // New state for shape interaction
      selectedShapeIndex: null,
      interactionMode: 'none', // 'none', 'moving', 'resizing', 'rotating'
      resizeHandle: null,      // 'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'
      activeHandle: null,      // Stores the handle being interacted with ('tl', 'tr', ..., 'rotate')
      dragStartX: 0,
      dragStartY: 0,
      shapeCenter: { x: 0, y: 0 } // Store center for rotation
    };

    // Initialize UI elements
    const elements = createUIElements(buttonStyle, COLORS, TOOLS);
    
    // Share state with modules
    setAnnotations(state.annotations);
    
    // Create a wrapped redraw function that includes needed state
    const redrawAll = () => {
      // Pass selectedShapeIndex to redrawAnnotations
      redrawAnnotations(elements.ctx, state.annotations, state, elements.canvas, state.selectedShapeIndex);
    };
    
    // Share redraw function with text widget module
    setRedrawFunction(redrawAll);
    
    // Setup event listeners
    setupEventListeners();
    
    // Highlight default tool
    highlightButton(state.tool);

    // Event listeners setup
    function setupEventListeners() {
      setupToolbarDrag();
      setupCanvasEvents();
      setupToolbarButtons();
      setupKeyboardShortcuts();
      setupWindowResize();
    }

    function setupToolbarDrag() {
      elements.toolbar.addEventListener('mousedown', handleToolbarMouseDown);
      document.addEventListener('mousemove', handleToolbarMouseMove);
      document.addEventListener('mouseup', handleToolbarMouseUp);
    }

    function setupCanvasEvents() {
      elements.canvas.addEventListener('mousedown', handleCanvasMouseDown);
      elements.canvas.addEventListener('mousemove', handleCanvasMouseMove);
      elements.canvas.addEventListener('mouseup', handleCanvasMouseUp);
      elements.canvas.addEventListener('mouseout', handleCanvasMouseUp);
    }

    function setupToolbarButtons() {
      document.getElementById(TOOLS.DRAW).onclick = () => setActiveTool(TOOLS.DRAW);
      document.getElementById(TOOLS.TEXT).onclick = () => setActiveTool(TOOLS.TEXT);
      document.getElementById(TOOLS.ERASER).onclick = () => setActiveTool(TOOLS.ERASER);
      document.getElementById(TOOLS.SHAPES).onclick = () => setActiveTool(TOOLS.SHAPES);
      document.getElementById('clear').onclick = clearAnnotations;
      document.getElementById('close').onclick = closeAnnotator;
      document.getElementById('color-picker').onchange = (e) => {
        state.drawColor = e.target.value;
      };

      // Create shape submenu
      createShapesSubmenu();
    }

    function createShapesSubmenu() {
      const submenu = document.createElement('div');
      submenu.id = 'shapes-submenu';
      Object.assign(submenu.style, {
        position: 'absolute',
        top: '100%',
        left: `${document.getElementById(TOOLS.SHAPES).offsetLeft}px`,
        background: '#2c2c2c',
        padding: '5px',
        borderRadius: '5px',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        display: 'none',
        zIndex: Z_INDEX.TOOLBAR
      });

      submenu.innerHTML = `
        <button id="shape-rectangle" style="${buttonStyle}">Rectangle</button>
        <button id="shape-circle" style="${buttonStyle}">Circle</button>
        <button id="shape-line" style="${buttonStyle}">Line</button>
        <button id="shape-arrow" style="${buttonStyle}">Arrow</button>
      `;

      elements.toolbar.appendChild(submenu);

      // Event listeners for shape buttons
      document.getElementById('shape-rectangle').onclick = () => {
        state.currentShapeType = 'rectangle';
        submenu.style.display = 'none';
      };
      document.getElementById('shape-circle').onclick = () => {
        state.currentShapeType = 'circle';
        submenu.style.display = 'none';
      };
      document.getElementById('shape-line').onclick = () => {
        state.currentShapeType = 'line';
        submenu.style.display = 'none';
      };
      document.getElementById('shape-arrow').onclick = () => {
        state.currentShapeType = 'arrow';
        submenu.style.display = 'none';
      };

      // Toggle submenu visibility when shapes tool is selected
      document.getElementById(TOOLS.SHAPES).addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the click from being handled elsewhere
        const display = submenu.style.display === 'none' ? 'block' : 'none';
        submenu.style.display = display;
        // Deselect shape if opening shape menu
        if (display === 'block') {
            state.selectedShapeIndex = null;
            state.interactionMode = 'none';
            redrawAll();
        }
      });

      // Close submenu when clicking elsewhere
      document.addEventListener('click', function(e) {
        if (!submenu.contains(e.target) && e.target.id !== TOOLS.SHAPES) {
          submenu.style.display = 'none';
        }
      });
    }

    function setupKeyboardShortcuts() {
      document.addEventListener('keydown', handleKeyDown);
    }

    function setupWindowResize() {
      window.addEventListener('resize', handleWindowResize);
    }

    // Event handlers
    function handleToolbarMouseDown(e) {
      if (e.target === elements.toolbar) {
        state.isDraggingToolbar = true;
        state.toolbarOffsetX = e.clientX - elements.toolbar.getBoundingClientRect().left;
        state.toolbarOffsetY = e.clientY - elements.toolbar.getBoundingClientRect().top;
        elements.toolbar.style.cursor = 'grabbing';
      }
    }

    function handleToolbarMouseMove(e) {
      if (state.isDraggingToolbar) {
        elements.toolbar.style.transform = 'none';
        elements.toolbar.style.left = (e.clientX - state.toolbarOffsetX) + 'px';
        elements.toolbar.style.top = (e.clientY - state.toolbarOffsetY) + 'px';
      }
    }

    function handleToolbarMouseUp() {
      if (state.isDraggingToolbar) {
        state.isDraggingToolbar = false;
        elements.toolbar.style.cursor = 'move';
      }
    }

    function handleCanvasMouseDown(e) {
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      state.dragStartX = mouseX;
      state.dragStartY = mouseY;

      if (state.tool === TOOLS.SHAPES && state.selectedShapeIndex !== null) {
        // Check if clicking on a resize handle of the selected shape
        const handle = getInteractionHandleAtPoint(mouseX, mouseY, state.annotations[state.selectedShapeIndex], elements.ctx);
        if (handle) {
          state.activeHandle = handle;
          if (handle === 'rotate') {
            state.interactionMode = 'rotating';
            // Store shape center for rotation calculation
            const shape = state.annotations[state.selectedShapeIndex];
            state.shapeCenter = {
              x: shape.startX + (shape.endX - shape.startX) / 2,
              y: shape.startY + (shape.endY - shape.startY) / 2
            };
          } else {
            state.interactionMode = 'resizing';
          }
          e.stopPropagation(); // Prevent starting a new shape
          return;
        }
      }

      if (state.tool === TOOLS.SHAPES) {
        // Check if clicking on any shape
        const clickedShapeIndex = getShapeAtPoint(mouseX, mouseY, state.annotations, elements.ctx);

        if (clickedShapeIndex !== null) {
          state.selectedShapeIndex = clickedShapeIndex;
          state.interactionMode = 'moving';
          redrawAll(); // Show selection
          e.stopPropagation(); // Prevent starting a new shape
          return;
        } else {
          // Clicked on empty space while SHAPES tool is active
          state.selectedShapeIndex = null; // Deselect
          state.interactionMode = 'none';
          // Fall through to start drawing a new shape
           startShape(e, state, state.annotations); // Start new shape drawing
           redrawAll(); // Ensure deselection is visually cleared
        }
      } else if (state.tool === TOOLS.DRAW || state.tool === TOOLS.ERASER) {
         state.selectedShapeIndex = null; // Deselect if drawing or erasing
         state.interactionMode = 'none';
         redrawAll();
         startDrawing(e, state, state.annotations);
      } else if (state.tool === TOOLS.TEXT) {
         state.selectedShapeIndex = null; // Deselect if using text tool
         state.interactionMode = 'none';
         redrawAll();
         handleTextInteraction(e);
      } else {
        // Other tools or scenarios might deselect
        state.selectedShapeIndex = null;
        state.interactionMode = 'none';
        redrawAll();
      }
    }

    function handleCanvasMouseMove(e) {
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      if (state.interactionMode === 'moving' && state.selectedShapeIndex !== null) {
        const shape = state.annotations[state.selectedShapeIndex];
        const dx = mouseX - state.dragStartX;
        const dy = mouseY - state.dragStartY;

        shape.startX += dx;
        shape.startY += dy;
        shape.endX += dx;
        shape.endY += dy;

        state.dragStartX = mouseX; // Update drag start for next move event
        state.dragStartY = mouseY;
        redrawAll();
      } else if (state.interactionMode === 'resizing' && state.selectedShapeIndex !== null) {
        const shape = state.annotations[state.selectedShapeIndex];
        const dx = mouseX - state.dragStartX;
        const dy = mouseY - state.dragStartY;

        if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
            // Special handling for resizing lines/arrows: modify start OR end point
            switch (state.activeHandle) {
                // Handles modifying the START point
                case 'tl': shape.startX += dx; shape.startY += dy; break;
                case 't':  shape.startY += dy; break;
                case 'l':  shape.startX += dx; break;
                case 'bl': shape.startX += dx; shape.startY += dy; break; // Treat BL as moving start point

                // Handles modifying the END point
                case 'tr': shape.endX += dx; shape.endY += dy; break; // Treat TR as moving end point
                case 'br': shape.endX += dx; shape.endY += dy; break;
                case 'b':  shape.endY += dy; break;
                case 'r':  shape.endX += dx; break;
            }
        } else {
            // Original logic for rectangles/circles
            // Adjust coordinates based on the handle being dragged
            switch (state.activeHandle) {
                case 'tl':
                    shape.startX += dx;
                    shape.startY += dy;
                    break;
                case 'tr':
                    shape.endX += dx;
                    shape.startY += dy;
                    break;
                case 'bl':
                    shape.startX += dx;
                    shape.endY += dy;
                    break;
                case 'br':
                    shape.endX += dx;
                    shape.endY += dy;
                    break;
                case 't':
                     shape.startY += dy;
                     break;
                case 'b':
                     shape.endY += dy;
                     break;
                case 'l':
                     shape.startX += dx;
                     break;
                case 'r':
                     shape.endX += dx;
                     break;
            }
        }
         // Prevent shape inversion (width/height becoming negative)
         // This normalization is primarily for rect/circle during drag, might remove if causing issues
         if (shape.shapeType === 'rectangle' || shape.shapeType === 'circle') {
             if (shape.endX < shape.startX) [shape.startX, shape.endX] = [shape.endX, shape.startX];
             if (shape.endY < shape.startY) [shape.startY, shape.endY] = [shape.endY, shape.startY];
         }

        state.dragStartX = mouseX; // Update drag start for next move event
        state.dragStartY = mouseY;
        redrawAll();
      } else if (state.interactionMode === 'rotating' && state.selectedShapeIndex !== null) {
        const shape = state.annotations[state.selectedShapeIndex];

        // Calculate angle from center to previous mouse position
        const prevAngle = Math.atan2(state.dragStartY - state.shapeCenter.y, state.dragStartX - state.shapeCenter.x);
        // Calculate angle from center to current mouse position
        const currentAngle = Math.atan2(mouseY - state.shapeCenter.y, mouseX - state.shapeCenter.x);

        // Calculate the change in angle
        const deltaAngle = currentAngle - prevAngle;

        // Update shape rotation (add delta angle)
        shape.rotation = (shape.rotation || 0) + deltaAngle;

        // Update drag start for next calculation
        state.dragStartX = mouseX;
        state.dragStartY = mouseY;

        redrawAll();
      } else if (state.isDraggingText) {
        dragText(e);
      } else if (state.isDrawing) {
        draw(e, state, elements.ctx, state.annotations);
      } else if (state.isDrawingShape) {
        updateShape(e, state, elements.ctx, state.annotations);
      } else {
         // Update cursor based on hover state when not interacting
         updateCursor(mouseX, mouseY);
      }
    }

    function handleCanvasMouseUp() {
      if (['moving', 'resizing', 'rotating'].includes(state.interactionMode)) {
        // Finalize move/resize - Ensure width/height are positive if needed
        if (state.selectedShapeIndex !== null) {
             const shape = state.annotations[state.selectedShapeIndex];
             // Normalize rectangle/circle coordinates after resize/move
             if ((shape.shapeType === 'rectangle' || shape.shapeType === 'circle') && state.interactionMode === 'resizing' && !(shape.rotation)) {
                 // TODO: Properly normalize coordinates after resizing a rotated shape
                 const x1 = Math.min(shape.startX, shape.endX);
                 const y1 = Math.min(shape.startY, shape.endY);
                 const x2 = Math.max(shape.startX, shape.endX);
                 const y2 = Math.max(shape.startY, shape.endY);
                 shape.startX = x1;
                 shape.startY = y1;
                 shape.endX = x2;
                 shape.endY = y2;
             }
             redrawAll(); // Redraw with normalized coords
         }
        state.interactionMode = 'none';
        state.activeHandle = null;
         updateCursor(state.dragStartX, state.dragStartY); // Update cursor based on final position

      } else if (state.isDraggingText) {
        state.isDraggingText = false;
        state.activeTextAnnotation = null;
        elements.canvas.style.cursor = 'default';
      } else if (state.isDrawing) {
        state.isDrawing = false;
      } else if (state.isDrawingShape) {
        endShape(state); // Finalize the newly drawn shape
        // Select the newly drawn shape
        state.selectedShapeIndex = state.annotations.length - 1;
        state.interactionMode = 'none'; // Ready for moving/resizing
        redrawAll(); // Show selection handles on the new shape
         updateCursor(state.lastX, state.lastY);
      }
    }

    function handleKeyDown(e) {
      const isDeletionKey = e.key === 'Delete' || e.key === 'Backspace';

      if (isDeletionKey && state.selectedShapeIndex !== null) {
         // Delete selected shape
         state.annotations.splice(state.selectedShapeIndex, 1);
         state.selectedShapeIndex = null;
         state.interactionMode = 'none';
         redrawAll();
         elements.canvas.style.cursor = 'default'; // Reset cursor
      } else if (isDeletionKey && state.isDraggingText && state.activeTextAnnotation) {
        deleteActiveTextAnnotation();
      }
    }

    function handleWindowResize() {
      const tempAnnotations = [...state.annotations];
      elements.canvas.width = window.innerWidth;
      elements.canvas.height = window.innerHeight;
      state.annotations = tempAnnotations;
      redrawAll();
    }

    // Tool actions
    function setActiveTool(toolName) {
      highlightButton(toolName);
      state.tool = toolName;
      
      // Update cursor based on tool
      if (toolName === TOOLS.ERASER) {
        const eraserCursorBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Jn7/QeGAr9CPTJ/EFgUI9ARR5RGTudnn3q89vVNBihLK+eLrXRxQ+J96dOqM9y2fVbyewwduLg5/PtR/i98zfeQ5ELqIXQ4ueL1E/VHMtS9V72fZt2tf0yOg/2N+4Jz+4X7+kP8Xeg/wHdDfGVg5z2L+uuaedm6vdS9e/4L+yr6p/TT9av6b/R/t3/i8Cf4JPhHaOfkZP5JXnP+ZX8n8uXPLn4+fm2/eP3/1P/n/yANyAT0B3AAAAHNQTFRFAAAA////////////////////////////////////////////////////////////////////////////////////////////////////////////iuBoOwAAABJ0Uk5TAA0zP0tYYG9whZSlxM7f8P2Coc7sAAAB6UlEQVR42rWW63qkIAyFERUUFQSct+X9n3OLjr3Y0TbwZ9nFt03IyQGTwPinmLl1IRzSdvBYgaD3q6xIkAUE6g9QkDxUoLV+A1WAj4oRreCcnKRAmxULKUj9CXaL2JwD5W+guq+joCIgVHAXdRkVRCALCFXcYC+jIAlKQKji9tPZKXAV7Z9iiQXI33J5e61iZYDrWmtXNXcSdRUAY7SzEbXWCeVALyDOerp0mguQ3QD2MqvXJRbw4J4ShHVH+8hAp/qxxGwVaFFtACt6oADDMvqVlAOqv0DBIp3ThofMK39JGHoFkf6oEwD3xJGj+FhPcz0EKXwCM/q9Zui6VG84L4D4oSdAw83rM4CG8XU9BeDsD6iOD0A69QcoN0AMZtLPAJJ5aF+AdExYXwGcf4J80AjA9gH0Ww1gM93afQYYKnj1qKHHbfYXgBVcDzAjYFFT2ILWbwBLX3owqR5WALiESTk+Hgc7nFUbRgEwdYSdQPbLlgLQ9Y5CxU43rQCwZwPzOu+FbgT36HQGGMZHYxfATK975AAuKUdvdzBh9iwLwE0BfzlMHeCXOlkA6OWM/3UG+AWa0NfgXB2G9m+QcEhLXsBd5wqArmA23EEQIXprbR5gnwcRmhXM8z7tG/4B6VIj8oIUpjIAAAAASUVORK5CYII=';
        elements.canvas.style.cursor = `url(${eraserCursorBase64}) 12 12, auto`;
      } else if (toolName === TOOLS.DRAW) {
        elements.canvas.style.cursor = 'crosshair';
      } else if (toolName === TOOLS.SHAPES) {
        // Don't set cursor immediately, wait for mouse move to determine if over shape/handle
        updateCursor(state.lastX, state.lastY); // Set initial cursor based on last known position
      } else {
        elements.canvas.style.cursor = 'default';
      }
       // Deselect shape when changing tools away from SHAPES
       if (toolName !== TOOLS.SHAPES) {
           state.selectedShapeIndex = null;
           state.interactionMode = 'none';
           redrawAll();
       }
    }

    // Add a function to update cursor based on context
    function updateCursor(mouseX, mouseY) {
        if (state.tool !== TOOLS.SHAPES || state.isDrawingShape || state.interactionMode !== 'none') {
            // Default cursors for other tools or during active interaction/drawing
            if (state.tool === TOOLS.DRAW || state.isDrawingShape) elements.canvas.style.cursor = 'crosshair';
            else if (state.tool === TOOLS.ERASER) elements.canvas.style.cursor = `url(${eraserCursorBase64}) 12 12, auto`;
            else if (state.interactionMode === 'moving') elements.canvas.style.cursor = 'move';
            // Add specific resize cursors if needed later
            else if (state.interactionMode === 'resizing') elements.canvas.style.cursor = 'crosshair'; // Placeholder
            else if (state.interactionMode === 'rotating') elements.canvas.style.cursor = 'grabbing'; // Or a specific rotation cursor
            else elements.canvas.style.cursor = 'default';
            return;
        }

        // Check for hover over selected shape's handles first
        if (state.selectedShapeIndex !== null) {
            const handle = getInteractionHandleAtPoint(mouseX, mouseY, state.annotations[state.selectedShapeIndex], elements.ctx);
            if (handle) {
                // Set cursor based on handle position (e.g., nwse-resize, nesw-resize, etc.)
                // Simplified for now:
                if (handle === 'rotate') {
                  elements.canvas.style.cursor = 'grab'; // Indicate rotatable handle
                } else {
                   elements.canvas.style.cursor = 'pointer'; // Indicate resize handle
                }
                return;
            }
        }

        // Check for hover over any shape
        const hoveredShapeIndex = getShapeAtPoint(mouseX, mouseY, state.annotations, elements.ctx);
        if (hoveredShapeIndex !== null) {
            elements.canvas.style.cursor = 'move'; // Indicate movable shape
        } else {
            elements.canvas.style.cursor = 'crosshair'; // Default for drawing new shape
        }
    }

    function clearAnnotations() {
      // Remove any active text widget first
      removeTextWidget();

      // Clear canvas and annotations array
      elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
      state.annotations.length = 0;

      // Reset drawing/interaction states
      state.isDrawing = false;
      state.isDrawingShape = false;
      state.isDraggingText = false;
      state.activeTextAnnotation = null;
      state.selectedShapeIndex = null; // Clear selection
      state.interactionMode = 'none';
      state.activeHandle = null;
      
      // Optionally reset the tool to default and update UI
      // setActiveTool(TOOLS.DRAW); // Resets tool, cursor, and highlights Draw button
      // Or just reset highlight if keeping the tool state is preferred:
      highlightButton(state.tool); // Re-highlight the current tool instead of 'Clear'
    }

    function closeAnnotator() {
      removeTextWidget();
      elements.overlay.remove();
      elements.toolbar.remove();
      elements.blocker.remove();
      window.__annotatorInjected = false;
    }

    function highlightButton(buttonId) {
      const buttons = elements.toolbar.querySelectorAll('button');
      buttons.forEach(button => {
        button.style.background = button.id === buttonId ? 
          COLORS.ACTIVE_BUTTON : COLORS.INACTIVE_BUTTON;
      });
    }
  } catch (error) {
    console.error('Failed to load annotation modules:', error);
  }
})(); 
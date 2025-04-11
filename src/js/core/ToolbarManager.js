import { COLORS, TOOLS, SHAPE_TYPES, Z_INDEX } from '../utils/constants.js';

/**
 * Manages the toolbar UI, including button creation, event listeners,
 * and drag functionality.
 */
export class ToolbarManager {
  constructor(controller) {
    this.controller = controller;
    this.state = controller.state; // Access shared state
    this.elements = {}; // To store references to UI elements
    this.isCollapsed = false; // Track toolbar collapse state
    this.buttonStyle = `
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

    this.createToolbar();
    this.setupToolbarDrag();
    this.setupToolbarButtons();
    this.createShapesSubmenu();
    this.highlightButton(this.state.tool);
  }

  createToolbar() {
    this.elements.toolbar = document.createElement('div');
    this.elements.toolbar.id = 'annotator-toolbar';
    Object.assign(this.elements.toolbar.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(40, 40, 40, 0.9)',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      zIndex: Z_INDEX.TOOLBAR,
      display: 'flex',
      gap: '5px',
      cursor: 'move',
      transition: 'all 0.3s ease'
    });

    this.elements.toolbarContent = document.createElement('div');
    this.elements.toolbarContent.style.display = 'flex';
    this.elements.toolbarContent.style.gap = '5px';
    this.elements.toolbarContent.style.alignItems = 'center';
    
    this.elements.toolbarContent.innerHTML = `
      <button id="${TOOLS.DRAW}" style="${this.buttonStyle}">Draw</button>
      <button id="${TOOLS.SHAPES}" style="${this.buttonStyle}">Shapes</button>
      <button id="${TOOLS.TEXT}" style="${this.buttonStyle}">Text</button>
      <button id="${TOOLS.ERASER}" style="${this.buttonStyle}">Eraser</button>
      <input type="color" id="color-picker" value="${this.state.drawColor}" style="margin-left: 10px; cursor: pointer; height: 35px;" title="Select Color">
      <button id="clear" style="${this.buttonStyle} background: #f4b400; margin-left: 10px;">Clear</button>
      <button id="close" style="${this.buttonStyle} background: #db4437; margin-left: 5px;">Close</button>
    `;
    
    // Create toggle button for collapse/expand
    this.elements.toggleButton = document.createElement('button');
    this.elements.toggleButton.id = 'toggle-toolbar';
    this.elements.toggleButton.innerHTML = '&laquo;'; // Left-pointing double angle quotation mark
    Object.assign(this.elements.toggleButton.style, {
      background: COLORS.INACTIVE_BUTTON,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      marginLeft: '5px',
      width: '25px',
      height: '35px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 'bold'
    });
    
    this.elements.toolbar.appendChild(this.elements.toolbarContent);
    this.elements.toolbar.appendChild(this.elements.toggleButton);
    document.body.appendChild(this.elements.toolbar);
    
    // Store references to buttons
    this.elements.toolbarContent.querySelectorAll('button').forEach(btn => {
      this.elements[btn.id] = btn;
    });
    this.elements.colorPicker = this.elements.toolbarContent.querySelector('#color-picker');
    
    // Set up toggle button
    this.elements.toggleButton.addEventListener('click', this.toggleToolbar.bind(this));
  }

  toggleToolbar() {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      // Collapse the toolbar
      this.elements.toolbarContent.style.display = 'none';
      this.elements.toggleButton.innerHTML = '&raquo;'; // Right-pointing double angle quotation mark
      // Make toolbar more compact when collapsed
      this.elements.toolbar.style.padding = '8px 8px';
    } else {
      // Expand the toolbar
      this.elements.toolbarContent.style.display = 'flex';
      this.elements.toggleButton.innerHTML = '&laquo;'; // Left-pointing double angle quotation mark
      this.elements.toolbar.style.padding = '8px';
    }
    
    // If the toolbar was centered, reset position after collapse/expand
    if (this.elements.toolbar.style.transform.includes('translateX')) {
      // Let the browser repaint before recalculating center position
      setTimeout(() => {
        // Only recenter if the toolbar hasn't been manually dragged
        if (this.elements.toolbar.style.transform.includes('translateX')) {
          this.elements.toolbar.style.left = '50%';
        }
      }, 50);
    }
  }

  setupToolbarDrag() {
    this.elements.toolbar.addEventListener('mousedown', this.handleToolbarMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleToolbarMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleToolbarMouseUp.bind(this));
  }

  setupToolbarButtons() {
    this.elements[TOOLS.DRAW].onclick = () => this.controller.setActiveTool(TOOLS.DRAW);
    this.elements[TOOLS.ERASER].onclick = () => this.controller.setActiveTool(TOOLS.ERASER);
    this.elements[TOOLS.TEXT].onclick = () => this.controller.setActiveTool(TOOLS.TEXT);
    this.elements[TOOLS.SHAPES].onclick = (e) => {
        this.controller.setActiveTool(TOOLS.SHAPES);
        this.toggleShapesSubmenu(e);
    };
    this.elements.clear.onclick = () => this.controller.clearAnnotations();
    this.elements.close.onclick = () => this.controller.closeAnnotator();
    this.elements.colorPicker.onchange = (e) => {
      this.state.drawColor = e.target.value;
      // Optionally update shape color if one is selected
      if (this.state.selectedShapeIndex !== null) {
          const selectedShape = this.state.annotations[this.state.selectedShapeIndex];
          if (selectedShape) {
              selectedShape.color = this.state.drawColor;
              this.controller.redrawAll();
          }
      }
    };
  }

  createShapesSubmenu() {
    this.elements.shapesSubmenu = document.createElement('div');
    this.elements.shapesSubmenu.id = 'shapes-submenu';
    Object.assign(this.elements.shapesSubmenu.style, {
      position: 'absolute',
      top: '100%',
      left: `${this.elements[TOOLS.SHAPES].offsetLeft}px`,
      background: '#2c2c2c',
      padding: '5px',
      borderRadius: '5px',
      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
      display: 'none',
      zIndex: Z_INDEX.TOOLBAR + 1 // Ensure submenu is above toolbar
    });

    this.elements.shapesSubmenu.innerHTML = `
      <button id="shape-${SHAPE_TYPES.RECTANGLE}" style="${this.buttonStyle}">Rectangle</button>
      <button id="shape-${SHAPE_TYPES.CIRCLE}" style="${this.buttonStyle}">Circle</button>
      <button id="shape-${SHAPE_TYPES.LINE}" style="${this.buttonStyle}">Line</button>
      <button id="shape-${SHAPE_TYPES.ARROW}" style="${this.buttonStyle}">Arrow</button>
    `;

    this.elements.toolbarContent.appendChild(this.elements.shapesSubmenu);

    // Event listeners for shape buttons
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.RECTANGLE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.RECTANGLE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.CIRCLE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.CIRCLE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.LINE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.LINE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.ARROW}`).onclick = () => this.selectShapeType(SHAPE_TYPES.ARROW);

    // Close submenu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.elements.shapesSubmenu.contains(e.target) && e.target !== this.elements[TOOLS.SHAPES]) {
        this.elements.shapesSubmenu.style.display = 'none';
      }
    });
  }

  selectShapeType(shapeType) {
    this.state.currentShapeType = shapeType;
    this.elements.shapesSubmenu.style.display = 'none';
     // Ensure SHAPES tool is active
     if (this.state.tool !== TOOLS.SHAPES) {
        this.controller.setActiveTool(TOOLS.SHAPES);
     } else {
        this.highlightButton(TOOLS.SHAPES); // Re-highlight shapes button
     }
  }

  toggleShapesSubmenu(e) {
      e.stopPropagation();
      // Don't show submenu if toolbar is collapsed
      if (this.isCollapsed) {
        return;
      }
      const submenu = this.elements.shapesSubmenu;
      const display = submenu.style.display === 'none' ? 'block' : 'none';
      submenu.style.display = display;
      // Adjust position relative to the button
      const buttonRect = this.elements[TOOLS.SHAPES].getBoundingClientRect();
      const toolbarRect = this.elements.toolbar.getBoundingClientRect();
      submenu.style.left = `${buttonRect.left - toolbarRect.left}px`;
      // Deselect shape if opening shape menu
      if (display === 'block') {
          this.controller.deselectShape();
      }
  }

  handleToolbarMouseDown(e) {
    // Only drag if clicking directly on the toolbar background or content div, not buttons/inputs
    if (e.target === this.elements.toolbar || e.target === this.elements.toolbarContent) {
      this.state.isDraggingToolbar = true;
      this.state.toolbarOffsetX = e.clientX - this.elements.toolbar.getBoundingClientRect().left;
      this.state.toolbarOffsetY = e.clientY - this.elements.toolbar.getBoundingClientRect().top;
      
      // Store initial position for smoother dragging
      this.state.initialLeft = parseFloat(this.elements.toolbar.style.left) || 0;
      this.state.initialTop = parseFloat(this.elements.toolbar.style.top) || 10;
      
      // Disable transitions during drag for better performance
      this.elements.toolbar.style.transition = 'none';
      
      // Set cursor immediately
      this.elements.toolbar.style.cursor = 'grabbing';
      if (this.elements.toolbarContent.style.display !== 'none') {
        this.elements.toolbarContent.style.cursor = 'grabbing';
      }
      
      // Prevent any potential text selection during drag
      e.preventDefault();
    }
  }

  handleToolbarMouseMove(e) {
    if (!this.state.isDraggingToolbar) return;
    
    // Use requestAnimationFrame for smoother performance
    if (!this.state.animationFrameId) {
      this.state.animationFrameId = requestAnimationFrame(() => {
        this.elements.toolbar.style.transform = 'none'; // Remove translateX(-50%)
        
        // Calculate new position
        const newLeft = (e.clientX - this.state.toolbarOffsetX) + 'px';
        const newTop = (e.clientY - this.state.toolbarOffsetY) + 'px';
        
        // Apply new position
        this.elements.toolbar.style.left = newLeft;
        this.elements.toolbar.style.top = newTop;
        
        // Clear animation frame ID
        this.state.animationFrameId = null;
      });
    }
  }

  handleToolbarMouseUp() {
    if (this.state.isDraggingToolbar) {
      // Reset state
      this.state.isDraggingToolbar = false;
      
      // Cancel any pending animation frame
      if (this.state.animationFrameId) {
        cancelAnimationFrame(this.state.animationFrameId);
        this.state.animationFrameId = null;
      }
      
      // Re-enable transitions
      this.elements.toolbar.style.transition = 'all 0.3s ease';
      
      // Reset cursor
      this.elements.toolbar.style.cursor = 'move';
      if (this.elements.toolbarContent.style.display !== 'none') {
        this.elements.toolbarContent.style.cursor = 'move';
      }
    }
  }

  highlightButton(buttonId) {
    if (!this.elements.toolbarContent) return; // Toolbar might not be created yet
    const buttons = this.elements.toolbarContent.querySelectorAll('button[id]'); // Select only buttons with IDs
    buttons.forEach(button => {
      if (button.id !== 'clear' && button.id !== 'close' && !button.id.startsWith('shape-')) {
          button.style.background = button.id === buttonId ?
          COLORS.ACTIVE_BUTTON : COLORS.INACTIVE_BUTTON;
      }
    });
  }

  // Method to be called by the controller to remove the toolbar
  destroy() {
      if (this.elements.toolbar) {
          this.elements.toolbar.remove();
      }
      // Remove document listeners if necessary (though they might be garbage collected)
      document.removeEventListener('mousemove', this.handleToolbarMouseMove);
      document.removeEventListener('mouseup', this.handleToolbarMouseUp);
  }
}

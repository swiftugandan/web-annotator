import { COLORS, TOOLS, SHAPE_TYPES, Z_INDEX, PERFECT_FREEHAND_CONFIG, PERFECT_FREEHAND_PRESETS } from '../utils/constants.js';
import { setPerfectFreehandPreset } from '../utils/drawingUtils.js';
import { getStroke } from '../utils/perfectFreehand.js';

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

    // Initialize with the Fountain Pen preset by default
    setPerfectFreehandPreset('FOUNTAIN_PEN');

    this.createToolbar();
    this.setupToolbarDrag();
    this.setupToolbarButtons();
    this.createShapesSubmenu();
    this.createDrawingOptionsSubmenu();
    this.highlightButton(this.state.tool);
    this.setupDocumentClickHandler();
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
      <button id="${TOOLS.IMAGE}" style="${this.buttonStyle}">Image</button>
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
    this.elements[TOOLS.DRAW].onclick = (e) => {
      this.controller.setActiveTool(TOOLS.DRAW);
      this.toggleDrawingOptionsSubmenu(e);
    };
    this.elements[TOOLS.ERASER].onclick = () => this.controller.setActiveTool(TOOLS.ERASER);
    this.elements[TOOLS.TEXT].onclick = () => this.controller.setActiveTool(TOOLS.TEXT);
    this.elements[TOOLS.IMAGE].onclick = () => this.controller.setActiveTool(TOOLS.IMAGE);
    this.elements[TOOLS.SHAPES].onclick = (e) => {
        this.controller.setActiveTool(TOOLS.SHAPES);
        this.toggleShapesSubmenu(e);
    };
    this.elements.clear.onclick = () => this.controller.clearAnnotations();
    this.elements.close.onclick = () => this.controller.closeAnnotator();
    this.elements.colorPicker.oninput = (e) => {
      this.updateColor(e.target.value);
    };
  }

  createShapesSubmenu() {
    this.elements.shapesSubmenu = document.createElement('div');
    this.elements.shapesSubmenu.id = 'shapes-submenu';
    Object.assign(this.elements.shapesSubmenu.style, {
      position: 'absolute',
      background: 'rgba(50, 50, 50, 0.9)',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      display: 'none',
      zIndex: Z_INDEX.TOOLBAR + 1,
      marginTop: '5px',
      // Grid layout for buttons
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)', // 2 columns
      gap: '5px' // Gap between grid items
    });

    // Simplified button style for submenu
    const submenuButtonStyle = `
      ${this.buttonStyle}
      padding: 8px 12px; // Slightly smaller padding
      font-size: 13px;
      min-width: 80px; // Ensure buttons have some width
      text-align: center;
    `;

    this.elements.shapesSubmenu.innerHTML = `
      <button id="shape-${SHAPE_TYPES.RECTANGLE}" style="${submenuButtonStyle}">Rectangle</button>
      <button id="shape-${SHAPE_TYPES.CIRCLE}" style="${submenuButtonStyle}">Circle</button>
      <button id="shape-${SHAPE_TYPES.LINE}" style="${submenuButtonStyle}">Line</button>
      <button id="shape-${SHAPE_TYPES.ARROW}" style="${submenuButtonStyle}">Arrow</button>
    `;

    this.elements.toolbar.appendChild(this.elements.shapesSubmenu);
    this.elements.shapesSubmenu.style.display = 'none'; // Explicitly hide after appending

    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.RECTANGLE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.RECTANGLE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.CIRCLE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.CIRCLE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.LINE}`).onclick = () => this.selectShapeType(SHAPE_TYPES.LINE);
    this.elements.shapesSubmenu.querySelector(`#shape-${SHAPE_TYPES.ARROW}`).onclick = () => this.selectShapeType(SHAPE_TYPES.ARROW);

    // Keep the document click listener to close it
    document.addEventListener('click', (e) => {
      if (!this.elements.shapesSubmenu.contains(e.target) && e.target !== this.elements[TOOLS.SHAPES]) {
        this.elements.shapesSubmenu.style.display = 'none';
      }
    });
  }

  createDrawingOptionsSubmenu() {
    this.elements.drawingOptionsSubmenu = document.createElement('div');
    this.elements.drawingOptionsSubmenu.id = 'drawing-options-submenu';
    Object.assign(this.elements.drawingOptionsSubmenu.style, {
      position: 'absolute',
      background: 'rgba(50, 50, 50, 0.9)',
      padding: '15px', // Increase padding
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      display: 'none',
      zIndex: Z_INDEX.TOOLBAR + 1,
      color: 'white',
      fontSize: '14px',
      minWidth: '280px', // Slightly wider
      marginTop: '5px',
      display: 'flex', // Use flexbox for vertical layout
      flexDirection: 'column',
      gap: '15px' // Add gap between sections
    });

    // --- Styles --- (Keep existing styles for switch, pen preview)
    const switchStyle = `position: relative; display: inline-block; width: 46px; height: 24px; flex-shrink: 0;`;
    const sliderStyle = `position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px;`;
    const sliderBeforeStyle = `position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;`;
    const checkedStyle = `background-color: ${COLORS.ACTIVE_BUTTON};`;
    const checkedBeforeStyle = `transform: translateX(20px);`;
    const penPreviewStyle = `width: 50px; height: 20px; display: inline-block; margin-right: 10px; vertical-align: middle; color: ${this.state.drawColor};`;
    const penOptionStyle = `padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background-color 0.2s;`;

    // --- HTML Structure --- (Group elements logically)
    this.elements.drawingOptionsSubmenu.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <label for="perfect-freehand-toggle">Perfect Freehand:</label>
        <div class="switch" style="${switchStyle}">
          <input type="checkbox" id="perfect-freehand-toggle" style="opacity: 0; width: 0; height: 0;" ${PERFECT_FREEHAND_CONFIG.USE_PERFECT_FREEHAND ? 'checked' : ''}>
          <span class="slider" style="${sliderStyle} ${PERFECT_FREEHAND_CONFIG.USE_PERFECT_FREEHAND ? checkedStyle : ''}">
            <span class="slider-before" style="${sliderBeforeStyle} ${PERFECT_FREEHAND_CONFIG.USE_PERFECT_FREEHAND ? checkedBeforeStyle : ''}"></span>
          </span>
        </div>
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 5px;">Pen Style:</label>
        <div id="pen-style-selector" style="border: 1px solid #444; border-radius: 4px; overflow: hidden; background: rgba(0, 0, 0, 0.2);">
          <div class="pen-style-option" data-preset="DEFAULT" style="${penOptionStyle} border-bottom: 1px solid #444;">
            <svg width="50" height="20" style="${penPreviewStyle}">
              <path d="M5 10h40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <span>Default</span>
          </div>
          <div class="pen-style-option" data-preset="TAPERED_ENDS" style="${penOptionStyle} border-bottom: 1px solid #444;">
            <svg width="50" height="20" style="${penPreviewStyle}">
              <path d="M5 10C15 8 35 12 45 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <span>Tapered Ends</span>
          </div>
          <div class="pen-style-option" data-preset="BRUSH_PEN" style="${penOptionStyle} border-bottom: 1px solid #444;">
            <svg width="50" height="20" style="${penPreviewStyle}">
              <path d="M5 10C15 7 35 13 45 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
            </svg>
            <span>Brush Pen</span>
          </div>
          <div class="pen-style-option" data-preset="FOUNTAIN_PEN" style="${penOptionStyle} border-bottom: 1px solid #444;">
            <svg width="50" height="20" style="${penPreviewStyle}">
              <path d="M5 12C15 8 35 12 45 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Fountain Pen</span>
          </div>
          <div class="pen-style-option" data-preset="BALLPOINT" style="${penOptionStyle}">
            <svg width="50" height="20" style="${penPreviewStyle}">
              <path d="M5 10C15 9 35 11 45 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Ballpoint</span>
          </div>
        </div>
      </div>
      
      <div>
        <label style="display: block; margin-bottom: 3px;">Preview:</label>
        <canvas id="pen-style-preview" height="40" style="background: #fff; border: 1px solid #444; border-radius: 4px; width: 100%; box-sizing: border-box;"></canvas>
      </div>
      
      <div>
        <label for="line-width" style="display: block; margin-bottom: 3px;">Line Width: <span id="line-width-value" style="float: right;">${this.state.drawWidth}</span></label>
        <input type="range" id="line-width" min="1" max="20" value="${this.state.drawWidth}" style="width: 100%; cursor: pointer;">
      </div>
    `;

    this.elements.toolbar.appendChild(this.elements.drawingOptionsSubmenu);
    this.elements.drawingOptionsSubmenu.style.display = 'none'; // Explicitly hide after appending

    // --- Event Listeners --- (Existing logic remains the same)
    const toggle = this.elements.drawingOptionsSubmenu.querySelector('#perfect-freehand-toggle');
    const slider = this.elements.drawingOptionsSubmenu.querySelector('.slider');
    const sliderBefore = this.elements.drawingOptionsSubmenu.querySelector('.slider-before');
    toggle.addEventListener('change', () => {
      PERFECT_FREEHAND_CONFIG.USE_PERFECT_FREEHAND = toggle.checked;
      slider.style.backgroundColor = toggle.checked ? COLORS.ACTIVE_BUTTON : '#ccc';
      sliderBefore.style.transform = toggle.checked ? 'translateX(20px)' : 'translateX(0)';
      this.controller.redrawAll();
    });

    const lineWidthSlider = this.elements.drawingOptionsSubmenu.querySelector('#line-width');
    const lineWidthValue = this.elements.drawingOptionsSubmenu.querySelector('#line-width-value');
    lineWidthSlider.addEventListener('input', () => {
      this.state.drawWidth = parseInt(lineWidthSlider.value);
      lineWidthValue.textContent = this.state.drawWidth;
      this.drawPenStylePreview();
    });

    const penStyleOptions = this.elements.drawingOptionsSubmenu.querySelectorAll('.pen-style-option');
    penStyleOptions.forEach(option => {
      option.addEventListener('mouseenter', () => { if (!option.classList.contains('selected')) option.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; });
      option.addEventListener('mouseleave', () => { if (!option.classList.contains('selected')) option.style.backgroundColor = ''; });
      option.addEventListener('click', () => {
        const presetName = option.dataset.preset;
        setPerfectFreehandPreset(presetName);
        this.updateSelectedPenStyle();
        this.drawPenStylePreview();
        this.controller.redrawAll();
      });
    });
    
    this.updateSelectedPenStyle();
    this.drawPenStylePreview();
  }

  updateSelectedPenStyle() {
    const penStyleOptions = this.elements.drawingOptionsSubmenu?.querySelectorAll('.pen-style-option');
    if (!penStyleOptions) return;
    
    penStyleOptions.forEach(option => {
      option.style.backgroundColor = '';
      option.classList.remove('selected');
    });
    
    for (const [presetName, preset] of Object.entries(PERFECT_FREEHAND_PRESETS)) {
      // Use a slightly more robust check
      if (preset.THINNING === PERFECT_FREEHAND_CONFIG.THINNING && 
          preset.START.TAPER === PERFECT_FREEHAND_CONFIG.START.TAPER &&
          preset.END.TAPER === PERFECT_FREEHAND_CONFIG.END.TAPER &&
          preset.STREAMLINE === PERFECT_FREEHAND_CONFIG.STREAMLINE
         ) {
        
        const matchingOption = Array.from(penStyleOptions).find(
          option => option.dataset.preset === presetName
        );
        
        if (matchingOption) {
          matchingOption.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          matchingOption.classList.add('selected');
        }
        
        break; // Assume first match is good enough
      }
    }
  }

  drawPenStylePreview() {
    const canvas = this.elements.drawingOptionsSubmenu?.querySelector('#pen-style-preview');
    if (!canvas || this.elements.drawingOptionsSubmenu.style.display !== 'block') return;
    
    canvas.width = canvas.offsetWidth; // Ensure width matches element size
    canvas.height = 40;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sample points for preview stroke
    const points = [];
    const startX = canvas.width * 0.1;
    const endX = canvas.width * 0.9;
    const pathWidth = endX - startX;
    const baseHeight = canvas.height / 2;
    const amplitude = canvas.height * 0.25;
    const frequency = 2;
    const pressureFrequency = 3;
    const numPoints = 20;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = startX + t * pathWidth;
        const y = baseHeight + Math.sin(t * Math.PI * frequency) * amplitude;
        // Simulate pressure variation, ensure it's between 0.1 and 1.0
        let pressure = 0.5 + Math.sin(t * Math.PI * pressureFrequency) * 0.4;
        pressure = Math.max(0.1, Math.min(1.0, pressure));
        points.push([x, y, pressure]);
    }

    const previewColor = this.state.drawColor || '#000000'; 

    // Use current config for preview, but override size slightly for visibility
    const options = {
      ...PERFECT_FREEHAND_CONFIG, // Spread current config
      size: Math.max(4, this.state.drawWidth * 1.5), // Ensure minimum size for preview
      simulatePressure: PERFECT_FREEHAND_CONFIG.SIMULATE_PRESSURE, // Respect this setting
      last: true, // Stroke is complete for preview
      start: { ...PERFECT_FREEHAND_CONFIG.START }, // Use copies
      end: { ...PERFECT_FREEHAND_CONFIG.END }
    };
    
    const outlinePoints = getStroke(points, options);
    
    if (outlinePoints.length >= 3) {
      ctx.fillStyle = previewColor;
      ctx.beginPath();
      ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
      for (let i = 1; i < outlinePoints.length; i++) {
        ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  selectShapeType(shapeType) {
    this.state.currentShapeType = shapeType;
    this.elements.shapesSubmenu.style.display = 'none';
    if (this.state.tool !== TOOLS.SHAPES) {
      this.controller.setActiveTool(TOOLS.SHAPES);
    }
  }

  toggleShapesSubmenu(e) {
    const buttonElement = this.elements[TOOLS.SHAPES];
    const submenu = this.elements.shapesSubmenu;
    
    submenu.style.left = `${buttonElement.offsetLeft}px`;
    submenu.style.top = `${buttonElement.offsetTop + buttonElement.offsetHeight}px`;
    
    const isVisible = submenu.style.display === 'block';
    submenu.style.display = isVisible ? 'none' : 'block';
    
    if (this.elements.drawingOptionsSubmenu) {
      this.elements.drawingOptionsSubmenu.style.display = 'none';
    }
    
    e.stopPropagation();
  }

  toggleDrawingOptionsSubmenu(e) {
    const buttonElement = this.elements[TOOLS.DRAW];
    const submenu = this.elements.drawingOptionsSubmenu;
    
    submenu.style.left = `${buttonElement.offsetLeft}px`;
    submenu.style.top = `${buttonElement.offsetTop + buttonElement.offsetHeight}px`;
    
    const isVisible = submenu.style.display === 'block';
    submenu.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      setTimeout(() => this.drawPenStylePreview(), 50);
    }
    
    if (this.elements.shapesSubmenu) {
      this.elements.shapesSubmenu.style.display = 'none';
    }
    
    e.stopPropagation();
  }

  handleToolbarMouseDown(e) {
    if (e.target === this.elements.toolbar || e.target === this.elements.toolbarContent) {
      this.state.isDraggingToolbar = true;
      this.state.toolbarOffsetX = e.clientX - this.elements.toolbar.getBoundingClientRect().left;
      this.state.toolbarOffsetY = e.clientY - this.elements.toolbar.getBoundingClientRect().top;
      this.elements.toolbar.style.cursor = 'grabbing';
      if (this.elements.shapesSubmenu) {
        this.elements.shapesSubmenu.style.display = 'none';
      }
      if (this.elements.drawingOptionsSubmenu) {
        this.elements.drawingOptionsSubmenu.style.display = 'none';
      }
    }
  }

  handleToolbarMouseMove(e) {
    if (this.state.isDraggingToolbar) {
      const newLeft = e.clientX - this.state.toolbarOffsetX;
      const newTop = e.clientY - this.state.toolbarOffsetY;
      
      this.elements.toolbar.style.left = `${newLeft}px`;
      this.elements.toolbar.style.top = `${newTop}px`;
      this.elements.toolbar.style.transform = 'none';
    }
  }

  handleToolbarMouseUp() {
    if (this.state.isDraggingToolbar) {
      this.state.isDraggingToolbar = false;
      this.elements.toolbar.style.cursor = 'move';
    }
  }

  highlightButton(buttonId) {
    [TOOLS.DRAW, TOOLS.ERASER, TOOLS.SHAPES, TOOLS.TEXT, TOOLS.IMAGE].forEach(toolId => {
      if (this.elements[toolId]) {
        this.elements[toolId].style.background = COLORS.INACTIVE_BUTTON;
      }
    });
    
    if (this.elements[buttonId]) {
      this.elements[buttonId].style.background = COLORS.ACTIVE_BUTTON;
    }
  }

  setupDocumentClickHandler() {
    document.addEventListener('click', (e) => {
      if (!this.elements.toolbar.contains(e.target)) {
        if (this.elements.shapesSubmenu) {
          this.elements.shapesSubmenu.style.display = 'none';
        }
        if (this.elements.drawingOptionsSubmenu) {
          this.elements.drawingOptionsSubmenu.style.display = 'none';
        }
      }
    });
  }

  updateColor(newColor) {
    this.state.drawColor = newColor;
    if (this.elements.colorPicker) {
      this.elements.colorPicker.value = newColor;
    }
    this.drawPenStylePreview();
    if (this.state.selectedShapeIndex !== null) {
        const selectedShape = this.state.annotations[this.state.selectedShapeIndex];
        if (selectedShape) {
            selectedShape.color = newColor;
            this.controller.redrawAll();
        }
    }
  }

  destroy() {
    if (this.elements.toolbar) {
      document.body.removeChild(this.elements.toolbar);
    }
    
    document.removeEventListener('mousemove', this.handleToolbarMouseMove);
    document.removeEventListener('mouseup', this.handleToolbarMouseUp);
  }
}

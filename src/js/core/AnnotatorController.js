import { DEFAULT_STATE, TOOLS } from '../utils/constants.js';
import { ToolbarManager } from './ToolbarManager.js';
import { CanvasManager } from './CanvasManager.js';
// import { TextWidgetManager } from './TextWidgetManager.js';
import { DrawingTool } from '../tools/DrawingTool.js';
import { ShapeTool } from '../tools/ShapeTool.js';
import { EraserTool } from '../tools/EraserTool.js';
import { TextTool } from '../tools/TextTool.js';
// TextTool logic is integrated into TextWidgetManager and CanvasManager interactions

/**
 * Main controller for the annotation tool.
 * Orchestrates managers, tools, and state.
 */
export class AnnotatorController {
  constructor() {
    // Deep copy default state to avoid mutations across instances (if ever needed)
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));

    // Instantiate Managers
    // Pass 'this' (the controller) to managers for communication and state access
    this.canvasManager = new CanvasManager(this);
    this.toolbarManager = new ToolbarManager(this); // Toolbar needs canvas context sometimes? No, relies on controller/state
    // Remove TextWidgetManager instantiation
    // this.textWidgetManager = new TextWidgetManager(this);

    // Instantiate Tools
    // Pass 'this' (the controller) to tools for access to state, context, redraw etc.
    this.drawingTool = new DrawingTool(this);
    this.shapeTool = new ShapeTool(this);
    this.eraserTool = new EraserTool(this);
    this.textTool = new TextTool(this);

    // Provide redraw function (no longer needed for TextWidgetManager)
    const redrawFunc = this.redrawAll.bind(this);
    // this.textWidgetManager.setRedrawFunction(redrawFunc);
    // ShapeTool gets redraw via constructor
    // EraserTool gets redraw via constructor

    console.log('Annotator Initialized');
  }

  // --- Public Methods --- (Called by Managers/Tools)

  setActiveTool(toolName) {
    // Ensure toolName is valid before setting
    if (!Object.values(TOOLS).includes(toolName)) {
        console.warn(`Attempted to set invalid tool: ${toolName}`);
        // Optionally default to a valid tool, e.g., DRAW
        toolName = TOOLS.DRAW;
    }
    
    // Close any active text editing if switching away from TEXT tool
    if (this.state.tool === TOOLS.TEXT && toolName !== TOOLS.TEXT) {
        this.textTool._removeTextEditWidget();
    }
    
    this.state.tool = toolName;
    this.toolbarManager.highlightButton(toolName);
    this.canvasManager.updateCursor(this.state.lastX, this.state.lastY); // Update cursor for the new tool

    // Deselect shape when changing tools away from SHAPES
    if (toolName !== TOOLS.SHAPES && this.state.selectedShapeIndex !== null) {
        this.deselectShape();
    }
  }

  redrawAll() {
    this.canvasManager.redrawAnnotations();
  }

  clearAnnotations() {
    // Remove text editing widget if active
    if (this.textTool) {
        this.textTool._removeTextEditWidget();
    }
    
    // Remove call to removeTextWidget
    // this.textWidgetManager.removeTextWidget(); 
    this.state.annotations = [];
    this.state.selectedShapeIndex = null;
    this.state.selectedTextIndex = null;
    this.state.interactionMode = 'none';
    this.state.activeHandle = null;
    this.state.isDrawing = false;
    this.state.isDrawingShape = false;
    this.redrawAll();
    this.toolbarManager.highlightButton(this.state.tool); // Re-highlight current tool
    this.canvasManager.updateCursor(this.state.lastX, this.state.lastY); // Reset cursor
  }

  closeAnnotator() {
    this.toolbarManager.destroy();
    this.canvasManager.destroy();
    // Remove call to textWidgetManager.destroy
    // this.textWidgetManager.destroy();
    window.__annotatorInjected = false; // Allow re-injection
    console.log('Annotator Closed');
  }

  deselectShape() {
      if (this.state.selectedShapeIndex !== null) {
        this.state.selectedShapeIndex = null;
        this.state.interactionMode = 'none';
        this.state.activeHandle = null;
        this.redrawAll();
        this.canvasManager.updateCursor(this.state.lastX, this.state.lastY);
      }
  }

   // --- Getters (if needed by external modules, though unlikely) ---
   getState() {
       return this.state;
   }

   getAnnotations() {
       return this.state.annotations;
   }
}

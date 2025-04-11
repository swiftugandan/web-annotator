/**
 * Constants used throughout the application.
 */

export const COLORS = {
  ACTIVE_BUTTON: '#ea4335',
  INACTIVE_BUTTON: '#4285f4',
  HANDLE_FILL: 'rgba(0, 100, 255, 0.7)',
  HANDLE_STROKE: 'rgba(0, 100, 255, 0.5)',
  ROTATION_HANDLE_FILL: 'rgba(0, 150, 0, 0.7)',
  ROTATION_HANDLE_STROKE: 'rgba(0, 100, 0, 0.5)',
  ROTATION_LINE: 'rgba(0, 150, 0, 0.5)',
  SELECTION_DASH: [4, 4],
  TEXT_HIGHLIGHT: '#4285f4',
  ERASER_VISUALIZATION: 'rgba(0, 0, 0, 0.2)',
  ERASER_EFFECT: 'rgba(0, 0, 0, 1)'
};

export const TOOLS = {
  DRAW: 'draw',
  ERASER: 'eraser',
  SHAPES: 'shapes',
  TEXT: 'text'
};

export const SHAPE_TYPES = {
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  LINE: 'line',
  ARROW: 'arrow'
};

export const Z_INDEX = {
  OVERLAY: '2147483640', // Base layer for calculating body size
  CANVAS: '2147483641',  // Canvas should be above overlay but below toolbar
  TOOLBAR: '2147483645', // Toolbar above canvas
  TEXT_WIDGET: '2147483647' // Text widget above everything else
};

export const DEFAULT_STATE = {
  isDrawing: false,
  isDrawingShape: false,
  currentShapeType: SHAPE_TYPES.RECTANGLE, // Default shape type
  shapeStartX: 0,
  shapeStartY: 0,
  lastX: 0,
  lastY: 0,
  drawColor: '#ff0000',
  drawWidth: 3,
  eraserWidth: 20,
  tool: TOOLS.DRAW, // Default tool
  annotations: [],
  isDraggingToolbar: false,
  toolbarOffsetX: 0,
  toolbarOffsetY: 0,
  selectedShapeIndex: null,
  selectedTextIndex: null,
  interactionMode: 'none', // 'none', 'moving', 'resizing', 'rotating'
  activeHandle: null,      // Stores the handle being interacted with ('tl', 'tr', ..., 'rotate')
  dragStartX: 0,
  dragStartY: 0,
  shapeCenter: { x: 0, y: 0 }, // Store center for rotation
  lastVelocityX: 0,
  lastVelocityY: 0,
  lastTimestamp: 0
};

export const DRAWING_CONFIG = {
  SMOOTHING_FACTOR: 0.7, // Higher value = more smoothing
  MAX_SPEED: 1500, // Calibrate based on testing
  MIN_PRESSURE: 0.5,
  MAX_PRESSURE: 1.5,
  TENSION: 0.4, // Base tension for spline drawing
  HIGH_VELOCITY_THRESHOLD: 1000,
  VELOCITY_TENSION_FACTOR: 0.8,
  VELOCITY_TENSION_SCALE: 2000,
  VELOCITY_TENSION_REDUCTION_MAX: 0.5
};

export const ERASER_CONFIG = {
  SAMPLE_STEPS: 5 // Number of points to check along a segment for erasure
};

export const SHAPE_HANDLES = {
  SIZE: 8,
  ROTATION_OFFSET: 20,
  ROTATION_RADIUS: 5,
  RESIZE_TOUCH_RADIUS_FACTOR: 1,
  ROTATION_TOUCH_RADIUS_FACTOR: 1, // Added factor for rotation touch radius
  ARROW_WIDTH_FACTOR: 3,
  ARROW_MIN_WIDTH: 10,
  ARROW_HEAD_LENGTH_FACTOR: 5,
  ARROW_MIN_HEAD_LENGTH: 15,
  HIT_TOLERANCE: 10 // Pixel tolerance for shape hit detection (especially lines/arrows)
};

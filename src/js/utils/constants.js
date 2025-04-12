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
  TEXT: 'text',
  IMAGE: 'image'
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
  selectedImageIndex: null,
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
  SMOOTHING_FACTOR: 0.8, // Higher value = more smoothing (Decreased from 0.9 for responsiveness)
  MAX_SPEED: 1500, // Calibrate based on testing
  MIN_PRESSURE: 0.3, // Decreased from 0.5
  MAX_PRESSURE: 1.7, // Increased from 1.5
  TENSION: 0.2, // Base tension for spline drawing (Reduced from 0.4)
  HIGH_VELOCITY_THRESHOLD: 1000,
  VELOCITY_TENSION_FACTOR: 0.8,
  VELOCITY_TENSION_SCALE: 2000,
  VELOCITY_TENSION_REDUCTION_MAX: 0.5
};

// Easing functions for tapers
const easingFunctions = {
  linear: t => t, 
  easeIn: t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  elastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

// Preset configurations for perfect-freehand
export const PERFECT_FREEHAND_PRESETS = {
  DEFAULT: {
    SIZE: 8,
    THINNING: 0.5,
    SMOOTHING: 0.5,
    STREAMLINE: 0.5,
    SIMULATE_PRESSURE: true,
    START: { CAP: true, TAPER: 0, EASING: easingFunctions.linear },
    END: { CAP: true, TAPER: 0, EASING: easingFunctions.linear }
  },
  TAPERED_ENDS: {
    SIZE: 8,
    THINNING: 0.5,
    SMOOTHING: 0.5,
    STREAMLINE: 0.5,
    SIMULATE_PRESSURE: true,
    START: { CAP: false, TAPER: 20, EASING: easingFunctions.easeIn },
    END: { CAP: false, TAPER: 20, EASING: easingFunctions.easeOut }
  },
  BRUSH_PEN: {
    SIZE: 10,
    THINNING: 0.7,
    SMOOTHING: 0.5,
    STREAMLINE: 0.5,
    SIMULATE_PRESSURE: true,
    START: { CAP: true, TAPER: 0, EASING: easingFunctions.linear },
    END: { CAP: true, TAPER: 0, EASING: easingFunctions.linear }
  },
  FOUNTAIN_PEN: {
    SIZE: 8,
    THINNING: 0.6,
    SMOOTHING: 0.5,
    STREAMLINE: 0.5,
    SIMULATE_PRESSURE: true,
    START: { CAP: false, TAPER: 15, EASING: easingFunctions.easeIn },
    END: { CAP: false, TAPER: 15, EASING: easingFunctions.easeOut }
  },
  BALLPOINT: {
    SIZE: 6,
    THINNING: 0.3,
    SMOOTHING: 0.5,
    STREAMLINE: 0.5,
    SIMULATE_PRESSURE: true,
    START: { CAP: true, TAPER: 0, EASING: easingFunctions.linear },
    END: { CAP: true, TAPER: 0, EASING: easingFunctions.linear }
  }
};

// Configuration for perfect-freehand algorithm
export const PERFECT_FREEHAND_CONFIG = {
  SIZE: 8,              // Base size (diameter) of the stroke
  THINNING: 0.5,        // Effect of pressure on the stroke's size
  SMOOTHING: 0.5,       // How much to soften the stroke's edges
  STREAMLINE: 0.5,      // How much to streamline the stroke
  SIMULATE_PRESSURE: true, // Whether to simulate pressure based on velocity
  USE_PERFECT_FREEHAND: true, // Toggle between perfect-freehand and legacy drawing
  START: {
    CAP: true,          // Whether to draw a cap at the start
    TAPER: 20,           // The distance to taper from the start (pixels, or true for full stroke length)
    EASING: easingFunctions.easeIn,     // Easing function for the taper
  },
  END: {
    CAP: true,          // Whether to draw a cap at the end
    TAPER: 20,           // The distance to taper at the end (pixels, or true for full stroke length)
    EASING: easingFunctions.easeOut,     // Easing function for the taper
  }
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

export const IMAGE_CONFIG = {
  MAX_SIZE: 1000, // Maximum size for the larger dimension of an image
  DEFAULT_WIDTH: 200, // Default width for pasted/inserted images
  DEFAULT_HEIGHT: 200 // Default height for pasted/inserted images
};

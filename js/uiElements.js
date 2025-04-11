/**
 * UI Elements Module
 * Creates and manages the annotation UI elements
 */

// Constants
const Z_INDEX = {
  BLOCKER: 999998,
  OVERLAY: 999999,
  TOOLBAR: 10000001,
  INDICATOR: 10000001
};

/**
 * Creates the basic UI elements for the annotation tool
 */
function createUIElements(buttonStyle, COLORS, TOOLS) {
  const blocker = createBlocker();
  const overlay = createOverlay();
  const canvas = createCanvas(overlay);
  const toolbar = createToolbar(buttonStyle, COLORS, TOOLS);
  
  document.body.appendChild(blocker);
  document.body.appendChild(overlay);
  document.body.appendChild(toolbar);
  
  return {
    blocker,
    overlay,
    canvas,
    ctx: canvas.getContext('2d'),
    toolbar
  };
}

/**
 * Creates the blocker div that prevents interaction with the page
 */
function createBlocker() {
  const blocker = document.createElement('div');
  Object.assign(blocker.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: Z_INDEX.BLOCKER,
    background: 'transparent'
  });
  return blocker;
}

/**
 * Creates the overlay container
 */
function createOverlay() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: Z_INDEX.OVERLAY,
    background: 'rgba(0,0,0,0.1)'
  });
  return overlay;
}

/**
 * Creates the canvas element for drawing annotations
 */
function createCanvas(overlay) {
  const canvas = document.createElement('canvas');
  canvas.id = 'annotationCanvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.appendChild(canvas);
  return canvas;
}

/**
 * Creates the toolbar with annotation tools
 */
function createToolbar(buttonStyle, COLORS, TOOLS) {
  const toolbar = document.createElement('div');
  toolbar.id = 'annotation-toolbar';
  
  Object.assign(toolbar.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: Z_INDEX.TOOLBAR,
    background: '#2c2c2c',
    padding: '12px',
    borderRadius: '8px',
    boxShadow: '0 0 20px rgba(0,0,0,0.8)',
    border: '2px solid #4285f4',
    cursor: 'move',
    display: 'flex',
    gap: '8px',
    minWidth: '300px',
    justifyContent: 'center'
  });
  
  toolbar.innerHTML = `
    <button id="${TOOLS.DRAW}" style="${buttonStyle}">Draw</button>
    <input type="color" id="color-picker" value="#ff0000" title="Drawing Color" style="height: 38px; cursor: pointer; border: none; padding: 0 2px; background-color: transparent;">
    <button id="${TOOLS.SHAPES}" style="${buttonStyle}">Shapes</button>
    <button id="${TOOLS.TEXT}" style="${buttonStyle}">Text</button>
    <button id="${TOOLS.ERASER}" style="${buttonStyle}">Eraser</button>
    <button id="clear" style="${buttonStyle}">Clear</button>
    <button id="close" style="${buttonStyle}">Close</button>
  `;
  
  return toolbar;
}

export { createUIElements, Z_INDEX }; 
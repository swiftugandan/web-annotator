/**
 * Text Widget Module
 * Handles creation and management of text annotation widgets
 */

// Constants
const Z_INDEX = {
  TEXT_WIDGET: 10000000
};

const COLORS = {
  PRIMARY: '#4285f4',
  SECONDARY: '#fbfbfb',
  TEXT_PRIMARY: '#333333',
  TEXT_SECONDARY: '#5f6368',
  DONE_BUTTON: '#1a73e8',
  DONE_BUTTON_HOVER: '#1765cc',
  CANCEL_BUTTON: '#5f6368',
  CANCEL_BUTTON_HOVER: '#4d545a',
  DELETE_BUTTON: '#ea4335',
  DELETE_BUTTON_HOVER: '#d33426',
  SIZE_BUTTON: '#1a73e8',
  SIZE_BUTTON_HOVER: '#1765cc',
  BORDER: '#e0e0e0'
};

const DEFAULT_TEXT = 'Text here';
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_SIZE_STEP = 2;

/**
 * Creates a text widget for adding or editing annotations
 */
function createTextWidget(x, y, existingText = null, onTextFinalized, redrawAnnotations) {
  removeTextWidget();
  
  const textWidget = createTextWidgetElement(x, y, existingText);
  const editableArea = createEditableArea(existingText);
  const widgetToolbar = createWidgetToolbar(editableArea, existingText, redrawAnnotations);
  
  textWidget.appendChild(editableArea);
  textWidget.appendChild(widgetToolbar);
  
  setupTextWidgetDrag(textWidget);
  
  document.body.appendChild(textWidget);
  activeTextWidget = textWidget;
  
  editableArea.focus();
  
  return textWidget;
}

/**
 * Removes the active text widget from the DOM
 */
function removeTextWidget() {
  if (activeTextWidget) {
    document.body.removeChild(activeTextWidget);
    activeTextWidget = null;
  }
}

/**
 * Creates the main container element for the text widget
 */
function createTextWidgetElement(x, y, existingText) {
  const textWidget = document.createElement('div');
  textWidget.id = 'annotation-text-widget';
  
  Object.assign(textWidget.style, {
    position: 'fixed',
    left: x + 'px',
    top: y + 'px',
    zIndex: Z_INDEX.TEXT_WIDGET,
    padding: '0',
    minWidth: '240px',
    minHeight: '40px',
    border: `1px solid ${COLORS.BORDER}`,
    background: COLORS.SECONDARY,
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.05)',
    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
    overflow: 'hidden'
  });
  
  if (existingText) {
    textWidget.dataset.editingId = existingText.id;
  }
  
  return textWidget;
}

/**
 * Creates the editable text area for the widget
 */
function createEditableArea(existingText) {
  const editableArea = document.createElement('div');
  editableArea.contentEditable = true;
  
  Object.assign(editableArea.style, {
    width: '100%',
    minHeight: '80px',
    outline: 'none',
    color: COLORS.TEXT_PRIMARY,
    fontSize: existingText ? existingText.fontSize + 'px' : '20px',
    fontFamily: existingText ? existingText.fontFamily : '"Segoe UI", Roboto, Arial, sans-serif',
    cursor: 'text',
    padding: '16px',
    lineHeight: '1.4',
    boxSizing: 'border-box',
    wordWrap: 'break-word'
  });
  
  editableArea.textContent = existingText ? existingText.text : DEFAULT_TEXT;
  
  editableArea.addEventListener('focus', function() {
    if (this.textContent === DEFAULT_TEXT && !existingText) {
      document.execCommand('selectAll', false, null);
    }
  });
  
  return editableArea;
}

/**
 * Creates the toolbar with formatting controls for the text widget
 */
function createWidgetToolbar(editableArea, existingText, redrawAnnotations) {
  const widgetToolbar = document.createElement('div');
  Object.assign(widgetToolbar.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: `1px solid ${COLORS.BORDER}`,
    padding: '8px 16px',
    backgroundColor: '#f8f9fa'
  });
  
  const sizeControls = createSizeControls(editableArea);
  
  const actionControls = document.createElement('div');
  actionControls.style.display = 'flex';
  actionControls.style.alignItems = 'center';
  
  if (existingText) {
    const deleteBtn = createDeleteButton(existingText, redrawAnnotations);
    actionControls.appendChild(deleteBtn);
  }
  
  const buttonContainer = createButtonContainer(editableArea, existingText);
  actionControls.appendChild(buttonContainer);
  
  widgetToolbar.appendChild(sizeControls);
  widgetToolbar.appendChild(actionControls);
  
  return widgetToolbar;
}

/**
 * Creates font size controls for the text widget
 */
function createSizeControls(editableArea) {
  const sizeControls = document.createElement('div');
  sizeControls.style.display = 'flex';
  sizeControls.style.alignItems = 'center';
  
  const fontSizeLabel = document.createElement('span');
  fontSizeLabel.textContent = 'Size:';
  fontSizeLabel.style.marginRight = '8px';
  fontSizeLabel.style.fontSize = '12px';
  fontSizeLabel.style.color = COLORS.TEXT_SECONDARY;
  fontSizeLabel.style.fontWeight = '500';
  
  sizeControls.appendChild(fontSizeLabel);
  
  const smallerBtn = createIconButton('−', COLORS.SIZE_BUTTON, () => decreaseFontSize(editableArea));
  const largerBtn = createIconButton('+', COLORS.SIZE_BUTTON, () => increaseFontSize(editableArea));
  
  smallerBtn.style.marginRight = '4px';
  
  sizeControls.appendChild(smallerBtn);
  sizeControls.appendChild(largerBtn);
  
  return sizeControls;
}

/**
 * Creates a delete button for existing text annotations
 */
function createDeleteButton(existingText, redrawAnnotations) {
  const deleteBtn = createButton('Delete', COLORS.DELETE_BUTTON, COLORS.DELETE_BUTTON_HOVER);
  
  deleteBtn.style.marginRight = '8px';
  
  deleteBtn.addEventListener('click', () => {
    const index = annotations.findIndex(a => a.id === existingText.id);
    if (index !== -1) {
      annotations.splice(index, 1);
      redrawAnnotations();
    }
    removeTextWidget();
  });
  
  return deleteBtn;
}

/**
 * Creates container for the cancel and done buttons
 */
function createButtonContainer(editableArea, existingText) {
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.alignItems = 'center';
  
  const cancelBtn = createButton('Cancel', COLORS.CANCEL_BUTTON, COLORS.CANCEL_BUTTON_HOVER);
  cancelBtn.addEventListener('click', removeTextWidget);
  
  const doneBtn = createButton('Done', COLORS.DONE_BUTTON, COLORS.DONE_BUTTON_HOVER, true);
  doneBtn.addEventListener('click', () => finalizeText(editableArea, existingText));
  
  cancelBtn.style.marginRight = '8px';
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(doneBtn);
  
  return buttonContainer;
}

/**
 * Creates a generic button with styling
 */
function createButton(text, bgColor, hoverColor, isPrimary = false) {
  const button = document.createElement('button');
  button.textContent = text;
  
  Object.assign(button.style, {
    background: isPrimary ? bgColor : 'transparent',
    color: isPrimary ? 'white' : bgColor,
    border: isPrimary ? 'none' : `1px solid ${bgColor}`,
    padding: '6px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: '"Segoe UI", Roboto, Arial, sans-serif',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '60px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });
  
  button.onmouseover = () => {
    button.style.background = isPrimary ? hoverColor : 'rgba(0,0,0,0.04)';
  };
  
  button.onmouseout = () => {
    button.style.background = isPrimary ? bgColor : 'transparent';
  };
  
  return button;
}

/**
 * Creates a small icon button
 */
function createIconButton(text, color, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  
  Object.assign(button.style, {
    background: 'transparent',
    color: color,
    border: `1px solid ${color}`,
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    transition: 'all 0.2s ease'
  });
  
  button.onmouseover = () => {
    button.style.background = 'rgba(0,0,0,0.04)';
  };
  
  button.onmouseout = () => {
    button.style.background = 'transparent';
  };
  
  button.addEventListener('click', onClick);
  
  return button;
}

/**
 * Sets up drag functionality for the text widget
 */
function setupTextWidgetDrag(textWidget) {
  let isDraggingWidget = false;
  let widgetOffsetX = 0;
  let widgetOffsetY = 0;
  
  // Create a drag handle
  const dragHandle = document.createElement('div');
  dragHandle.style.position = 'absolute';
  dragHandle.style.top = '0';
  dragHandle.style.left = '0';
  dragHandle.style.right = '0';
  dragHandle.style.height = '8px';
  dragHandle.style.cursor = 'move';
  dragHandle.style.borderTopLeftRadius = '8px';
  dragHandle.style.borderTopRightRadius = '8px';
  
  textWidget.appendChild(dragHandle);
  
  dragHandle.addEventListener('mousedown', (e) => {
    isDraggingWidget = true;
    widgetOffsetX = e.clientX - textWidget.getBoundingClientRect().left;
    widgetOffsetY = e.clientY - textWidget.getBoundingClientRect().top;
    e.preventDefault();
    
    // Add a dragging class for visual feedback
    textWidget.classList.add('dragging');
  });
  
  const moveHandler = (e) => {
    if (isDraggingWidget) {
      textWidget.style.left = (e.clientX - widgetOffsetX) + 'px';
      textWidget.style.top = (e.clientY - widgetOffsetY) + 'px';
    }
  };
  
  const upHandler = () => {
    if (isDraggingWidget) {
      isDraggingWidget = false;
      textWidget.classList.remove('dragging');
    }
  };
  
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
}

/**
 * Finalizes text and creates or updates an annotation
 */
function finalizeText(editableArea, existingText) {
  const text = editableArea.textContent;
  if (text && text !== DEFAULT_TEXT) {
    const computedStyle = window.getComputedStyle(editableArea);
    const fontSize = parseInt(computedStyle.fontSize);
    
    const widgetRect = activeTextWidget.getBoundingClientRect();
    
    const textAnnotation = {
      id: existingText ? existingText.id : 'text-' + Date.now(),
      type: 'text',
      x: widgetRect.left,
      y: widgetRect.top + fontSize,
      text: text,
      font: `${fontSize}px ${computedStyle.fontFamily}`,
      fontSize: fontSize,
      fontFamily: computedStyle.fontFamily,
      color: COLORS.TEXT_PRIMARY,
      width: widgetRect.width,
      height: fontSize
    };
    
    if (existingText) {
      const index = annotations.findIndex(a => a.id === existingText.id);
      if (index !== -1) {
        annotations[index] = textAnnotation;
      }
    } else {
      annotations.push(textAnnotation);
    }
    
    redrawAnnotations();
  }
  
  removeTextWidget();
}

/**
 * Decreases the font size of the editable area
 */
function decreaseFontSize(editableArea) {
  const currentSize = parseInt(window.getComputedStyle(editableArea).fontSize);
  if (currentSize > MIN_FONT_SIZE) {
    editableArea.style.fontSize = (currentSize - FONT_SIZE_STEP) + 'px';
  }
}

/**
 * Increases the font size of the editable area
 */
function increaseFontSize(editableArea) {
  const currentSize = parseInt(window.getComputedStyle(editableArea).fontSize);
  if (currentSize < MAX_FONT_SIZE) {
    editableArea.style.fontSize = (currentSize + FONT_SIZE_STEP) + 'px';
  }
}

// Variables to track widget state
let activeTextWidget = null;
let annotations = [];
let redrawAnnotations = null;

// Export the module functions
export {
  createTextWidget,
  removeTextWidget,
  setAnnotations,
  setRedrawFunction
};

/**
 * Sets the annotations array reference
 */
function setAnnotations(annotationsArray) {
  annotations = annotationsArray;
}

/**
 * Sets the redraw function reference
 */
function setRedrawFunction(redrawFunc) {
  redrawAnnotations = redrawFunc;
} 
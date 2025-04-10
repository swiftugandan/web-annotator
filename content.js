(async function() {
  // Avoid multiple injections
  if (window.__annotatorInjected) return;
  window.__annotatorInjected = true;

  // Constants
  const Z_INDEX = {
    BLOCKER: 999998,
    OVERLAY: 999999,
    TEXT_WIDGET: 10000000,
    TOOLBAR: 10000001,
    INDICATOR: 10000001
  };

  const COLORS = {
    ACTIVE_BUTTON: '#ea4335',
    INACTIVE_BUTTON: '#4285f4',
    DONE_BUTTON: '#4CAF50',
    CANCEL_BUTTON: '#F44336',
    DELETE_BUTTON: '#9E9E9E',
    SIZE_BUTTON: '#2196F3'
  };

  const TOOLS = {
    DRAW: 'draw',
    TEXT: 'text'
  };

  const DEFAULT_TEXT = 'Text here';
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 48;
  const FONT_SIZE_STEP = 2;

  // State management
  const state = {
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    drawColor: 'red',
    drawWidth: 3,
    tool: TOOLS.DRAW,
    annotations: [],
    activeTextWidget: null,
    isDraggingText: false,
    activeTextAnnotation: null,
    textOffsetX: 0,
    textOffsetY: 0,
    isDraggingToolbar: false,
    toolbarOffsetX: 0,
    toolbarOffsetY: 0
  };

  // Initialize UI elements
  const elements = createUIElements();
  setupEventListeners();
  highlightButton(state.tool);

  // Core UI creation functions
  function createUIElements() {
    const blocker = createBlocker();
    const overlay = createOverlay();
    const canvas = createCanvas(overlay);
    const toolbar = createToolbar();
    
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

  function createCanvas(overlay) {
    const canvas = document.createElement('canvas');
    canvas.id = 'annotationCanvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    overlay.appendChild(canvas);
    return canvas;
  }

  function createToolbar() {
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
    
    toolbar.innerHTML = `
      <button id="${TOOLS.DRAW}" style="${buttonStyle}">Draw</button>
      <button id="${TOOLS.TEXT}" style="${buttonStyle}">Text</button>
      <button id="clear" style="${buttonStyle}">Clear</button>
      <button id="save" style="${buttonStyle}">Save</button>
      <button id="close" style="${buttonStyle}">Close</button>
    `;
    
    return toolbar;
  }

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
    document.getElementById('clear').onclick = clearAnnotations;
    document.getElementById('close').onclick = closeAnnotator;
    document.getElementById('save').onclick = saveAnnotations;
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
    if (state.tool === TOOLS.DRAW) {
      startDrawing(e);
    } else if (state.tool === TOOLS.TEXT) {
      handleTextInteraction(e);
    }
  }

  function handleCanvasMouseMove(e) {
    if (state.isDraggingText) {
      dragText(e);
    } else if (state.isDrawing) {
      draw(e);
    }
  }

  function handleCanvasMouseUp() {
    if (state.isDraggingText) {
      state.isDraggingText = false;
      state.activeTextAnnotation = null;
      elements.canvas.style.cursor = 'default';
    } else {
      state.isDrawing = false;
    }
  }

  function handleKeyDown(e) {
    const isDeletionKey = e.key === 'Delete' || e.key === 'Backspace';
    if (isDeletionKey && state.isDraggingText && state.activeTextAnnotation) {
      deleteActiveTextAnnotation();
    }
  }

  function handleWindowResize() {
    const tempAnnotations = [...state.annotations];
    elements.canvas.width = window.innerWidth;
    elements.canvas.height = window.innerHeight;
    state.annotations = tempAnnotations;
    redrawAnnotations();
  }

  // Tool actions
  function setActiveTool(toolName) {
    highlightButton(toolName);
    state.tool = toolName;
  }

  function clearAnnotations() {
    highlightButton('clear');
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    state.annotations = [];
  }

  function closeAnnotator() {
    removeTextWidget();
    elements.overlay.remove();
    elements.toolbar.remove();
    elements.blocker.remove();
    window.__annotatorInjected = false;
  }

  async function saveAnnotations() {
    highlightButton('save');
    
    finalizeActiveTextWidget();
    hideUIForScreenshot();
    
    const indicator = showCaptureIndicator();
    
    try {
      const annotationDataUrl = elements.canvas.toDataURL('image/png');
      elements.overlay.style.display = 'none';
      
      chrome.runtime.sendMessage({ action: 'captureScreenshot' }, async (response) => {
        elements.overlay.style.display = 'block';
        
        if (!response || !response.success) {
          throw new Error(response ? response.error : 'Failed to capture screenshot');
        }
        
        const combinedImageUrl = await combineImages(response.screenshot, annotationDataUrl);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `screenshot-${timestamp}.png`;
        downloadImage(combinedImageUrl, filename);
        
        updateIndicatorSuccess(indicator);
      });
    } catch (error) {
      elements.overlay.style.display = 'block';
      console.error('Screenshot capture failed:', error);
      updateIndicatorFailure(indicator, error);
    }
    
    restoreUIAfterScreenshot();
  }

  function finalizeActiveTextWidget() {
    if (state.activeTextWidget) {
      const doneBtn = state.activeTextWidget.querySelector('button');
      if (doneBtn && doneBtn.textContent === 'Done') doneBtn.click();
    }
  }

  function hideUIForScreenshot() {
    elements.toolbar.style.display = 'none';
  }

  function restoreUIAfterScreenshot() {
    setTimeout(() => {
      elements.toolbar.style.display = 'flex';
    }, 500);
  }

  function showCaptureIndicator() {
    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: 'black',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: Z_INDEX.INDICATOR
    });
    indicator.textContent = 'Capturing screenshot...';
    document.body.appendChild(indicator);
    return indicator;
  }

  function updateIndicatorSuccess(indicator) {
    indicator.textContent = 'Screenshot saved!';
    setTimeout(() => indicator.remove(), 2000);
  }

  function updateIndicatorFailure(indicator, error) {
    indicator.textContent = 'Screenshot failed: ' + error.message;
    setTimeout(() => indicator.remove(), 3000);
  }

  // Drawing functions
  function startDrawing(e) {
    if (state.tool !== TOOLS.DRAW) return;
    
    state.isDrawing = true;
    [state.lastX, state.lastY] = [e.clientX, e.clientY];
    
    state.annotations.push({
      type: TOOLS.DRAW,
      color: state.drawColor,
      width: state.drawWidth,
      points: [[state.lastX, state.lastY]]
    });
  }

  function draw(e) {
    if (!state.isDrawing || state.tool !== TOOLS.DRAW) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    elements.ctx.beginPath();
    elements.ctx.moveTo(state.lastX, state.lastY);
    elements.ctx.lineTo(currentX, currentY);
    elements.ctx.strokeStyle = state.drawColor;
    elements.ctx.lineWidth = state.drawWidth;
    elements.ctx.lineCap = 'round';
    elements.ctx.stroke();
    
    const currentPath = state.annotations[state.annotations.length - 1];
    currentPath.points.push([currentX, currentY]);
    
    [state.lastX, state.lastY] = [currentX, currentY];
  }

  // Text functions
  function handleTextInteraction(e) {
    const found = findTextAtPosition(e.clientX, e.clientY);
    if (found) {
      if (e.detail === 2) { // Double click
        editExistingText(found.annotation);
      } else {
        startTextDrag(e, found.annotation);
      }
    } else {
      addNewText(e);
    }
  }

  function addNewText(e) {
    if (state.tool !== TOOLS.TEXT) return;
    
    if (state.activeTextWidget && 
        (e.target === state.activeTextWidget || state.activeTextWidget.contains(e.target))) {
      return;
    }
    
    createTextWidget(e.clientX, e.clientY);
  }

  function editExistingText(textAnnotation) {
    createTextWidget(
      textAnnotation.x,
      textAnnotation.y - textAnnotation.fontSize,
      textAnnotation
    );
  }

  function startTextDrag(e, annotation) {
    e.stopPropagation();
    e.preventDefault();
    
    state.isDraggingText = true;
    state.activeTextAnnotation = annotation;
    
    state.textOffsetX = e.clientX - annotation.x;
    state.textOffsetY = e.clientY - annotation.y;
    
    elements.canvas.style.cursor = 'move';
  }

  function dragText(e) {
    if (!state.isDraggingText || !state.activeTextAnnotation) return;
    
    state.activeTextAnnotation.x = e.clientX - state.textOffsetX;
    state.activeTextAnnotation.y = e.clientY - state.textOffsetY;
    
    redrawAnnotations();
  }

  function deleteActiveTextAnnotation() {
    const index = state.annotations.findIndex(a => a.id === state.activeTextAnnotation.id);
    if (index !== -1) {
      state.annotations.splice(index, 1);
      redrawAnnotations();
      
      state.isDraggingText = false;
      state.activeTextAnnotation = null;
      elements.canvas.style.cursor = 'default';
    }
  }

  function findTextAtPosition(x, y) {
    for (let i = state.annotations.length - 1; i >= 0; i--) {
      const annotation = state.annotations[i];
      if (annotation.type === TOOLS.TEXT) {
        const textX = annotation.x;
        const textY = annotation.y - annotation.fontSize;
        const textWidth = annotation.width || elements.ctx.measureText(annotation.text).width;
        const textHeight = annotation.fontSize * 1.2;
        
        if (x >= textX && x <= textX + textWidth && 
            y >= textY && y <= textY + textHeight) {
          return { annotation, index: i };
        }
      }
    }
    return null;
  }

  function createTextWidget(x, y, existingText = null) {
    removeTextWidget();
    
    const textWidget = createTextWidgetElement(x, y, existingText);
    const editableArea = createEditableArea(existingText);
    const widgetToolbar = createWidgetToolbar(editableArea, existingText);
    
    textWidget.appendChild(editableArea);
    textWidget.appendChild(widgetToolbar);
    
    setupTextWidgetDrag(textWidget);
    
    document.body.appendChild(textWidget);
    state.activeTextWidget = textWidget;
    
    editableArea.focus();
    
    return textWidget;
  }

  function createTextWidgetElement(x, y, existingText) {
    const textWidget = document.createElement('div');
    textWidget.id = 'annotation-text-widget';
    
    Object.assign(textWidget.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      zIndex: Z_INDEX.TEXT_WIDGET,
      padding: '5px',
      minWidth: '150px',
      minHeight: '40px',
      border: '2px dashed #4285f4',
      background: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '4px',
      boxShadow: '0 0 10px rgba(0,0,0,0.2)'
    });
    
    if (existingText) {
      textWidget.dataset.editingId = existingText.id;
    }
    
    return textWidget;
  }

  function createEditableArea(existingText) {
    const editableArea = document.createElement('div');
    editableArea.contentEditable = true;
    
    Object.assign(editableArea.style, {
      width: '100%',
      minHeight: '30px',
      outline: 'none',
      color: 'blue',
      fontSize: existingText ? existingText.fontSize + 'px' : '20px',
      fontFamily: existingText ? existingText.fontFamily : 'Arial, sans-serif',
      cursor: 'text'
    });
    
    editableArea.textContent = existingText ? existingText.text : DEFAULT_TEXT;
    
    editableArea.addEventListener('focus', function() {
      if (this.textContent === DEFAULT_TEXT && !existingText) {
        document.execCommand('selectAll', false, null);
      }
    });
    
    return editableArea;
  }

  function createWidgetToolbar(editableArea, existingText) {
    const widgetToolbar = document.createElement('div');
    Object.assign(widgetToolbar.style, {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '5px'
    });
    
    const sizeControls = createSizeControls(editableArea);
    widgetToolbar.appendChild(sizeControls);
    
    if (existingText) {
      const deleteBtn = createDeleteButton(existingText);
      const middleControls = document.createElement('div');
      middleControls.appendChild(deleteBtn);
      widgetToolbar.appendChild(middleControls);
    } else {
      widgetToolbar.appendChild(document.createElement('span')); // Spacer
    }
    
    const buttonContainer = createButtonContainer(editableArea, existingText);
    widgetToolbar.appendChild(buttonContainer);
    
    return widgetToolbar;
  }

  function createSizeControls(editableArea) {
    const sizeControls = document.createElement('div');
    
    const smallerBtn = createButton('A-', COLORS.SIZE_BUTTON);
    smallerBtn.style.marginRight = '5px';
    smallerBtn.addEventListener('click', () => decreaseFontSize(editableArea));
    
    const largerBtn = createButton('A+', COLORS.SIZE_BUTTON);
    largerBtn.addEventListener('click', () => increaseFontSize(editableArea));
    
    sizeControls.appendChild(smallerBtn);
    sizeControls.appendChild(largerBtn);
    
    return sizeControls;
  }

  function createDeleteButton(existingText) {
    const deleteBtn = createButton('Delete', COLORS.DELETE_BUTTON);
    deleteBtn.style.marginRight = '5px';
    
    deleteBtn.addEventListener('click', () => {
      const index = state.annotations.findIndex(a => a.id === existingText.id);
      if (index !== -1) {
        state.annotations.splice(index, 1);
        redrawAnnotations();
      }
      removeTextWidget();
    });
    
    return deleteBtn;
  }

  function createButtonContainer(editableArea, existingText) {
    const buttonContainer = document.createElement('div');
    
    const cancelBtn = createButton('Cancel', COLORS.CANCEL_BUTTON);
    cancelBtn.addEventListener('click', removeTextWidget);
    
    const doneBtn = createButton('Done', COLORS.DONE_BUTTON);
    doneBtn.addEventListener('click', () => finalizeText(editableArea, existingText));
    
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(document.createTextNode(' '));
    buttonContainer.appendChild(doneBtn);
    
    return buttonContainer;
  }

  function createButton(text, bgColor) {
    const button = document.createElement('button');
    button.textContent = text;
    
    Object.assign(button.style, {
      background: bgColor,
      color: 'white',
      border: 'none',
      padding: '3px 8px',
      borderRadius: '3px',
      cursor: 'pointer'
    });
    
    return button;
  }

  function setupTextWidgetDrag(textWidget) {
    let isDraggingWidget = false;
    let widgetOffsetX = 0;
    let widgetOffsetY = 0;
    
    textWidget.addEventListener('mousedown', (e) => {
      if (e.target === textWidget) {
        isDraggingWidget = true;
        widgetOffsetX = e.clientX - textWidget.getBoundingClientRect().left;
        widgetOffsetY = e.clientY - textWidget.getBoundingClientRect().top;
        textWidget.style.cursor = 'grabbing';
        e.preventDefault();
      }
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
        textWidget.style.cursor = 'default';
      }
    };
    
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  }

  function finalizeText(editableArea, existingText) {
    const text = editableArea.textContent;
    if (text && text !== DEFAULT_TEXT) {
      const computedStyle = window.getComputedStyle(editableArea);
      const fontSize = parseInt(computedStyle.fontSize);
      
      const widgetRect = state.activeTextWidget.getBoundingClientRect();
      
      const textAnnotation = {
        id: existingText ? existingText.id : 'text-' + Date.now(),
        type: TOOLS.TEXT,
        x: widgetRect.left,
        y: widgetRect.top + fontSize,
        text: text,
        font: `${fontSize}px ${computedStyle.fontFamily}`,
        fontSize: fontSize,
        fontFamily: computedStyle.fontFamily,
        color: 'blue',
        width: widgetRect.width,
        height: fontSize
      };
      
      if (existingText) {
        const index = state.annotations.findIndex(a => a.id === existingText.id);
        if (index !== -1) {
          state.annotations[index] = textAnnotation;
        }
      } else {
        state.annotations.push(textAnnotation);
      }
      
      redrawAnnotations();
    }
    
    removeTextWidget();
  }

  function removeTextWidget() {
    if (state.activeTextWidget) {
      document.body.removeChild(state.activeTextWidget);
      state.activeTextWidget = null;
    }
  }

  function decreaseFontSize(editableArea) {
    const currentSize = parseInt(window.getComputedStyle(editableArea).fontSize);
    if (currentSize > MIN_FONT_SIZE) {
      editableArea.style.fontSize = (currentSize - FONT_SIZE_STEP) + 'px';
    }
  }

  function increaseFontSize(editableArea) {
    const currentSize = parseInt(window.getComputedStyle(editableArea).fontSize);
    if (currentSize < MAX_FONT_SIZE) {
      editableArea.style.fontSize = (currentSize + FONT_SIZE_STEP) + 'px';
    }
  }

  // Rendering and utility functions
  function redrawAnnotations() {
    elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    
    for (const annotation of state.annotations) {
      if (annotation.type === TOOLS.DRAW) {
        drawPath(annotation);
      } else if (annotation.type === TOOLS.TEXT) {
        drawText(annotation);
      }
    }
  }

  function drawPath(annotation) {
    elements.ctx.beginPath();
    elements.ctx.strokeStyle = annotation.color;
    elements.ctx.lineWidth = annotation.width;
    elements.ctx.lineCap = 'round';
    
    const points = annotation.points;
    if (points.length > 0) {
      elements.ctx.moveTo(points[0][0], points[0][1]);
      
      for (let i = 1; i < points.length; i++) {
        elements.ctx.lineTo(points[i][0], points[i][1]);
      }
    }
    
    elements.ctx.stroke();
  }

  function drawText(annotation) {
    elements.ctx.font = annotation.font;
    elements.ctx.fillStyle = annotation.color;
    elements.ctx.fillText(annotation.text, annotation.x, annotation.y);
    
    if (state.isDraggingText && state.activeTextAnnotation && 
        state.activeTextAnnotation.id === annotation.id) {
      drawTextHighlight(annotation);
    }
  }

  function drawTextHighlight(annotation) {
    const metrics = elements.ctx.measureText(annotation.text);
    const textWidth = metrics.width;
    const textHeight = annotation.fontSize;
    
    elements.ctx.strokeStyle = '#4285f4';
    elements.ctx.lineWidth = 1;
    elements.ctx.setLineDash([3, 3]);
    elements.ctx.strokeRect(
      annotation.x, 
      annotation.y - textHeight, 
      textWidth, 
      textHeight * 1.2
    );
    elements.ctx.setLineDash([]);
  }

  function highlightButton(buttonId) {
    const buttons = elements.toolbar.querySelectorAll('button');
    buttons.forEach(button => {
      button.style.background = button.id === buttonId ? 
        COLORS.ACTIVE_BUTTON : COLORS.INACTIVE_BUTTON;
    });
  }

  function combineImages(screenshotDataUrl, annotationDataUrl) {
    return new Promise((resolve) => {
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = window.innerWidth;
      combinedCanvas.height = window.innerHeight;
      const combinedCtx = combinedCanvas.getContext('2d');
      
      const screenshotImg = new Image();
      screenshotImg.onload = () => {
        combinedCtx.drawImage(screenshotImg, 0, 0);
        
        const annotationImg = new Image();
        annotationImg.onload = () => {
          combinedCtx.drawImage(annotationImg, 0, 0);
          resolve(combinedCanvas.toDataURL('image/png'));
        };
        annotationImg.src = annotationDataUrl;
      };
      screenshotImg.src = screenshotDataUrl;
    });
  }

  function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
  }
})(); 
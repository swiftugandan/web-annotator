# Transparent Screenshot Annotator: Technical Architecture

This document provides a detailed technical overview of the Transparent Screenshot Annotator Chrome extension architecture.

## Architectural Overview

The extension follows a modular object-oriented architecture that separates concerns through a series of specialized components:

```
AnnotatorController (Main orchestrator)
├── Managers
│   ├── CanvasManager (Canvas creation & rendering)
│   └── ToolbarManager (UI elements & interaction)
├── Tools
│   ├── DrawingTool (Freehand drawing)
│   ├── ShapeTool (Geometric shapes)
│   ├── TextTool (Text annotations)
│   ├── EraserTool (Erasing functionality)
│   └── ImageTool (Image annotations)
└── Utilities
    ├── constants.js (App constants)
    ├── drawingUtils.js (Drawing helpers)
    ├── geometryUtils.js (Geometry calculations)
    └── perfectFreehand.js (Smooth drawing algorithm)
```

## Initialization Flow

1. User clicks extension icon → `chrome.action.onClicked` in background.js triggered
2. Background script injects content.js into current tab
3. content.js imports and instantiates AnnotatorController
4. AnnotatorController initializes managers and tools
5. CanvasManager creates transparent overlay
6. ToolbarManager creates UI components
7. Event listeners established for user interaction

## Component Details

### AnnotatorController

The central controller that manages the application state and orchestrates all components:

- **Responsibilities**:
  - Initializes managers and tools with dependencies
  - Maintains global application state
  - Provides public methods for cross-component communication
  - Handles tool switching and annotation management

- **Key Methods**:
  - `setActiveTool(toolName)`: Switches between annotation tools
  - `redrawAll()`: Triggers canvas redrawing
  - `clearAnnotations()`: Removes all annotations
  - `closeAnnotator()`: Cleans up and removes the annotator

### Managers

#### CanvasManager

Responsible for creating and managing the canvas overlay:

- **Responsibilities**:
  - Creates the transparent canvas element
  - Handles canvas positioning and resizing
  - Manages canvas event listeners
  - Renders annotations onto the canvas

- **Key Methods**:
  - `createCanvas()`: Creates and configures the overlay canvas
  - `redrawAnnotations()`: Renders all annotations
  - `updateCursor()`: Changes cursor based on current tool/action
  - `destroy()`: Removes the canvas and cleans up event listeners

#### ToolbarManager

Creates and manages the UI toolbar:

- **Responsibilities**:
  - Creates toolbar UI elements
  - Manages toolbar positioning and dragging
  - Handles button click events
  - Creates tool-specific submenus (e.g., shapes submenu)

- **Key Methods**:
  - `createToolbar()`: Creates main toolbar UI
  - `createShapesSubmenu()`: Creates shape selection submenu
  - `highlightButton()`: Updates button styling for active tool
  - `destroy()`: Removes toolbar elements

### Tools

Each tool implements specific annotation functionality:

#### DrawingTool

- **Responsibilities**: Implements freehand drawing with PerfectFreehand algorithm
- **Key Methods**:
  - `handleMouseDown()`: Start drawing
  - `handleMouseMove()`: Continue drawing path
  - `handleMouseUp()`: Finalize drawing
  - `redraw()`: Render existing drawings

#### ShapeTool

- **Responsibilities**: Manages creation and manipulation of geometric shapes
- **Key Methods**:
  - `handleMouseDown()`: Start shape creation or manipulation
  - `handleMouseMove()`: Size/reposition shape
  - `handleMouseUp()`: Finalize shape
  - `getShapeAtPoint()`: Detect shape selection
  - `getResizeHandleAtPoint()`: Detect resize handles

#### TextTool

- **Responsibilities**: Manages text annotations and editing
- **Key Methods**:
  - `handleMouseDown()`: Create or select text annotation
  - `createTextEditWidget()`: Create text input interface
  - `applyTextEdit()`: Save text changes
  - `moveText()`: Reposition text annotation

#### EraserTool

- **Responsibilities**: Erases parts of existing annotations
- **Key Methods**:
  - `handleMouseDown()`: Start erasing
  - `handleMouseMove()`: Continue erasing
  - `erase()`: Remove annotation elements

#### ImageTool

- **Responsibilities**: Manages image upload and placement
- **Key Methods**:
  - `createFileUploadInput()`: Opens file dialog
  - `handleImageUpload()`: Processes selected image
  - `placeImage()`: Positions image on canvas
  - `resizeImage()`: Handles image resizing

### Utilities

#### constants.js

Defines application-wide constants and default state:

- Tool names
- Default colors
- Initial state configuration
- Z-index values
- Default tool properties

#### drawingUtils.js

Provides drawing-related utilities:

- Drawing path calculations
- Shape rendering functions
- Canvas context configuration

#### geometryUtils.js

Geometric calculation utilities:

- Point-in-shape detection
- Distance calculations
- Transformation matrices
- Bounding box calculations

#### perfectFreehand.js

External algorithm for smooth freehand drawing:

- Path smoothing
- Stroke styling
- Pressure simulation

## State Management

The application maintains a central state object within the AnnotatorController:

```javascript
this.state = {
  tool: 'draw',            // Current tool selection
  isDrawing: false,        // Whether drawing is in progress
  drawColor: '#ff0000',    // Current drawing color
  drawWidth: 3,            // Line width
  annotations: [],         // All annotations
  selectedShapeIndex: null // Currently selected annotation
  // ... other state properties
};
```

Each annotation is stored as an object with type and properties:

```javascript
{
  type: 'drawing',  // or 'shape', 'text', 'image'
  color: '#ff0000',
  width: 3,
  // Tool-specific properties
  points: [...],    // For drawings
  text: '...',      // For text annotations
  shapeType: '...', // For shapes
  // ... other properties
}
```

## Event Handling

The extension uses a delegated event handling approach:

1. Canvas events (mousedown, mousemove, mouseup) are captured by CanvasManager
2. CanvasManager passes events to the appropriate tool based on the current state
3. Each tool implements handler methods for mouse events
4. Tools update state and trigger redraws as needed

## Communication Pattern

Components communicate through the AnnotatorController:

1. Controller passes references to managers and tools during initialization
2. Managers and tools call controller methods for cross-component actions
3. Tools receive state from and return updates to the controller

## Extension Integration

- **Background Script**: Listens for extension activation and injects content script
- **Content Script**: Bootstraps the application in the current webpage context
- **Web Accessible Resources**: Makes module files available to the content script

This architecture provides a maintainable and extensible foundation for the annotator functionality. 
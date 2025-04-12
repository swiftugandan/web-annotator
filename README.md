# Transparent Screenshot Annotator

A Chrome extension that allows you to annotate any webpage with a transparent overlay.

## Features

- **Transparent Overlay:** Creates a transparent canvas overlay on any webpage
- **Annotation Tools:**
  - **Drawing Tool:** Freehand drawing with customizable color and width
  - **Shape Tool:** Create rectangles, circles, lines, and arrows
  - **Text Tool:** Add and edit text annotations
  - **Image Tool:** Insert image annotations
  - **Eraser Tool:** Selectively erase annotations
- **Interactive Manipulation:** Move, resize, and edit existing annotations
- **Draggable Toolbar:** Position the toolbar anywhere on the page

## Installation for Development

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

## How to Use

1. Click the extension icon in your browser toolbar when viewing any webpage
2. Use the toolbar that appears to:
   - **Draw:** Freehand drawing with selectable color
   - **Shapes:** Create rectangles, circles, lines, or arrows
   - **Text:** Add and edit text annotations
   - **Image:** Upload and place images onto the overlay
   - **Eraser:** Erase parts of annotations
   - **Clear:** Remove all annotations
   - **Close:** Exit annotation mode

## Project Architecture

The extension follows an object-oriented programming approach with clear separation of concerns:

### Core Components

- **AnnotatorController:** Main controller that orchestrates all components
- **Managers:**
  - **CanvasManager:** Handles canvas creation and rendering
  - **ToolbarManager:** Creates and manages the UI elements
- **Tools:**
  - **DrawingTool:** Implements freehand drawing functionality
  - **ShapeTool:** Handles creation and manipulation of shapes
  - **TextTool:** Manages text annotations
  - **EraserTool:** Implements eraser functionality
  - **ImageTool:** Handles image uploads and placement

### File Structure

- `manifest.json`: Extension configuration
- `background.js`: Handles extension activation
- `content.js`: Entry point for the annotator
- `src/`:
  - `js/core/`: Core controller and managers
  - `js/tools/`: Tool implementations
  - `js/utils/`: Utility functions and constants
- `images/`: Icon files

## Deployment Instructions

To package the extension for distribution:

1. Make sure all files are finalized and tested
2. Create a ZIP file containing all the extension files:
   ```
   zip -r screenshot-annotator.zip * -x "*.git*"
   ```
3. To publish to the Chrome Web Store:
   - Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Sign up for a developer account if you don't have one (one-time $5 fee)
   - Click "New Item" and upload your ZIP file
   - Fill in the store listing information, including:
     - Description
     - Screenshots
     - Privacy policy
     - Promotional images
   - Submit for review

## License

MIT

Note: For production extensions, you should replace the placeholder icons with your own custom icons. 
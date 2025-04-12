# Transparent Screenshot Annotator: User Guide

This guide will help you get started with the Transparent Screenshot Annotator Chrome extension and make the most of its features.

## Getting Started

### Installation

1. Install the extension from the Chrome Web Store, or:
2. For development:
   - Clone or download the repository
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the extension directory

### Launching the Annotator

1. Navigate to any webpage you want to annotate
2. Click the extension icon in your Chrome toolbar (look for the annotation icon)
3. The transparent overlay and toolbar will appear on the page

## Toolbar Overview

The toolbar provides access to all annotation tools and actions:

![Toolbar](../images/toolbar-reference.svg)

- **Draw Tool**: Freehand drawing
- **Shapes Tool**: Add geometric shapes
- **Text Tool**: Add text annotations
- **Image Tool**: Add images to the overlay
- **Eraser Tool**: Remove parts of annotations
- **Clear Button**: Remove all annotations
- **Close Button**: Exit annotation mode
- **Color Picker**: Change drawing/shape color

You can move the toolbar by clicking and dragging its top edge.

## Using the Tools

### Draw Tool

The Draw tool allows you to create freehand drawings on the page.

1. Select the **Draw** tool from the toolbar
2. Choose a color using the color picker
3. Click and drag on the page to draw
4. Release to finish the drawing stroke

Tips:
- The Draw tool creates smooth, natural-looking lines
- You can change the color between different strokes

### Shapes Tool

The Shapes tool lets you add geometric shapes to the page.

1. Select the **Shapes** tool from the toolbar
2. Choose a shape type from the submenu:
   - Rectangle
   - Circle
   - Line
   - Arrow
3. Choose a color using the color picker
4. Click and drag on the page to create the shape
5. Release to finish the shape

Editing shapes:
1. Click on a shape to select it
2. Drag the shape to move it
3. Drag the handles to resize:
   - Corner handles: resize proportionally
   - Edge handles: resize horizontally or vertically
4. Click elsewhere to deselect

### Text Tool

The Text tool allows you to add text annotations.

1. Select the **Text** tool from the toolbar
2. Click anywhere on the page to create a text box
3. Type your text in the editor that appears
4. Click outside the text box to finalize
5. To edit existing text:
   - Click on it when the Text tool is active
   - Make your changes
   - Click elsewhere to finalize

Moving text:
1. Select the text annotation
2. Drag to reposition

### Image Tool

The Image tool lets you add images to the overlay.

1. Select the **Image** tool from the toolbar
2. A file selection dialog will appear
3. Choose an image file from your computer
4. The image will be placed on the overlay
5. Click and drag to position the image
6. Drag the handles to resize the image
7. Click elsewhere to finalize

### Eraser Tool

The Eraser tool allows you to remove parts of existing annotations.

1. Select the **Eraser** tool from the toolbar
2. Click and drag over parts of annotations you want to erase
3. Release to finish erasing

Note: The eraser affects all types of annotations (drawings, shapes, text, images).

## Additional Actions

### Clear All Annotations

To remove all annotations at once:
1. Click the **Clear** button in the toolbar
2. All annotations will be immediately removed

### Exiting Annotation Mode

To close the annotator:
1. Click the **Close** button in the toolbar
2. The overlay and toolbar will be removed

## Keyboard Shortcuts

- **Escape**: Exit text editing mode or deselect a shape
- **Delete/Backspace**: Remove selected shape or text annotation
- **Ctrl+Z**: Undo last action (if implemented)

## Tips and Tricks

- **Precision Positioning**: For more precise control when moving shapes or text, use small, deliberate mouse movements
- **Multiple Annotations**: You can create as many annotations as needed
- **Layering**: Newer annotations appear on top of older ones
- **Performance**: While the annotator is designed to be lightweight, complex annotations on very large pages may affect performance

## Troubleshooting

- **Toolbar Disappeared**: If you accidentally move the toolbar off-screen, refresh the page and reopen the annotator
- **Annotations Not Appearing**: Make sure the page has fully loaded before using the annotator
- **Extension Not Working**: Try disabling and re-enabling the extension in Chrome's extension settings

For additional help or to report issues, please visit the project repository or contact support. 
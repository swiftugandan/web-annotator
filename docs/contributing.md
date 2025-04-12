# Contributing to Transparent Screenshot Annotator

Thank you for your interest in contributing to the Transparent Screenshot Annotator Chrome extension! This guide will help you get started with the development process.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/transparent-screenshot-annotator.git
   cd transparent-screenshot-annotator
   ```

2. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right
   - Click "Load unpacked" and select the project directory
   - The extension should now appear in your extensions list

3. **Development workflow**
   - Make changes to the source code
   - Reload the extension in Chrome (`chrome://extensions/` and click the refresh icon)
   - Test your changes by clicking the extension icon on any webpage

## Project Structure

Understanding the codebase structure is crucial for effective contributions:

```
project_root/
├── manifest.json        # Extension configuration
├── background.js        # Background service worker
├── content.js           # Entry point script
├── src/                 # Source code directory
│   └── js/
│       ├── core/        # Core components
│       │   ├── AnnotatorController.js  # Main controller
│       │   ├── CanvasManager.js        # Canvas management
│       │   └── ToolbarManager.js       # UI management
│       ├── tools/       # Annotation tools
│       │   ├── DrawingTool.js          # Freehand drawing
│       │   ├── ShapeTool.js            # Shape creation and editing
│       │   ├── TextTool.js             # Text annotations
│       │   ├── EraserTool.js           # Eraser functionality
│       │   └── ImageTool.js            # Image handling
│       └── utils/       # Utility functions
│           ├── constants.js            # Application constants
│           ├── drawingUtils.js         # Drawing helpers
│           ├── geometryUtils.js        # Geometry calculations
│           └── perfectFreehand.js      # Smooth drawing algorithm
├── images/              # Icon assets
└── docs/                # Documentation
```

## Architecture Overview

The extension follows an object-oriented architecture:

1. **AnnotatorController**: Central controller that orchestrates all components
2. **Managers**: Handle specific aspects of the application (canvas, toolbar)
3. **Tools**: Implement specific annotation functionality
4. **Utilities**: Provide helper functions and constants

All components communicate through the AnnotatorController, which maintains the application state.

## Coding Guidelines

To maintain code quality and consistency:

1. **Code Style**
   - Use consistent indentation (2 spaces)
   - Follow JavaScript best practices
   - Use meaningful variable and function names
   - Add JSDoc comments for functions and classes

2. **Architecture Principles**
   - Follow the existing OOP structure
   - Keep concerns separated between components
   - Use dependency injection for component communication
   - Ensure new tools follow the established pattern

3. **Testing**
   - Manually test all changes across different websites
   - Ensure compatibility with various page structures
   - Check for any performance issues with complex pages

## Adding New Features

When adding new features:

1. **New Tool**
   - Create a new file in `src/js/tools/`
   - Follow the pattern of existing tools (constructor receiving controller, handler methods)
   - Update AnnotatorController to initialize and use the new tool
   - Add UI elements in ToolbarManager
   - Update constants.js if needed

2. **Enhancing Existing Tools**
   - Identify the relevant tool file
   - Add new functionality while maintaining compatibility
   - Update any related UI components

3. **UI Changes**
   - Modify ToolbarManager.js for toolbar changes
   - Keep UI consistent with existing design
   - Ensure new UI elements are properly styled

## Pull Request Process

1. **Fork the repository** and create a new branch for your feature
2. **Make your changes** following the coding guidelines
3. **Test thoroughly** across different websites
4. **Submit a pull request** with a clear description of:
   - What changes you've made
   - Why you've made them
   - Any issues or limitations to be aware of

## Reporting Issues

When reporting issues:

1. **Check existing issues** to avoid duplicates
2. **Use a clear title** that summarizes the issue
3. **Provide detailed reproduction steps**:
   - Browser version
   - Operating system
   - Steps to reproduce
   - Expected vs. actual behavior
4. **Include screenshots** if relevant

## Communication

Feel free to reach out with questions or suggestions:

- Open an issue for bug reports or feature requests
- Use pull requests for code contributions
- Contact the maintainers directly for other inquiries

Thank you for contributing to making Transparent Screenshot Annotator better! 
# Transparent Screenshot Annotator

A Chrome extension that allows you to annotate any webpage with a transparent overlay and capture screenshots.

## Features

- **Transparent Overlay:** Creates a transparent canvas overlay on any webpage
- **Annotation Tools:** Draw and add text directly on the webpage
- **Screenshot Capture:** Take a screenshot including your annotations
- **Local Download:** Save the annotated screenshot to your device

## Installation for Development

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

## How to Use

1. Click the extension icon in your browser toolbar when viewing any webpage
2. Use the toolbar that appears to:
   - Draw: Freehand drawing with red pen
   - Text: Add text annotations
   - Clear: Remove all annotations
   - Save: Capture a screenshot with annotations and download it
   - Close: Exit annotation mode

## Structure

- `manifest.json`: Extension configuration
- `background.js`: Handles extension activation
- `content.js`: Creates overlay and provides annotation functionality
- `images/`: Icon files

## Future Enhancements

- Color selector for drawing and text
- Additional annotation tools (shapes, arrows, etc.)
- Option to save annotations for later editing
- AWS S3 upload option

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
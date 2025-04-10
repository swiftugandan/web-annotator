/**
 * Chrome Extension Background Script
 * Handles extension icon clicks and messaging with content scripts
 */

const CONTENT_SCRIPT = 'content.js';
const ACTIONS = {
  CAPTURE_SCREENSHOT: 'captureScreenshot'
};

/**
 * Handle extension icon click by injecting the content script
 */
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [CONTENT_SCRIPT]
  })
  .catch(error => console.error(`Failed to inject content script: ${error}`));
});

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTIONS.CAPTURE_SCREENSHOT) {
    captureAndSendScreenshot(sendResponse);
    return true; // Keep the message channel open for the async response
  }
});

/**
 * Capture screenshot and send back to content script
 */
function captureAndSendScreenshot(sendResponse) {
  const options = { format: 'png' };
  
  chrome.tabs.captureVisibleTab(null, options, dataUrl => {
    if (chrome.runtime.lastError) {
      sendResponse({ 
        success: false, 
        error: chrome.runtime.lastError.message 
      });
      return;
    }

    sendResponse({ 
      success: true, 
      screenshot: dataUrl 
    });
  });
} 
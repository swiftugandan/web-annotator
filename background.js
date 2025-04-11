/**
 * Chrome Extension Background Script
 * Handles extension icon clicks and messaging with content scripts
 */

const CONTENT_SCRIPT = 'content.js';

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
/**
 * Chrome Extension Background Script
 * Handles extension icon clicks and messaging with content scripts
 */

class BackgroundController {
  constructor() {
    this.CONTENT_SCRIPT = 'content.js'; // Keep the entry point as content.js
    chrome.action.onClicked.addListener(this.handleClick.bind(this));
  }

  handleClick(tab) {
    // Check if the script is already injected to prevent multiple injections
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__annotatorInjected,
    }).then(results => {
      // Check if results array exists and has content
      const alreadyInjected = results && results[0] && results[0].result;
      if (!alreadyInjected) {
        // Inject the script if not already injected
        console.log(`Injecting ${this.CONTENT_SCRIPT} into tab ${tab.id}`);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [this.CONTENT_SCRIPT]
        })
        .catch(error => console.error(`Failed to inject content script: ${error}`));
      } else {
        console.log(`Annotator script already injected in tab ${tab.id}.`);
        // Optionally, bring the existing annotator UI to focus or notify the user.
      }
    }).catch(err => {
      // Handle potential errors from checking injection status, possibly inject anyway
      console.warn(`Could not check injection status for tab ${tab.id}, attempting to inject anyway:`, err);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [this.CONTENT_SCRIPT]
      })
      .catch(error => console.error(`Failed to inject content script after check failure: ${error}`));
    });
  }
}

// Instantiate the controller to activate the listener
new BackgroundController();
console.log('Background script loaded and listener attached.'); 
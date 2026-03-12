// Read out API Key from storage
async function getApiKey() {
  const data = await chrome.storage.local.get(['gemini_api_key']);
  return data.gemini_api_key;
}

// Initial icon setup
chrome.runtime.onStartup.addListener(checkAndSetIcon);
chrome.runtime.onInstalled.addListener(() => {
  checkAndSetIcon();

  chrome.contextMenus.create({
    id: "explain-text",
    title: "Explain selected text with AI",
    contexts: ["selection"]
  });
});

function checkAndSetIcon() {
    chrome.storage.local.get(['unblock_enabled'], (res) => {
        updateActionIcon(!!res.unblock_enabled);
    });
}

function updateActionIcon(isEnabled) {
    const iconPath = isEnabled ? "icons/icon_active.png" : "icons/icon_default.png";
    chrome.action.setIcon({ path: { "48": iconPath } });
}

// Map of injected tabs
const injectedTabs = new Set();
const autoHostnames = new Set();

chrome.storage.local.get(['auto_hosts'], (res) => {
    if (res.auto_hosts) {
        res.auto_hosts.forEach(h => autoHostnames.add(h));
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.auto_hosts) {
        autoHostnames.clear();
        changes.auto_hosts.newValue.forEach(h => autoHostnames.add(h));
    }
});

// Automatically inject into whitelisted hostnames when a tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url) {
        try {
            const urlObj = new URL(tab.url);
            if (autoHostnames.has(urlObj.hostname)) {
                injectIntoTab(tabId);
            }
        } catch(e) {}
    }
});

// Inject manually if the user clicks the extension icon in the toolbar.
// We remove the default_popup from manifest dynamically if we want the click to act as a button,
// but since we have a settings popup, we will add a manual inject context menu option instead.
chrome.contextMenus.create({
    id: "manual-inject",
    title: "Unlock Selection & Copy on this page",
    contexts: ["page"]
});

async function injectIntoTab(tabId) {
    if (injectedTabs.has(tabId)) return; // Already injected
    
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['inject.js'],
            world: 'MAIN'
        });
        
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['unblock.js', 'content.js']
        });
        
        injectedTabs.add(tabId);
        
        chrome.action.setBadgeText({ tabId: tabId, text: "ON" });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#198754" });
    } catch (e) {
        console.error("Failed to inject", e);
    }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "manual-inject") {
      await injectIntoTab(tab.id);
  } else if (info.menuItemId === "explain-text") {
    // Ensure scripts are loaded before sending message
    await injectIntoTab(tab.id);
    chrome.tabs.sendMessage(tab.id, {
      action: "explain",
      text: info.selectionText
    });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-ai-assistant") {
    await injectIntoTab(tab.id);
    chrome.tabs.sendMessage(tab.id, { action: "toggle-ui" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateIcon") {
      updateActionIcon(request.enabled);
      return false;
  }
  
  if (request.action === "fetchAI") {
    handleAIRequest(request.prompt, sendResponse);
    return true; 
  }
});

async function handleAIRequest(prompt, sendResponse) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ error: "API key not set. Please set it in the extension popup." });
      return;
    }

    const systemInstruction = 'You are a helpful reading and learning assistant. Provide clear, concise explanations and summaries.';
    
    // Gemini API standard endpoint for generating content
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
            parts: [{text: systemInstruction}]
        },
        contents: [{
            parts: [{text: prompt}]
        }]
      })
    });

    if (!response.ok) {
        throw new Error(`API Request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse Gemini's response structure
    let resultText = "No response generated.";
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
      resultText = data.candidates[0].content.parts[0].text;
    }
    
    sendResponse({ text: resultText });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}


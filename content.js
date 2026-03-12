// Listen for commands from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle-ui") {
    toggleAIPanel();
  } else if (request.action === "explain") {
    openAIPanelWithExplanation(request.text);
  }
});

let isUiInjected = false;
let shadowRoot = null;
let hostElement = null;

function createShadowUI() {
  if (isUiInjected) {
    // Ensure it is attached to the topmost full-screen element if one exists
    const targetParent = document.fullscreenElement || document.documentElement;
    if (hostElement && hostElement.parentNode !== targetParent) {
        targetParent.appendChild(hostElement);
    }
    return shadowRoot;
  }

  hostElement = document.createElement('div');
  hostElement.id = "ai-reading-assistant-root";
  
  // Attach shadow DOM so host page CSS doesn't affect our UI
  shadowRoot = hostElement.attachShadow({mode: 'closed'});
  
  const uiContainer = document.createElement('div');
  uiContainer.innerHTML = `
    <style>
      :host {
        all: initial; /* Reset everything */
      }
      .ai-panel { 
        position: fixed; 
        right: -400px; 
        top: 0; 
        width: 380px; 
        height: 100vh; 
        background: #ffffff; 
        z-index: 2147483647; 
        box-shadow: -4px 0 15px rgba(0,0,0,0.1); 
        transition: right 0.3s ease-in-out;
        display: flex;
        flex-direction: column;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #333;
      }
      .ai-panel.open {
        right: 0;
      }
      .header {
        padding: 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
      }
      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        color: #6c757d;
      }
      .close-btn:hover {
        color: #dc3545;
      }
      .content {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        font-size: 15px;
        line-height: 1.6;
      }
      .loading {
        display: none;
        align-items: center;
        gap: 10px;
        color: #0d6efd;
        font-weight: 500;
        margin-top: 15px;
      }
      .spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(13, 110, 253, 0.2);
        border-top-color: #0d6efd;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .explanation-box {
        background: #f1f3f5;
        border-left: 4px solid #0d6efd;
        padding: 15px;
        margin-top: 15px;
        border-radius: 0 4px 4px 0;
        white-space: pre-wrap;
      }
      .error-text {
        color: #dc3545;
        font-weight: 500;
        margin-top: 15px;
      }
      .input-container {
        padding: 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        gap: 10px;
      }
      input[type="text"] {
        flex: 1;
        padding: 10px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        outline: none;
        font-size: 14px;
      }
      input[type="text"]:focus {
        border-color: #86b7fe;
        box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
      }
      button.ask-btn {
        padding: 10px 15px;
        background: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s;
      }
      button.ask-btn:hover {
        background: #0b5ed7;
      }
      .user-message {
        background: #e9ecef;
        padding: 10px 15px;
        border-radius: 12px 12px 12px 0;
        margin-top: 15px;
        display: inline-block;
        max-width: 90%;
      }
      hr {
          border: 0;
          height: 1px;
          background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0));
          margin: 20px 0;
      }
    </style>
    <div class="ai-panel" id="panel">
      <div class="header">
        <h2>AI Assistant</h2>
        <button class="close-btn" id="closeBtn">&times;</button>
      </div>
      <div class="content" id="chatContent">
        <p>I'm here to help you read and learn. Highlight text and right-click to explain it, or ask a question below.</p>
      </div>
      <div class="loading" id="loadingState">
        <div class="spinner"></div> Processing...
      </div>
      <div class="input-container">
        <input type="text" id="askInput" placeholder="Ask a question..." />
        <button class="ask-btn" id="askBtn">Ask</button>
      </div>
    </div>
  `;
  
  shadowRoot.appendChild(uiContainer);
  
  // Append to fullscreen element if active, otherwise document
  const targetParent = document.fullscreenElement || document.documentElement;
  targetParent.appendChild(hostElement);
  
  isUiInjected = true;

  // Bind close button
  shadowRoot.getElementById('closeBtn').addEventListener('click', () => {
    toggleAIPanel(false);
  });

  // Bind Ask button functionality
  const askBtn = shadowRoot.getElementById('askBtn');
  const askInput = shadowRoot.getElementById('askInput');
  
  const handleAsk = () => {
      const q = askInput.value.trim();
      if (!q) return;
      askInput.value = '';
      
      appendUserMessage(q);
      requestAIExplanation(q);
  };

  askBtn.addEventListener('click', handleAsk);
  askInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAsk();
  });

  return shadowRoot;
}

function toggleAIPanel(forceOpen) {
  const shadow = createShadowUI();
  const panel = shadow.getElementById('panel');
  
  if (forceOpen === true) {
    panel.classList.add('open');
  } else if (forceOpen === false) {
    panel.classList.remove('open');
  } else {
    panel.classList.toggle('open');
  }
}

function appendUserMessage(text) {
    const shadow = createShadowUI();
    const chatContent = shadow.getElementById('chatContent');
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'user-message';
    msgDiv.textContent = text;
    chatContent.appendChild(msgDiv);
    chatContent.scrollTo(0, chatContent.scrollHeight);
}

// ==========================================
// AI Sidebar Logic Below
// ==========================================

function openAIPanelWithExplanation(text) {
  toggleAIPanel(true);
  
  const shadow = createShadowUI();
  const chatContent = shadow.getElementById('chatContent');
  
  const divider = document.createElement('hr');
  chatContent.appendChild(divider);
  
  const quoteDiv = document.createElement('div');
  quoteDiv.innerHTML = `<strong>Selected Text:</strong><br/><em>"${text}"</em>`;
  quoteDiv.style.color = '#6c757d';
  quoteDiv.style.marginTop = '15px';
  chatContent.appendChild(quoteDiv);
  chatContent.scrollTo(0, chatContent.scrollHeight);

  const prompt = `Please explain the following text in a clear, concise manner for better understanding:\n\n"${text}"`;
  requestAIExplanation(prompt);
}

function requestAIExplanation(prompt) {
  const shadow = createShadowUI();
  const loadingState = shadow.getElementById('loadingState');
  const chatContent = shadow.getElementById('chatContent');
  
  loadingState.style.display = 'flex';
  
  chrome.runtime.sendMessage({ action: "fetchAI", prompt: prompt }, (response) => {
    loadingState.style.display = 'none';
    
    // Add space block before ai answer
    if (resultBox = document.createElement('div')) {
      resultBox.className = response.error ? 'error-text' : 'explanation-box';
      resultBox.textContent = response.error ? `Error: ${response.error}` : response.text;
      chatContent.appendChild(resultBox);
      chatContent.scrollTo(0, chatContent.scrollHeight);
    }
  });
}

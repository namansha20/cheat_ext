document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const statusMessage = document.getElementById('statusMessage');
    const unblockToggle = document.getElementById('unblockToggle');
    
    const autoHostInput = document.getElementById('autoHost');
    const addHostBtn = document.getElementById('addHostBtn');
    const hostList = document.getElementById('hostList');

    let currentHosts = [];

    function renderHosts() {
        hostList.innerHTML = '';
        currentHosts.forEach(host => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.padding = '4px 8px';
            div.style.background = '#e9ecef';
            div.style.marginBottom = '4px';
            div.style.borderRadius = '4px';
            
            const text = document.createElement('span');
            text.textContent = host;
            
            const btn = document.createElement('span');
            btn.innerHTML = '&times;';
            btn.style.cursor = 'pointer';
            btn.style.color = '#dc3545';
            btn.style.fontWeight = 'bold';
            btn.onclick = () => {
                currentHosts = currentHosts.filter(h => h !== host);
                renderHosts();
                saveHosts();
            };
            
            div.appendChild(text);
            div.appendChild(btn);
            hostList.appendChild(div);
        });
    }

    function saveHosts() {
        chrome.storage.local.set({ auto_hosts: currentHosts });
    }

    // Load existing config
    chrome.storage.local.get(['gemini_api_key', 'unblock_enabled', 'auto_hosts'], (result) => {
        if (result.gemini_api_key) {
            apiKeyInput.value = result.gemini_api_key;
        }
        
        unblockToggle.checked = !!result.unblock_enabled;
        
        if (result.auto_hosts) {
            currentHosts = result.auto_hosts;
            renderHosts();
        }
    });
    
    addHostBtn.addEventListener('click', () => {
        let val = autoHostInput.value.trim();
        // cleanse URL if user pastes a full link
        try {
            if (val.startsWith('http')) {
                val = new URL(val).hostname;
            }
        } catch(e){}
        
        if (val && !currentHosts.includes(val)) {
            currentHosts.push(val);
            autoHostInput.value = '';
            renderHosts();
            saveHosts();
        }
    });

    // Save config
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const isEnabled = unblockToggle.checked;
        
        chrome.storage.local.set({ 
            gemini_api_key: apiKey,
            unblock_enabled: isEnabled 
        }, () => {
            
            // Notify background script to update icon
            chrome.runtime.sendMessage({ action: "updateIcon", enabled: isEnabled });
            
            // Show success message
            statusMessage.classList.remove('hidden');
            statusMessage.textContent = "Saved successfully!";
            statusMessage.style.backgroundColor = "#d1e7dd";
            statusMessage.style.color = "#0f5132";
            
            setTimeout(() => {
                statusMessage.classList.add('hidden');
            }, 3000);
        });
    });
});

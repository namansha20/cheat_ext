// ==========================================
// ANTI-DETECTION: ALWAYS ACTIVE TAB SPOOFER
// This script is injected directly into the page context (MAIN world)
// but it waits for the green-light from the isolated content script.
// ==========================================

(function() {
    let bypassActive = true;
    let styleInterval = null;

    activateSpoofing();

    function activateSpoofing() {
        // 1. Spoof Page Visibility API
        const visibilityHandler = { get: function() { return 'visible'; } };
        const hiddenHandler = { get: function() { return false; } };
        
        try { Object.defineProperty(document, 'visibilityState', visibilityHandler); } catch(e){}
        try { Object.defineProperty(document, 'hidden', hiddenHandler); } catch(e){}
        try { Object.defineProperty(document, 'webkitVisibilityState', visibilityHandler); } catch(e){}
        try { Object.defineProperty(document, 'webkitHidden', hiddenHandler); } catch(e){}

        // 2. Block Visibility Change Events
        const eventsToBlock = [
            'visibilitychange',
            'webkitvisibilitychange',
            'blur',
            'mouseleave',
            'mouseout'
        ];

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (bypassActive && eventsToBlock.includes(type)) {
                return; // Drop listener
            }
            return originalAddEventListener.call(this, type, listener, options);
        };

        // 3. Intercept existing event handlers
        try { Object.defineProperty(window, 'onblur', { set: function() {} }); } catch(e){}
        try { Object.defineProperty(document, 'onvisibilitychange', { set: function() {} }); } catch(e){}
        try { Object.defineProperty(document, 'onblur', { set: function() {} }); } catch(e){}

        // 4. Force Focus state
        Document.prototype.hasFocus = function() { return bypassActive ? true : originalHasFocus.call(this); };
        const originalHasFocus = Document.prototype.hasFocus;

        // 5. Aggressive style override injection into root AND any shadow DOMs
        function injectSuperStyles(rootNode) {
            if (!bypassActive || !rootNode) return;
            const styleId = 'ai-super-unblock';
            if (!rootNode.querySelector(`#${styleId}`)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    * {
                        -webkit-user-select: auto !important;
                        -moz-user-select: auto !important;
                        -ms-user-select: auto !important;
                        user-select: auto !important;
                        pointer-events: auto !important;
                    }
                `;
                
                if (rootNode === document || rootNode === document.documentElement) {
                    if (document.head) document.head.appendChild(style);
                    else document.documentElement.appendChild(style);
                } else {
                    rootNode.appendChild(style);
                }
            }
        }

        injectSuperStyles(document);
        styleInterval = setInterval(() => {
            injectSuperStyles(document);
            if (document.fullscreenElement) {
                injectSuperStyles(document.fullscreenElement);
            }
        }, 1000);
    }
})();

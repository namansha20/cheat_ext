// ==========================================
// MAXIMUM FORCE UNBLOCKER SCRIPT (Injected Manually)
// ==========================================

(function() {
    if (window.__aiUnblockerActive) return;
    window.__aiUnblockerActive = true;

    // 1. Force Text Selection via CSS everywhere, including deep nested nodes
    function forceCSS() {
        const styleId = 'ai-force-selection-css';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                html, body, div, span, applet, object, iframe, h1, h2, h3, h4, h5, h6, p, blockquote, pre, a, abbr, acronym, address, big, cite, code, del, dfn, em, img, ins, kbd, q, s, samp, small, strike, strong, sub, sup, tt, var, b, u, i, center, dl, dt, dd, ol, ul, li, fieldset, form, label, legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, canvas, details, embed, figure, figcaption, footer, header, hgroup, menu, nav, output, ruby, section, summary, time, mark, audio, video, * {
                    -webkit-touch-callout: text !important;
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                    user-select: text !important;
                    pointer-events: auto !important;
                }
            `;
            // Try to add to head, fallback to documentElement
            (document.head || document.documentElement).appendChild(style);
        }

        // Also rip out inline styles just in case
        const all = document.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
            if (all[i].style.userSelect === 'none' || all[i].style.pointerEvents === 'none') {
                all[i].style.userSelect = 'text';
                all[i].style.pointerEvents = 'auto';
            }
        }
    }
    
    forceCSS();
    setInterval(forceCSS, 2000);

    // 2. Nuke Blocking Events at the top level capturing phase
    const eventsToScrub = [
        'contextmenu', 'copy', 'cut', 'paste', 
        'selectstart', 'dragstart', 'mousedown', 'mouseup'
    ];

    eventsToScrub.forEach(evt => {
        // Stop the website from seeing these events
        window.addEventListener(evt, function(e) { e.stopPropagation(); }, true);
        document.addEventListener(evt, function(e) { e.stopPropagation(); }, true);
        document.body.addEventListener(evt, function(e) { e.stopPropagation(); }, true);
    });

    // 3. Clear property-based event handlers natively
    function scrubProperties() {
        const all = document.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
            eventsToScrub.forEach(evt => {
                const prop = 'on' + evt;
                if (all[i][prop]) {
                    all[i][prop] = null;
                }
            });
        }
    }
    
    scrubProperties();
    setInterval(scrubProperties, 2000);

    // 4. Ultimate Hack: Proxy AddEventListener to drop anti-copy scripts
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (eventsToScrub.includes(type)) {
            // Refuse to attach their blocking event
            return;
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    console.log("🔓 AI Reading Assistant: MAXIMUM FORCE unblocker engaged.");
})();

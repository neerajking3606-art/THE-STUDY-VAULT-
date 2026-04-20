// Disable Right Click
document.addEventListener('contextmenu', event => event.preventDefault());

// Disable common DevTools keyboard shortcuts
document.onkeydown = function (e) {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
    }
    
    // Ctrl + Shift + I / J / C (DevTools & Console & Inspector)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
        e.preventDefault();
        return false;
    }

    // Ctrl + U (View Source)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
        return false;
    }
};

// DevTools Debugger loop - Freezes the page when devtools is open
(function blockDevTools() {
    try {
        (function() {
            return false;
        })['constructor']('debugger')();
    } catch (e) {
        // Fallback
        debugger;
    }
    setTimeout(blockDevTools, 100);
})();

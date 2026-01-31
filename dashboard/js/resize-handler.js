// Unified resize handler for the entire panel (both columns + action bar)

class PanelResizeManager {
    constructor() {
        this.isResizing = false;
        this.startY = 0;
        this.startHeight = 0;
        this.panel = null;
        
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        
        this.init();
    }
    
    init() {
        this.setupResizablePanel();
        
        // add global mouse event listeners
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    
    setupResizablePanel() {
        this.panel = document.querySelector('.unified-panel');
        
        if (!this.panel) return;
        
        // create single resize handle at the bottom of the entire panel
        const handle = document.createElement('div');
        handle.className = 'panel-resize-handle';
        this.panel.appendChild(handle);
        
        // add mousedown listener to handle
        handle.addEventListener('mousedown', this.handleMouseDown);
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        
        if (!this.panel) return;
        
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.panel.offsetHeight;
        
        this.panel.classList.add('resizing');
        document.body.classList.add('resizing');
    }
    
    handleMouseMove(e) {
        if (!this.isResizing) return;
        
        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(250, this.startHeight + deltaY);
        
        // apply height to the entire panel
        this.panel.style.height = `${newHeight}px`;
    }
    
    handleMouseUp() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.panel.classList.remove('resizing');
        document.body.classList.remove('resizing');
        
        this.startY = 0;
        this.startHeight = 0;
    }
}

// initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PanelResizeManager();
    });
} else {
    new PanelResizeManager();
}

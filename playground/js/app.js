/**
 * Main application entry point
 */
(async function() {
    const renderer = new HypergraphRenderer('graph');
    const controls = new UIControls(renderer);

    try {
        // load graph data
        const graphData = await api.getGraph();
        
        // render visualization
        await renderer.render(graphData);
        
        // initialize controls
        await controls.initialize(graphData);
        
        console.log('Axiom Router initialized');
    } catch (error) {
        console.error('Failed to initialize:', error);
        document.getElementById('visualization').innerHTML = `
            <div style="padding: 2rem; color: var(--danger);">
                Failed to load graph data. Is the API running?
            </div>
        `;
    }
})();

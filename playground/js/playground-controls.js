/**
 * UI Controls for condition selection and results display
 * Updated: 2026-01-13
 */
class UIControls {
    constructor(renderer) {
        this.renderer = renderer;
        this.selectedConditions = new Set();
        this.allConditions = [];
        this.hullColorMap = new Map(); // pack id -> color
        
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('route-btn').addEventListener('click', () => this.routePatient());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearSelection());
    }

    async initialize(graphData) {
        this.allConditions = graphData.nodes.map(n => n.id).sort();
        
        // build color map from hulls
        graphData.hulls.forEach(hull => {
            this.hullColorMap.set(hull.id, hull.color);
        });
        
        this._renderConditionCheckboxes();
        this._updateGraphInfo(graphData.metadata);
    }

    _renderConditionCheckboxes() {
        const container = document.getElementById('condition-checkboxes');
        container.innerHTML = '';

        this.allConditions.forEach(condition => {
            const item = document.createElement('div');
            item.className = 'condition-item';
            item.innerHTML = `
                <input type="checkbox" id="cond-${condition}" value="${condition}">
                <label for="cond-${condition}">${condition}</label>
            `;

            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedConditions.add(condition);
                    item.classList.add('active');
                } else {
                    this.selectedConditions.delete(condition);
                    item.classList.remove('active');
                }
                this.renderer.highlight(this.selectedConditions);
            });

            container.appendChild(item);
        });
    }

    _updateGraphInfo(metadata) {
        document.getElementById('condition-count').textContent = metadata.total_conditions;
        document.getElementById('pack-count').textContent = metadata.total_packs;
        document.getElementById('config-version').textContent = metadata.config_version;
    }

    async routePatient() {
        if (this.selectedConditions.size === 0) {
            return;
        }

        try {
            const result = await api.routePatient(this.selectedConditions);
            this._displayResults(result.activated_packs);
        } catch (error) {
            console.error('Routing failed:', error);
        }
    }

    _displayResults(packs) {
        const resultsSection = document.getElementById('results-section');
        const resultsContainer = document.getElementById('results');
        
        resultsSection.classList.remove('hidden');
        resultsContainer.innerHTML = '';

        if (packs.length === 0) {
            resultsContainer.innerHTML = '<p style="color: var(--text-secondary)">No packs activated</p>';
            return;
        }

        // sort: interactions first (more conditions = higher priority)
        const sorted = [...packs].sort((a, b) => b.conditions.length - a.conditions.length);

        sorted.forEach(pack => {
            const color = this.hullColorMap.get(pack.id) || '#58a6ff';
            const isInteraction = pack.conditions.length > 1;
            const statusClass = pack.approval_status === 'approved' ? 'approved' : 
                               pack.approval_status === 'draft' ? 'draft' : '';
            const item = document.createElement('div');
            item.className = `result-pack ${isInteraction ? 'interaction' : ''} ${statusClass}`;
            item.style.borderLeftColor = color;
            item.innerHTML = `
                <div class="pack-header">
                    <span class="pack-name">${pack.name}</span>
                    <span class="pack-version">v${pack.version}</span>
                </div>
                <div class="pack-conditions">${pack.conditions.join(' + ')}</div>
                <div class="pack-meta">
                    ${pack.country ? `<span class="country-badge">${pack.country}</span>` : ''}
                    ${pack.approval_status ? `<span class="status-badge ${pack.approval_status}">${pack.approval_status}</span>` : ''}
                </div>
                <div class="pack-regulatory">
                    ${pack.regulatory_body ? `<span>Authority: ${pack.regulatory_body}</span>` : ''}
                    ${pack.reviewer ? `<span>Reviewer: ${pack.reviewer}</span>` : ''}
                    ${pack.last_reviewed ? `<span>Last reviewed: ${pack.last_reviewed}</span>` : ''}
                </div>
            `;
            resultsContainer.appendChild(item);
        });
    }

    clearSelection() {
        this.selectedConditions.clear();
        
        document.querySelectorAll('#condition-checkboxes input').forEach(cb => {
            cb.checked = false;
        });
        document.querySelectorAll('.condition-item').forEach(item => {
            item.classList.remove('active');
        });

        document.getElementById('results-section').classList.add('hidden');
        this.renderer.highlight(new Set());
    }
}

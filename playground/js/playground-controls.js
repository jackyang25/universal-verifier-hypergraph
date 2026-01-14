/**
 * UI Controls for condition selection and results display
 * Updated: 2026-01-13
 */
class UIControls {
    constructor(renderer) {
        this.renderer = renderer;
        this.selectedConditions = new Set();
        this.allConditions = [];
        this.hullColorMap = new Map(); // protocol id -> color
        this.lastActivatedProtocols = [];
        this.graphMetadata = null;
        this.protocolToConditions = new Map(); // protocol id -> conditions (from graph export)
        this.audit = {
            open: false,
            lastRouteAt: null,
            lastVerifyAt: null,
            lastRoute: null,   // { matched_conditions: string[], activated_protocols: object[] }
            lastVerify: null, // { matched_conditions: string[], results: object[] }
        };
        
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('route-btn').addEventListener('click', () => this.routePatient());
        document.getElementById('verify-btn').addEventListener('click', () => this.verifyProtocols());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearSelection());

        const auditToggle = document.getElementById('audit-toggle');
        if (auditToggle) {
            auditToggle.addEventListener('click', () => this._toggleAudit());
        }
    }

    async initialize(graphData) {
        this.allConditions = graphData.nodes.map(n => n.id).sort();
        this.graphMetadata = graphData.metadata || null;
        this.protocolToConditions = new Map(
            (graphData.hulls || []).map(h => [h.id, h.conditions || []])
        );
        
        // build color map from hulls
        graphData.hulls.forEach(hull => {
            this.hullColorMap.set(hull.id, hull.color);
        });
        
        this._renderConditionCheckboxes();
        this._updateGraphInfo(graphData.metadata);
        this._setVerifyEnabled(false);
        this._renderAudit();
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
                // require "Route Patient" first so the user sees what will be verified
                this._setVerifyEnabled(this.lastActivatedProtocols.length > 0);
                this._renderAudit();
            });

            container.appendChild(item);
        });
    }

    _updateGraphInfo(metadata) {
        document.getElementById('condition-count').textContent = metadata.total_conditions;
        document.getElementById('protocol-count').textContent = metadata.total_protocols;
        document.getElementById('config-version').textContent = metadata.config_version;
    }

    async routePatient() {
        if (this.selectedConditions.size === 0) {
            return;
        }

        try {
            const result = await api.routePatient(this.selectedConditions);
            this.lastActivatedProtocols = result.activated_protocols || [];
                this._setVerifyEnabled(this.lastActivatedProtocols.length > 0);
            this._displayResults(this.lastActivatedProtocols);
            this.audit.lastRouteAt = new Date();
            this.audit.lastRoute = {
                matched_conditions: result.matched_conditions || Array.from(this.selectedConditions),
                activated_protocols: this.lastActivatedProtocols,
            };
            this.audit.lastVerifyAt = null;
            this.audit.lastVerify = null;
            this._renderAudit();
        } catch (error) {
            console.error('Routing failed:', error);
            this._auditError('route', error);
        }
    }

    async verifyProtocols() {
        if (this.selectedConditions.size === 0) {
            return;
        }
        if (!this.lastActivatedProtocols || this.lastActivatedProtocols.length === 0) {
            return;
        }

        const verifyBtn = document.getElementById('verify-btn');
        const originalLabel = verifyBtn.textContent;
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            const result = await api.verifyProtocols(this.selectedConditions);
            const resultsByProtocolId = new Map(
                (result?.results || []).map(r => [r.protocol_id, r])
            );
            this._displayResults(this.lastActivatedProtocols, resultsByProtocolId);
            this.audit.lastVerifyAt = new Date();
            this.audit.lastVerify = {
                matched_conditions: result?.matched_conditions || Array.from(this.selectedConditions),
                results: result?.results || [],
            };
            this._renderAudit();
        } catch (error) {
            console.error('Verification failed:', error);
            const resultsSection = document.getElementById('results-section');
            const resultsContainer = document.getElementById('results');
            resultsSection.classList.remove('hidden');
            resultsContainer.innerHTML = `
                <p style="color: var(--danger); font-size: 0.875rem;">
                    Verification failed: ${error?.message || 'unknown error'}
                </p>
            `;
            this._auditError('verify', error);
        } finally {
            verifyBtn.textContent = originalLabel;
            this._setVerifyEnabled(this.lastActivatedProtocols.length > 0);
        }
    }

    _auditError(kind, error) {
        // keep it UI-only and conservative: don't invent semantics
        if (kind === 'route') {
            this.audit.lastRouteAt = new Date();
            this.audit.lastRoute = { error: `${error?.message || 'unknown error'}` };
        } else {
            this.audit.lastVerifyAt = new Date();
            this.audit.lastVerify = { error: `${error?.message || 'unknown error'}` };
        }
        this._renderAudit();
    }

    _setVerifyEnabled(enabled) {
        const btn = document.getElementById('verify-btn');
        if (!btn) return;
        btn.disabled = !enabled;
    }

    _toggleAudit() {
        this.audit.open = !this.audit.open;
        const panel = document.getElementById('audit-panel');
        const toggle = document.getElementById('audit-toggle');
        if (!panel || !toggle) return;

        panel.classList.toggle('collapsed', !this.audit.open);
        panel.setAttribute('aria-hidden', this.audit.open ? 'false' : 'true');
        toggle.setAttribute('aria-expanded', this.audit.open ? 'true' : 'false');
    }

    _renderAudit() {
        const pillsEl = document.getElementById('audit-pills');
        const detailsEl = document.getElementById('audit-details');
        if (!pillsEl || !detailsEl) return; // audit UI may not be present

        const selected = Array.from(this.selectedConditions).sort();
        const totalNodes = this.graphMetadata?.total_conditions ?? null;
        const totalHyperedges = this.graphMetadata?.total_protocols ?? null;
        const configVersion = this.graphMetadata?.config_version ?? null;
        const activated = this.lastActivatedProtocols || [];

        const routeDone = Boolean(this.audit.lastRoute && !this.audit.lastRoute.error);
        const verifyDone = Boolean(this.audit.lastVerify && !this.audit.lastVerify.error);

        // "selected hyperedges" = hyperedges whose AND-conditions are fully satisfied by selection
        const selectedHyperedges = Array.from(this.protocolToConditions.values()).filter(
            (conds) => conds.length > 0 && conds.every(c => this.selectedConditions.has(c))
        ).length;

        const summarizeStatuses = (results) => {
            const counts = {};
            (results || []).forEach(r => {
                const status = r?.status || 'unknown';
                counts[status] = (counts[status] || 0) + 1;
            });
            return counts;
        };

        const fmtTime = (d) => {
            if (!d) return null;
            try {
                return new Intl.DateTimeFormat(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }).format(d);
            } catch {
                return d.toISOString();
            }
        };

        const steps = [
            {
                key: 'inputs',
                label: 'Inputs validated',
                status: selected.length > 0 ? 'done' : 'pending',
                icon: '1',
                detail: selected.length > 0 ? (
                    `selected_nodes=${selected.length}\n` +
                    `nodes=${selected.join(', ')}`
                ) : 'select one or more conditions',
            },
            {
                key: 'graph',
                label: 'Graph initialized',
                status: (totalNodes !== null && totalHyperedges !== null) ? 'done' : 'pending',
                icon: '2',
                detail: (totalNodes !== null && totalHyperedges !== null) ? (
                    `config_version=${configVersion || '-'}\n` +
                    `graph_nodes_total=${totalNodes}\n` +
                    `graph_hyperedges_total=${totalHyperedges}\n` +
                    `selected_nodes=${selected.length}\n` +
                    `selected_hyperedges=${selectedHyperedges}`
                ) : 'graph metadata not loaded',
            },
            {
                key: 'route',
                label: 'Route protocols',
                status: routeDone ? 'done' : (this.audit.lastRoute ? 'error' : 'pending'),
                icon: '3',
                detail: routeDone ? (
                    `time=${fmtTime(this.audit.lastRouteAt) || '-'}\n` +
                    `activated_protocols=${activated.length}\n` +
                    `activated_protocol_ids=${activated.map(p => p.id).join(', ') || '-'}`
                ) : (this.audit.lastRoute?.error
                    ? `time=${fmtTime(this.audit.lastRouteAt) || '-'}\nerror=${this.audit.lastRoute.error}`
                    : 'click “Route Patient”'),
            },
            {
                key: 'verify',
                label: 'Execute verifiers (placeholder)',
                status: verifyDone ? 'done' : (this.audit.lastVerify ? 'error' : 'pending'),
                icon: '4',
                detail: verifyDone ? (
                    `time=${fmtTime(this.audit.lastVerifyAt) || '-'}\n` +
                    `results_by_status=${JSON.stringify(summarizeStatuses(this.audit.lastVerify?.results || []))}`
                ) : (this.audit.lastVerify?.error
                    ? `time=${fmtTime(this.audit.lastVerifyAt) || '-'}\nerror=${this.audit.lastVerify.error}`
                    : 'click “Execute Verifiers” (enabled after routing)'),
            },
        ];

        pillsEl.innerHTML = steps.map(s => `
            <div class="audit-pill ${s.status}">
                <span class="icon">${s.icon}</span>
                <span class="label">${s.label}</span>
            </div>
        `).join('');

        const protocolsSummary = activated
            .slice(0, 6)
            .map(p => `${p.id}@${p.version}${p.guideline ? ` • ${p.guideline}` : ''}`)
            .join('\n');

        detailsEl.innerHTML = steps.map(s => `
            <div class="audit-detail">
                <div class="title">
                    <span>${s.icon}. ${s.label}</span>
                    <span class="meta">${s.key}</span>
                </div>
                <div class="meta">${String(s.detail).replaceAll('\n', '<br/>')}${s.key === 'route' && protocolsSummary ? `<br/><br/>protocols (top):<br/>${protocolsSummary.replaceAll('\n', '<br/>')}` : ''}</div>
            </div>
        `).join('');
    }

    _displayResults(protocols, executionByProtocolId = null) {
        const resultsSection = document.getElementById('results-section');
        const resultsContainer = document.getElementById('results');
        
        resultsSection.classList.remove('hidden');
        resultsContainer.innerHTML = '';

        if (protocols.length === 0) {
            resultsContainer.innerHTML = '<p style="color: var(--text-secondary)">No protocols activated</p>';
            return;
        }

        // sort: interactions first (more conditions = higher priority)
        const sorted = [...protocols].sort((a, b) => b.conditions.length - a.conditions.length);

        sorted.forEach(protocol => {
            const color = this.hullColorMap.get(protocol.id) || '#58a6ff';
            const isInteraction = protocol.conditions.length > 1;
            const statusClass = protocol.approval_status === 'approved' ? 'approved' : 
                               protocol.approval_status === 'draft' ? 'draft' : '';
            const exec = executionByProtocolId ? executionByProtocolId.get(protocol.id) : null;
            const item = document.createElement('div');
            item.className = `result-protocol ${isInteraction ? 'interaction' : ''} ${statusClass}`;
            item.style.borderLeftColor = color;
            item.innerHTML = `
                <div class="protocol-header">
                    <span class="protocol-name">${protocol.name}</span>
                    <span class="protocol-version">v${protocol.version}</span>
                </div>
                <div class="protocol-conditions">${protocol.conditions.join(' + ')}</div>
                <div class="protocol-meta">
                    ${protocol.country ? `<span class="country-badge">${protocol.country}</span>` : ''}
                    ${protocol.approval_status ? `<span class="status-badge ${protocol.approval_status}">${protocol.approval_status}</span>` : ''}
                </div>
                <div class="protocol-regulatory">
                    ${protocol.guideline ? `<span>Guideline: ${protocol.guideline}</span>` : ''}
                    ${protocol.regulatory_body ? `<span>Authority: ${protocol.regulatory_body}</span>` : ''}
                    ${protocol.reviewer ? `<span>Reviewer: ${protocol.reviewer}</span>` : ''}
                    ${protocol.last_reviewed ? `<span>Last reviewed: ${protocol.last_reviewed}</span>` : ''}
                </div>
                ${exec ? `
                    <div class="protocol-execution">
                        <div><strong>Execution</strong>: ${exec.status}</div>
                        ${exec.message ? `<div>${exec.message}</div>` : ''}
                    </div>
                ` : ''}
            `;
            resultsContainer.appendChild(item);
        });
    }

    clearSelection() {
        this.selectedConditions.clear();
        this.lastActivatedProtocols = [];
        this.audit.lastRouteAt = null;
        this.audit.lastVerifyAt = null;
        this.audit.lastRoute = null;
        this.audit.lastVerify = null;
        this._setVerifyEnabled(false);
        
        document.querySelectorAll('#condition-checkboxes input').forEach(cb => {
            cb.checked = false;
        });
        document.querySelectorAll('.condition-item').forEach(item => {
            item.classList.remove('active');
        });

        document.getElementById('results-section').classList.add('hidden');
        this.renderer.highlight(new Set());
        this._renderAudit();
    }
}

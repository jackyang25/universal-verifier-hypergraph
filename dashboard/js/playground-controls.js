/**
 * UI Controls for verification input (conformal set + action + context)
 */
class UIControls {
    constructor(renderer) {
        this.renderer = renderer;
        this.selectedConformal = new Set();
        this.selectedComorbidities = new Set();
        this.selectedStates = new Set();
        this.selectedSubstance = null;
        this.selectedAction = null;
        this.entityCategories = [];
        this.substances = [];
        this.actions = [];
        this.conditionsWithProtocols = new Set();
        this.lastActivatedProtocols = [];
        this.graphMetadata = null;
        this.protocolToConditions = new Map();
        this.hullColorMap = new Map();
        this.audit = {
            lastVerifyAt: null,
            lastVerification: null,
        };
        
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('route-btn').addEventListener('click', () => this.verifyAction());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearSelection());
        document.getElementById('toggle-graph-btn').addEventListener('click', () => this.toggleGraph());
        
        // Action type segmented control
        document.querySelectorAll('.segment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.getAttribute('data-action-type');
                
                // Update active state
                document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Show/hide appropriate section
                document.getElementById('substance-select').classList.toggle('hidden', type !== 'substance');
                document.getElementById('action-select').classList.toggle('hidden', type !== 'action');
                
                // Clear selections in hidden section
                if (type === 'substance') {
                    this.selectedAction = null;
                } else {
                    this.selectedSubstance = null;
                }
            });
        });
        
        // Tab switching - handle each tab group separately
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = btn.getAttribute('data-tab');
                const tabGroup = btn.closest('.card-body, .card');
                this._switchTab(tabName, tabGroup);
            });
        });
        
        // Gestational age slider
        const gaSlider = document.getElementById('ga-weeks');
        const gaDisplay = document.getElementById('ga-weeks-display');
        if (gaSlider && gaDisplay) {
            gaSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value) {
                    gaDisplay.textContent = `${value} weeks`;
                    gaDisplay.style.color = 'var(--accent)';
                } else {
                    gaDisplay.textContent = 'Not set';
                    gaDisplay.style.color = 'var(--text-muted)';
                }
            });
            
            // Initialize display
            if (gaSlider.value) {
                gaDisplay.textContent = `${gaSlider.value} weeks`;
            }
        }
    }

    _switchTab(tabName, tabGroup = null) {
        // If no tab group specified, find the containing group
        if (!tabGroup) {
            tabGroup = document.querySelector(`[data-tab="${tabName}"]`)?.closest('.card-body, .card');
        }
        
        if (!tabGroup) return;
        
        // Update tab buttons within this group only
        tabGroup.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabGroup.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        
        // Update tab panes within this group only
        tabGroup.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const targetPane = tabGroup.querySelector(`#tab-${tabName}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }
    }

    async initialize(graphData) {
        this.graphMetadata = graphData.metadata || null;
        this.protocolToConditions = new Map(
            (graphData.hulls || []).map(h => [h.id, h.conditions || []])
        );
        
        // Build color map from hulls
        graphData.hulls.forEach(hull => {
            this.hullColorMap.set(hull.id, hull.color);
        });
        
        // Load all entities from ontology
        try {
            const entitiesData = await api.getAllEntities();
            if (entitiesData.available && entitiesData.categories) {
                this.entityCategories = entitiesData.categories;
                
                // Extract substances and actions
                entitiesData.categories.forEach(cat => {
                    if (cat.category === 'substance') {
                        this.substances = cat.entities;
                    } else if (cat.category === 'action') {
                        this.actions = cat.entities;
                    }
                });
                
                this.conditionsWithProtocols = new Set(entitiesData.conditions_with_protocols || []);
                this._renderInputsUI();
            }
        } catch (e) {
            console.warn('Could not load ontology entities:', e);
        }
        
        this._updateGraphInfo(graphData.metadata);
        this._renderAudit();
    }

    _renderInputsUI() {
        // Render conformal set as pills (disorders only - tab 1)
        const conformalContainer = document.getElementById('conditions-disorders');
        if (conformalContainer) {
            const disorders = this.entityCategories.find(c => c.category === 'disorder')?.entities || [];
            conformalContainer.innerHTML = disorders.map(entity => `
                <button type="button" class="condition-pill" data-entity-id="${entity.id}" data-entity-name="${entity.name}">
                    ${entity.name}
                </button>
            `).join('');
            
            conformalContainer.querySelectorAll('.condition-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const entityId = e.currentTarget.getAttribute('data-entity-id');
                    
                    if (this.selectedConformal.has(entityId)) {
                        this.selectedConformal.delete(entityId);
                        e.currentTarget.classList.remove('selected');
                    } else {
                        this.selectedConformal.add(entityId);
                        e.currentTarget.classList.add('selected');
                    }
                    
                    this.renderer.highlight(new Set([...this.selectedConformal, ...this.selectedComorbidities]));
                    this._renderAudit();
                });
            });
        }

        // Render substance pills (tab 2)
        const substancePills = document.getElementById('substance-pills');
        if (substancePills) {
            substancePills.innerHTML = this.substances.map(s => `
                <button type="button" class="condition-pill" data-substance-id="${s.id}" data-substance-name="${s.name}">
                    ${s.name}
                </button>
            `).join('');
            
            substancePills.querySelectorAll('.condition-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    // Single selection for substances
                    substancePills.querySelectorAll('.condition-pill').forEach(p => p.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                    this.selectedSubstance = {
                        id: e.currentTarget.getAttribute('data-substance-id'),
                        name: e.currentTarget.getAttribute('data-substance-name')
                    };
                });
            });
        }

        // Render action pills (tab 2)
        const actionPills = document.getElementById('action-pills');
        if (actionPills) {
            actionPills.innerHTML = this.actions.map(a => `
                <button type="button" class="condition-pill" data-action-id="${a.id}" data-action-name="${a.name}">
                    ${a.name}
                </button>
            `).join('');
            
            actionPills.querySelectorAll('.condition-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    // Single selection for actions
                    actionPills.querySelectorAll('.condition-pill').forEach(p => p.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                    this.selectedAction = {
                        id: e.currentTarget.getAttribute('data-action-id'),
                        name: e.currentTarget.getAttribute('data-action-name')
                    };
                });
            });
        }

        // Render comorbidity pills (tab 3)
        const comorbContainer = document.getElementById('context-comorbidities');
        if (comorbContainer) {
            const disorders = this.entityCategories.find(c => c.category === 'disorder')?.entities || [];
            comorbContainer.innerHTML = disorders.map(entity => `
                <button type="button" class="condition-pill" data-entity-id="${entity.id}">
                    ${entity.name}
                </button>
            `).join('');
            
            comorbContainer.querySelectorAll('.condition-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const entityId = e.currentTarget.getAttribute('data-entity-id');
                    
                    if (this.selectedComorbidities.has(entityId)) {
                        this.selectedComorbidities.delete(entityId);
                        e.currentTarget.classList.remove('selected');
                    } else {
                        this.selectedComorbidities.add(entityId);
                        e.currentTarget.classList.add('selected');
                    }
                    
                    this.renderer.highlight(new Set([...this.selectedConformal, ...this.selectedComorbidities]));
                });
            });
        }

        // Render state pills (tab 3)
        const stateContainer = document.getElementById('context-states');
        if (stateContainer) {
            const states = this.entityCategories.find(c => c.category === 'physiologic_state')?.entities || [];
            stateContainer.innerHTML = states.map(entity => `
                <button type="button" class="condition-pill" data-entity-id="${entity.id}">
                    ${entity.name}
                </button>
            `).join('');
            
            stateContainer.querySelectorAll('.condition-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    const entityId = e.currentTarget.getAttribute('data-entity-id');
                    
                    if (this.selectedStates.has(entityId)) {
                        this.selectedStates.delete(entityId);
                        e.currentTarget.classList.remove('selected');
                    } else {
                        this.selectedStates.add(entityId);
                        e.currentTarget.classList.add('selected');
                    }
                });
            });
        }
    }

    _updateGraphInfo(metadata) {
        document.getElementById('condition-count').textContent = metadata.total_conditions || metadata.total_nodes || 0;
        document.getElementById('protocol-count').textContent = metadata.total_protocols || metadata.total_hyperedges || 0;
        document.getElementById('config-version').textContent = metadata.config_version || '-';
    }

    async verifyAction() {
        const verifyBtn = document.getElementById('route-btn');
        
        // Validate inputs
        if (this.selectedConformal.size === 0) {
            alert('Please select at least one condition in the conformal set');
            return;
        }

        const activeSegment = document.querySelector('.segment-btn.active');
        if (!activeSegment) {
            alert('Please select an action type (Medication or Clinical Action)');
            return;
        }
        
        const actionType = activeSegment.getAttribute('data-action-type');

        let proposedAction;
        if (actionType === 'substance') {
            if (!this.selectedSubstance) {
                alert('Please select a medication');
                return;
            }
            const dose = document.getElementById('substance-dose')?.value;
            proposedAction = { type: 'substance', id: this.selectedSubstance.id, dose: dose || '' };
        } else if (actionType === 'action') {
            if (!this.selectedAction) {
                alert('Please select a clinical action');
                return;
            }
            proposedAction = { type: 'action', id: this.selectedAction.id };
        }

        // Build patient context
        const patientContext = {
            comorbidities: Array.from(this.selectedComorbidities),
            states: Array.from(this.selectedStates),
        };
        
        const gaWeeks = document.getElementById('ga-weeks')?.value;
        if (gaWeeks) {
            patientContext.ga_weeks = parseInt(gaWeeks);
        }

        // Disable button and show loading state
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';

        try {
            // Call verification API
            const result = await api.checkSafety(Array.from(this.selectedConformal), proposedAction, patientContext);
            
            this.audit.lastVerifyAt = new Date();
            this.audit.lastVerification = result;
            
            this._displayVerificationResult(result);
            this._renderAudit();
        } catch (error) {
            console.error('Verification failed:', error);
            alert(`Error: ${error.message}`);
            this._auditError('verify', error);
        } finally {
            // Re-enable button
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Safety';
        }
    }

    _auditError(kind, error) {
        if (kind === 'verify') {
            this.audit.lastVerifyAt = new Date();
            this.audit.lastVerification = { error: error.message };
        }
        this._renderAudit();
    }

    clearSelection() {
        this.selectedConformal.clear();
        this.selectedComorbidities.clear();
        this.selectedStates.clear();
        this.selectedSubstance = null;
        this.selectedAction = null;
        
        document.querySelectorAll('.condition-pill').forEach(pill => {
            pill.classList.remove('selected');
        });
        
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('substance-dose').value = '';
        
        const gaSlider = document.getElementById('ga-weeks');
        const gaDisplay = document.getElementById('ga-weeks-display');
        if (gaSlider) gaSlider.value = '';
        if (gaDisplay) {
            gaDisplay.textContent = 'Not set';
            gaDisplay.style.color = 'var(--text-muted)';
        }
        
        document.getElementById('substance-select').classList.add('hidden');
        document.getElementById('action-select').classList.add('hidden');
        
        this.renderer.highlight(new Set());
        this._clearResults();
        this.audit.lastVerification = null;
        this.audit.lastVerifyAt = null;
        this._renderAudit();
    }

    toggleGraph() {
        const graphBody = document.getElementById('graph-body');
        const graphInfo = document.getElementById('graph-info');
        const toggleText = document.getElementById('graph-toggle-text');
        
        if (graphBody && graphInfo) {
            const isHidden = graphBody.classList.contains('hidden');
            
            if (isHidden) {
                graphBody.classList.remove('hidden');
                graphInfo.classList.remove('hidden');
                if (toggleText) toggleText.textContent = 'Hide Graph';
            } else {
                graphBody.classList.add('hidden');
                graphInfo.classList.add('hidden');
                if (toggleText) toggleText.textContent = 'Show Graph';
            }
        }
    }

    _displayVerificationResult(result) {
        const emptyState = document.getElementById('results-empty');
        const statusBadge = document.getElementById('verification-status-badge');
        
        // Update status badge
        if (statusBadge) {
            const status = result.verification_status || 'PENDING';
            statusBadge.textContent = status;
            statusBadge.className = `status-badge status-${status.toLowerCase()}`;
        }

        // Show/hide empty state
        if (result && result.available) {
            emptyState?.classList.add('hidden');
        } else {
            emptyState?.classList.remove('hidden');
            return;
        }

        // Display contraindications
        const contraBox = document.getElementById('cert-contraindications');
        if (contraBox) {
            if (result.contraindications && result.contraindications.length > 0) {
                contraBox.innerHTML = `
                    <h3>Contraindications</h3>
                    ${result.contraindications.map(c => `
                        <div class="safety-item safety-danger">
                            <div class="safety-item-name">${c.substance} contraindicated in ${c.condition}</div>
                            <div class="safety-item-detail"><strong>Strength:</strong> ${c.strength}</div>
                            <div class="safety-item-detail">${c.rationale}</div>
                            <div class="safety-item-detail"><em>${c.guideline}</em></div>
                        </div>
                    `).join('')}
                `;
            } else {
                contraBox.innerHTML = '<p>No contraindications found.</p>';
            }
        }

        // Display requirements
        const reqBox = document.getElementById('cert-requirements');
        if (reqBox) {
            if (result.required_actions && result.required_actions.length > 0) {
                reqBox.innerHTML = `
                    <h3>Required Actions</h3>
                    ${result.required_actions.map(r => `
                        <div class="safety-item ${r.satisfied ? 'safety-success' : 'safety-warning'}">
                            <div class="safety-item-name">${r.action} for ${r.condition} - ${r.satisfied ? 'SATISFIED' : 'NOT SATISFIED'}</div>
                            <div class="safety-item-detail">${r.rationale}</div>
                            <div class="safety-item-detail"><em>${r.guideline}</em></div>
                        </div>
                    `).join('')}
                `;
            } else {
                reqBox.innerHTML = '';
            }
        }

        // Display consistency violations
        const consBox = document.getElementById('cert-consistency');
        if (consBox) {
            if (result.consistency_violations && result.consistency_violations.length > 0) {
                consBox.innerHTML = `
                    <h3>Consistency Violations</h3>
                    ${result.consistency_violations.map(v => `
                        <div class="safety-item safety-warning">
                            <div class="safety-item-name">${v.type}</div>
                            <div class="safety-item-detail">${v.explanation}</div>
                        </div>
                    `).join('')}
                `;
            } else {
                consBox.innerHTML = '';
            }
        }

        // Display alternatives
        const altBox = document.getElementById('cert-alternatives');
        if (altBox) {
            if (result.alternatives && result.alternatives.length > 0) {
                altBox.innerHTML = `
                    <h3>Suggested Alternatives</h3>
                    ${result.alternatives.map(a => `
                        <div class="safety-item safety-success">
                            <div class="safety-item-name">${a.substance || a.action}</div>
                            ${a.dose ? `<div class="safety-item-detail"><strong>Dose:</strong> ${a.dose}</div>` : ''}
                            <div class="safety-item-detail">${a.rationale}</div>
                            <div class="safety-item-detail"><em>${a.guideline}</em></div>
                        </div>
                    `).join('')}
                `;
            } else {
                altBox.innerHTML = '<p>No alternatives needed.</p>';
            }
        }

        // Display dose limits
        const doseBox = document.getElementById('cert-dose-limits');
        if (doseBox) {
            if (result.dose_limits && result.dose_limits.length > 0) {
                doseBox.innerHTML = `
                    <h3>Dose Limits (Informational)</h3>
                    ${result.dose_limits.map(d => `
                        <div class="safety-item safety-info">
                            <div class="safety-item-name">${d.substance} - ${d.category}</div>
                            <div class="safety-item-detail">${d.rationale}</div>
                        </div>
                    `).join('')}
                `;
            } else {
                doseBox.innerHTML = '';
            }
        }

    }

    _clearResults() {
        document.getElementById('results-empty')?.classList.remove('hidden');
        document.getElementById('verification-status-badge').textContent = 'PENDING';
        document.getElementById('verification-status-badge').className = 'status-badge status-pending';
        document.getElementById('cert-contraindications').innerHTML = '';
        document.getElementById('cert-requirements').innerHTML = '';
        document.getElementById('cert-consistency').innerHTML = '';
        document.getElementById('cert-alternatives').innerHTML = '';
        document.getElementById('cert-dose-limits').innerHTML = '';
    }


    _renderAudit() {
        const auditPills = document.getElementById('audit-pills');
        const auditDetails = document.getElementById('audit-details');
        if (!auditDetails || !auditPills) return;

        const verification = this.audit.lastVerification;

        const steps = [
            {
                icon: '①',
                label: 'Graph Initialized',
                status: !!this.graphMetadata ? 'complete' : 'pending',
                info: this.graphMetadata 
                    ? `${this.graphMetadata.total_conditions || this.graphMetadata.total_nodes || 0} nodes • ${this.graphMetadata.total_protocols || this.graphMetadata.total_hyperedges || 0} hyperedges`
                    : null,
            },
            {
                icon: '②',
                label: 'Conformal Set',
                status: this.selectedConformal.size > 0 ? 'complete' : 'pending',
                info: this.selectedConformal.size > 0 
                    ? Array.from(this.selectedConformal).join(', ')
                    : null,
                count: this.selectedConformal.size > 0 ? `${this.selectedConformal.size} conditions` : null,
            },
            {
                icon: '③',
                label: 'Action + Context',
                status: verification ? 'complete' : 'pending',
                info: verification 
                    ? `Action verified with ${this.selectedComorbidities.size} comorbidities`
                    : null,
                count: verification ? 'Complete' : null,
            },
            {
                icon: '④',
                label: 'Verification Result',
                status: verification ? 'complete' : 'pending',
                info: verification,
                count: verification ? verification.verification_status : null,
                timestamp: this.audit.lastVerifyAt,
            },
        ];

        // Render status pills (horizontal summary)
        auditPills.innerHTML = steps.map(s => `
            <div class="audit-pill ${s.status}">
                <span class="audit-step-icon">${s.icon}</span>
                <span class="audit-step-label">${s.label}</span>
                ${s.count ? `<span class="audit-count">${s.count}</span>` : ''}
            </div>
        `).join('');

        // Render detailed information
        auditDetails.innerHTML = `<h3>Execution Trail</h3>` + steps.map((s, idx) => {
            if (!s.info) return '';
            
            let detailContent = '';
            
            if (idx === 0) {
                // Graph info
                detailContent = `<div class="audit-info-text">${s.info}</div>`;
            } else if (idx === 1) {
                // Conformal set
                detailContent = `<div class="audit-info-text">${s.info}</div>`;
            } else if (idx === 2) {
                // Action + context
                detailContent = `<div class="audit-info-text">${s.info}</div>`;
            } else if (idx === 3) {
                // Verification result with process trace
                if (verification.error) {
                    detailContent = `<div class="audit-info-text error">${verification.error}</div>`;
                } else {
                    const contraCount = verification.contraindications?.length || 0;
                    const altCount = verification.alternatives?.length || 0;
                    detailContent = `
                        <div class="audit-metrics">
                            <div class="audit-metric-item ${contraCount > 0 ? 'metric-warning' : ''}">
                                <span class="metric-label">Contraindications:</span>
                                <span class="metric-value">${contraCount}</span>
                            </div>
                            <div class="audit-metric-item">
                                <span class="metric-label">Alternatives:</span>
                                <span class="metric-value">${altCount}</span>
                            </div>
                            <div class="audit-metric-item">
                                <span class="metric-label">Status:</span>
                                <span class="metric-value">${verification.verification_status}</span>
                            </div>
                        </div>
                    `;
                    
                    // Add process trace if available
                    if (verification.process_trace && verification.process_trace.length > 0) {
                        detailContent += `
                            <div class="audit-process-trace" style="margin-top: 1rem;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">Process Trace:</div>
                                <ol class="process-trace-list" style="padding-left: 1.5rem; margin: 0;">
                                    ${verification.process_trace.map(step => `<li style="padding: 0.25rem 0; color: var(--text-secondary);">${step}</li>`).join('')}
                                </ol>
                            </div>
                        `;
                    }
                    
                    // Add Lean proof ID if available
                    if (verification.lean_proof_id) {
                        detailContent += `
                            <div class="audit-lean-proof" style="margin-top: 1rem;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--text-secondary);">Lean 4 Proof:</div>
                                <code style="background: #f3f4f6; padding: 0.5rem; border-radius: 4px; display: block; font-size: 0.875rem;">${verification.lean_proof_id}</code>
                            </div>
                        `;
                    }
                }
            }
            
            return `
                <div class="audit-detail-card ${s.status}">
                    <span class="audit-step-icon">${s.icon}</span>
                    <div>
                        <div class="audit-step-label">${s.label}</div>
                        ${detailContent}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');
    }

}

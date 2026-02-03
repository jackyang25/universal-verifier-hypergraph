/**
 * UI Controls for EMR-style condition selection
 */
class UIControls {
    constructor(renderer) {
        this.renderer = renderer;
        this.selectedConditions = new Set();
        this.entityCategories = [];
        this.conditionsWithProtocols = new Set();
        this.lastActivatedProtocols = [];
        this.graphMetadata = null;
        this.protocolToConditions = new Map();
        this.hullColorMap = new Map();
        this.audit = {
            lastRouteAt: null,
            lastRoute: null,
        };
        
        this._bindEvents();
    }

    _bindEvents() {
        document.getElementById('route-btn').addEventListener('click', () => this.routePatient());
        document.getElementById('clear-btn').addEventListener('click', () => this.clearSelection());
        document.getElementById('toggle-graph-btn').addEventListener('click', () => this.toggleGraph());
        
        // Tab switching - handle each tab group separately
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = btn.getAttribute('data-tab');
                const tabGroup = btn.closest('.card-body, .card');
                this._switchTab(tabName, tabGroup);
            });
        });
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
        
        // Load all entities from ontology for condition selection
        try {
            const entitiesData = await api.getAllEntities();
            if (entitiesData.available && entitiesData.categories) {
                this.entityCategories = entitiesData.categories;
                this.conditionsWithProtocols = new Set(entitiesData.conditions_with_protocols || []);
                this._renderConditionsUI();
            }
        } catch (e) {
            console.warn('Could not load ontology entities:', e);
        }
        
        this._updateGraphInfo(graphData.metadata);
        this._renderAudit();
    }

    _renderConditionsUI() {
        // Map category types to container IDs
        const containerMap = {
            'disorder': 'conditions-disorders',
            'physiologic_state': 'conditions-states',
            'finding': 'conditions-findings'
        };

        // Clear all containers
        Object.values(containerMap).forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '';
        });

        // Render each category in its designated container
        this.entityCategories.forEach(category => {
            const containerId = containerMap[category.category];
            if (!containerId) return;
            
            const container = document.getElementById(containerId);
            if (!container) return;
            
            // Render condition items for this category
            category.entities.forEach(entity => {
                const item = document.createElement('div');
                item.className = 'condition-checkbox-item';
                item.title = entity.description || entity.name;
                
                const hasProtocol = entity.has_protocols;
                
                item.innerHTML = `
                    <input type="checkbox" id="cond-${entity.id}" value="${entity.id}">
                    <label for="cond-${entity.id}" class="condition-label">${entity.name}</label>
                    ${hasProtocol ? '<span class="protocol-indicator has-protocol" title="Has protocols"></span>' : ''}
                `;

                const checkbox = item.querySelector('input');
                const label = item.querySelector('label');
                
                // Make entire item clickable
                item.addEventListener('click', (e) => {
                    // Let checkbox and label handle their own clicks
                    if (e.target === checkbox || e.target === label) return;
                    
                    // Toggle for any other click on the item
                    checkbox.click();
                });
                
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        this.selectedConditions.add(entity.id);
                        item.classList.add('selected');
                    } else {
                        this.selectedConditions.delete(entity.id);
                        item.classList.remove('selected');
                    }
                    this.renderer.highlight(this.selectedConditions);
                    this._renderAudit();
                });

                container.appendChild(item);
            });
        });
    }

    _updateGraphInfo(metadata) {
        document.getElementById('condition-count').textContent = metadata.total_conditions || metadata.total_nodes || 0;
        document.getElementById('protocol-count').textContent = metadata.total_protocols || metadata.total_hyperedges || 0;
        document.getElementById('config-version').textContent = metadata.config_version || '-';
    }

    async routePatient() {
        if (this.selectedConditions.size === 0) {
            alert('Please select at least one condition');
            return;
        }

        try {
            const result = await api.routePatient(this.selectedConditions);
            this.lastActivatedProtocols = result.activated_protocols || [];
            this._displayResults(this.lastActivatedProtocols);
            this._checkSafety();
            
            this.audit.lastRouteAt = new Date();
            this.audit.lastRoute = {
                matched_conditions: result.matched_conditions || Array.from(this.selectedConditions),
                activated_protocols: this.lastActivatedProtocols,
            };
            
            // Trigger safety check and wait for it to complete
            await this._checkSafety();
            this._renderAudit();
        } catch (error) {
            console.error('Routing failed:', error);
            alert(`Error: ${error.message}`);
            this._auditError('route', error);
        }
    }

    _auditError(kind, error) {
        if (kind === 'route') {
            this.audit.lastRouteAt = new Date();
            this.audit.lastRoute = { error: error.message };
        }
        this._renderAudit();
    }

    clearSelection() {
        this.selectedConditions.clear();
        document.querySelectorAll('.condition-checkbox-item').forEach(item => {
            item.classList.remove('selected');
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;
        });
        this.renderer.highlight(this.selectedConditions);
        this._displayResults([]);
        this._checkSafety();
        this.audit.lastRoute = null;
        this.audit.lastRouteAt = null;
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

    _displayResults(protocols) {
        const section = document.getElementById('results-section');
        const results = document.getElementById('results');
        const emptyState = document.getElementById('results-empty');
        const resultsCount = document.getElementById('results-count');

        if (!protocols || protocols.length === 0) {
            results.innerHTML = '';
            emptyState.classList.remove('hidden');
            if (resultsCount) resultsCount.textContent = '0 matched';
            return;
        }

        emptyState.classList.add('hidden');
        if (resultsCount) resultsCount.textContent = `${protocols.length} matched`;

        results.innerHTML = protocols.map(p => {
            const color = this.hullColorMap.get(p.id) || '#999999';
            const proofType = p.proof_type || 'independent';
            const isProven = p.proof_status === 'verified';
            
            let compositionHTML = '';
            const hasComposition = (p.composition_draws_from && p.composition_draws_from.length > 0) || 
                                  (p.composition_coordination && p.composition_coordination.length > 0);
            
            if (hasComposition) {
                compositionHTML = `
                    <div class="protocol-section">
                        <div class="protocol-section-title">Composition</div>
                        <div class="composition-container">`;
                
                // Group coordination points per protocol
                const coordinations = p.composition_coordination || [];
                const drawsFrom = p.composition_draws_from || [];
                
                if (drawsFrom.length > 0) {
                    // Calculate how many coordination points per protocol (roughly)
                    const coordsPerProtocol = Math.ceil(coordinations.length / drawsFrom.length);
                    
                    drawsFrom.forEach((protocolId, idx) => {
                        const startIdx = idx * coordsPerProtocol;
                        const protocolCoords = coordinations.slice(startIdx, startIdx + coordsPerProtocol);
                        
                        compositionHTML += `
                            <div class="composition-protocol-card">
                                <div class="composition-protocol-header">
                                    <div class="composition-protocol-id">${protocolId}</div>
                                </div>
                                ${protocolCoords.length > 0 ? `
                                    <div class="composition-adjustments">
                                        ${protocolCoords.map(coord => `
                                            <div class="composition-adjustment-item">
                                                <span class="adjustment-bullet">•</span>
                                                <span class="adjustment-text">${coord}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    });
                } else if (coordinations.length > 0) {
                    // If no draws_from but has coordinates, show them generically
                    compositionHTML += `
                        <div class="composition-protocol-card">
                            <div class="composition-adjustments">
                                ${coordinations.map(coord => `
                                    <div class="composition-adjustment-item">
                                        <span class="adjustment-bullet">•</span>
                                        <span class="adjustment-text">${coord}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
                
                compositionHTML += `</div>`;
                
                if (p.composition_reason) {
                    compositionHTML += `<div class="composition-reason">${p.composition_reason}</div>`;
                }
                
                compositionHTML += `</div>`;
            }

            return `
                <div class="result-protocol" style="border-left: 4px solid ${color}">
                    <div class="protocol-card-header">
                        <div class="protocol-title-row">
                            <div class="protocol-identifiers">
                                <span class="protocol-id-badge">${p.id}</span>
                            </div>
                            <div class="protocol-badges">
                                <span class="proof-type-badge ${proofType.toLowerCase()}">${proofType.toUpperCase()}</span>
                                ${isProven ? '<span class="proven-badge">✓ Verified</span>' : ''}
                            </div>
                        </div>
                        <h3 class="protocol-name">${p.name || p.guideline}</h3>
                        <div class="protocol-meta-row">
                            <div class="meta-item"><strong>Region:</strong> ${p.country || 'N/A'}</div>
                            <div class="meta-item"><strong>Version:</strong> ${p.version || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="protocol-card-body">
                        <div class="protocol-section">
                            <div class="protocol-section-title">Clinical Context</div>
                            <div class="condition-badges">
                                ${(p.conditions || []).map(c => `<span class="condition-badge">${c}</span>`).join(' + ')}
                            </div>
                        </div>
                        ${compositionHTML}
                        <div class="protocol-section">
                            <div class="protocol-section-title">Regulatory Information</div>
                            <p><strong>Guideline:</strong> ${p.guideline || 'N/A'}</p>
                            <p><strong>Regulatory Body:</strong> ${p.regulatory_body || 'N/A'}</p>
                            ${p.reviewer ? `<p><strong>Reviewed By:</strong> ${p.reviewer}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async _checkSafety() {
        const emptyState = document.getElementById('safety-empty');
        const inconsistenciesBox = document.getElementById('safety-inconsistencies');
        const contraindicationsBox = document.getElementById('safety-contraindications');
        const doseLimitsBox = document.getElementById('safety-dose-limits');
        const interactionsBox = document.getElementById('safety-interactions');
        const treatmentsBox = document.getElementById('safety-treatments');

        // Hide all safety items initially
        inconsistenciesBox.classList.add('hidden');
        contraindicationsBox.classList.add('hidden');
        doseLimitsBox.classList.add('hidden');
        interactionsBox.classList.add('hidden');
        treatmentsBox.classList.add('hidden');

        if (this.selectedConditions.size === 0) {
            emptyState.classList.remove('hidden');
            this.audit.lastSafety = null;
            return;
        }

        try {
            const result = await api.checkSafety(Array.from(this.selectedConditions));
            
            // Store safety results for audit
            this.audit.lastSafety = {
                violations: result.consistency_violations?.length || 0,
                contraindications: result.contraindicated_substances?.length || 0,
                doseLimits: result.dose_limits?.length || 0,
                interactions: result.drug_interactions?.length || 0,
                safeTreatments: result.safe_treatments?.length || 0,
            };
            if (!result || !result.available) {
                emptyState.classList.remove('hidden');
                return;
            }

            let hasContent = false;

            // Display ontology inconsistencies (consistency_violations)
            if (result.consistency_violations && result.consistency_violations.length > 0) {
                hasContent = true;
                inconsistenciesBox.classList.remove('hidden');
                inconsistenciesBox.innerHTML = `
                    <h3><span class="safety-icon-badge warning">⚠</span> Ontology Inconsistencies</h3>
                    <p class="safety-subtitle">Asserted axioms that may conflict</p>
                    ${result.consistency_violations.map(violation => {
                        const parts = violation.split(':');
                        const axiomName = parts[0]?.trim() || violation;
                        const detail = parts.length > 1 ? parts.slice(1).join(':').trim() : '';
                        return `
                            <div class="safety-item safety-warning">
                                <div class="safety-item-name">${axiomName}</div>
                                ${detail ? `<div class="safety-item-detail">${detail}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                `;
            }

            // Display contraindications (contraindicated_substances)
            if (result.contraindicated_substances && result.contraindicated_substances.length > 0) {
                hasContent = true;
                contraindicationsBox.classList.remove('hidden');
                contraindicationsBox.innerHTML = `
                    <h3><span class="safety-icon-badge danger">⊗</span> Contraindicated Substances</h3>
                    <p class="safety-subtitle">Medications to avoid based on ontology</p>
                    ${result.contraindicated_substances.map(c => `
                        <div class="safety-item safety-danger">
                            <div class="safety-item-name">${c.name}</div>
                            <div class="safety-item-detail">${c.reason}</div>
                        </div>
                    `).join('')}
                `;
            }

            // Display dose limits
            if (result.dose_limits && result.dose_limits.length > 0) {
                hasContent = true;
                doseLimitsBox.classList.remove('hidden');
                
                // Format category for display
                const formatCategory = (cat) => {
                    if (!cat) return 'Restricted';
                    return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                };
                
                doseLimitsBox.innerHTML = `
                    <h3><span class="safety-icon-badge info">⚑</span> Dose Restrictions</h3>
                    <p class="safety-subtitle">Safety categories for substances</p>
                    ${result.dose_limits.map(d => `
                        <div class="safety-item safety-info">
                            <div class="safety-item-name">${d.name}</div>
                            <div class="safety-item-detail">${formatCategory(d.category)}</div>
                        </div>
                    `).join('')}
                `;
            }

            // Display drug interactions
            if (result.drug_interactions && result.drug_interactions.length > 0) {
                hasContent = true;
                interactionsBox.classList.remove('hidden');
                interactionsBox.innerHTML = `
                    <h3><span class="safety-icon-badge warning">⚠</span> Drug Interactions</h3>
                    <p class="safety-subtitle">Monitor when combining these treatments</p>
                    ${result.drug_interactions.map(i => `
                        <div class="safety-item safety-warning">
                            <div class="safety-item-name">${i.substance1_name} + ${i.substance2_name}</div>
                            <div class="safety-item-detail">${i.evidence}</div>
                        </div>
                    `).join('')}
                `;
            }

            // Display safe treatments
            if (result.safe_treatments && result.safe_treatments.length > 0) {
                hasContent = true;
                treatmentsBox.classList.remove('hidden');
                treatmentsBox.innerHTML = `
                    <h3><span class="safety-icon-badge success">✓</span> Safe Treatment Options</h3>
                    <p class="safety-subtitle">Treatments supported by ontology axioms</p>
                    ${result.safe_treatments.map(t => `
                        <div class="safety-item safety-success">
                            <div class="safety-item-name">${t.name}</div>
                            <div class="safety-item-detail">${t.indication}</div>
                        </div>
                    `).join('')}
                `;
            }

            // Show/hide content
            if (hasContent) {
                emptyState.classList.add('hidden');
            } else {
                emptyState.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Safety check failed:', error);
            emptyState.classList.remove('hidden');
        }
    }

    _renderAudit() {
        const auditPills = document.getElementById('audit-pills');
        const auditDetails = document.getElementById('audit-details');
        if (!auditDetails || !auditPills) return;

        // Compute metrics from matched protocols
        const protocols = this.audit.lastRoute?.activated_protocols || [];
        const metrics = this._computeMetrics(protocols);

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
                label: 'Conditions Selected',
                status: this.selectedConditions.size > 0 ? 'complete' : 'pending',
                info: this.selectedConditions.size > 0 
                    ? Array.from(this.selectedConditions).join(', ')
                    : null,
                count: this.selectedConditions.size > 0 ? `${this.selectedConditions.size} selected` : null,
            },
            {
                icon: '③',
                label: 'Safety Constraints',
                status: this.audit.lastSafety ? 'complete' : 'pending',
                info: this.audit.lastSafety,
                count: this.audit.lastSafety 
                    ? `${this.audit.lastSafety.violations + this.audit.lastSafety.contraindications} issues`
                    : null,
            },
            {
                icon: '④',
                label: 'Protocols Matched',
                status: this.audit.lastRoute ? 'complete' : 'pending',
                info: protocols.length > 0
                    ? protocols.map(p => ({
                        id: p.id,
                        name: p.name || p.guideline,
                        type: p.proof_type || 'independent',
                        conditions: p.conditions || [],
                    }))
                    : null,
                count: protocols.length > 0 ? `${protocols.length} matched` : null,
                timestamp: this.audit.lastRouteAt,
                metrics: protocols.length > 0 ? metrics : null,
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
                // Selected conditions
                detailContent = `<div class="audit-info-text">${s.info}</div>`;
            } else if (idx === 2) {
                // Safety assessment
                const metrics = [
                    { label: 'Violations', value: s.info.violations, warning: s.info.violations > 0 },
                    { label: 'Contraindications', value: s.info.contraindications, warning: s.info.contraindications > 0 },
                    { label: 'Safe Treatments', value: s.info.safeTreatments }
                ];
                detailContent = `
                    <div class="audit-metrics">
                        ${metrics.map(m => `
                            <div class="audit-metric-item ${m.warning ? 'metric-warning' : ''}">
                                <span class="metric-label">${m.label}:</span>
                                <span class="metric-value">${m.value}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (idx === 3) {
                // Matched protocols with metrics
                const breakdown = [];
                if (s.metrics.byType.independent > 0) breakdown.push(`${s.metrics.byType.independent} independent`);
                if (s.metrics.byType.compositional > 0) breakdown.push(`${s.metrics.byType.compositional} compositional`);
                if (s.metrics.byType.interaction > 0) breakdown.push(`${s.metrics.byType.interaction} interaction`);
                const constrainedDisplay = `${s.metrics.totalAxioms} (${breakdown.join(', ')})`;
                
                // Axioms grounded = total ontology relations evaluated (violations + contraindications + safe treatments)
                const axiomsGrounded = s.metrics.violations + s.metrics.contraindications + s.metrics.safeTreatments;
                
                const metrics = [
                    { label: 'Axioms Grounded', value: axiomsGrounded },
                    { label: 'Protocols Constrained', value: constrainedDisplay },
                    { label: 'Largest Composition', value: s.metrics.maxDepth }
                ];
                detailContent = `
                    <div class="audit-metrics">
                        ${metrics.map(m => `
                            <div class="audit-metric-item">
                                <span class="metric-label">${m.label}:</span>
                                <span class="metric-value">${m.value}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="audit-protocols">
                        ${s.info.map(p => `
                            <div class="audit-protocol-item">
                                <span class="audit-protocol-id">${p.id}</span>
                                <span class="audit-protocol-type">${p.type.toLowerCase()}</span>
                                <span class="audit-protocol-name">${p.name}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
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

    _computeMetrics(protocols) {
        if (!protocols || protocols.length === 0) {
            return {
                totalAxioms: 0,
                totalLemmas: 0,
                maxDepth: 0,
                avgConditions: 0,
                hyperedges: 0,
                subsets: 0,
                contraindications: 0,
                violations: 0,
                safeTreatments: 0,
                byType: { independent: 0, compositional: 0, interaction: 0 }
            };
        }

        // Count axioms (each protocol is a verified axiom)
        const totalAxioms = protocols.length;

        // Count lemmas (coordination points in compositional protocols)
        const totalLemmas = protocols.reduce((sum, p) => {
            return sum + (p.composition_coordination?.length || 0);
        }, 0);

        // Calculate compositional depth (max number of protocols drawn from)
        const maxDepth = Math.max(
            1,
            ...protocols.map(p => (p.composition_draws_from?.length || 0))
        );

        // Average conditions per protocol (hyperedge size)
        const totalConditions = protocols.reduce((sum, p) => {
            return sum + (p.conditions?.length || 0);
        }, 0);
        const avgConditions = totalConditions / protocols.length;

        // Count hyperedges (protocols) and subsets (unique condition combinations)
        const hyperedges = protocols.length;
        const uniqueSubsets = new Set(
            protocols.map(p => (p.conditions || []).sort().join(','))
        ).size;

        // Safety metrics
        const contraindications = this.audit.lastSafety?.contraindications || 0;
        const violations = this.audit.lastSafety?.violations || 0;
        const safeTreatments = this.audit.lastSafety?.safeTreatments || 0;

        // Breakdown by proof type
        const byType = {
            independent: 0,
            compositional: 0,
            interaction: 0
        };

        protocols.forEach(p => {
            const type = (p.proof_type || 'independent').toLowerCase();
            if (byType.hasOwnProperty(type)) {
                byType[type]++;
            }
        });

        return { 
            totalAxioms, 
            totalLemmas, 
            maxDepth, 
            avgConditions,
            hyperedges,
            subsets: uniqueSubsets,
            contraindications,
            violations,
            safeTreatments,
            byType 
        };
    }

}

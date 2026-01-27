// Read the file
const fs = require('fs');
const content = fs.readFileSync('playground-controls.js', 'utf8');

// Find the _displayResults method and replace it
const newMethod = `    _displayResults(protocols) {
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
        if (resultsCount) resultsCount.textContent = \`\${protocols.length} matched\`;
        
        // Create a map of protocols by ID for lookup
        const protocolMap = new Map(protocols.map(p => [p.id, p]));

        results.innerHTML = protocols.map(p => this._renderProtocolCard(p, protocolMap, false)).join('');
    }

    _renderProtocolCard(p, protocolMap, isNested = false) {
        const color = this.hullColorMap.get(p.id) || '#999999';
        const proofType = p.proof_type || 'independent';
        const isProven = p.proof_status === 'verified';
        
        let compositionHTML = '';
        
        // If this protocol draws from other protocols, embed their cards
        if (p.composition_draws_from && p.composition_draws_from.length > 0) {
            const embeddedCards = p.composition_draws_from
                .map(id => {
                    const embeddedProtocol = protocolMap.get(id);
                    if (embeddedProtocol) {
                        return this._renderProtocolCard(embeddedProtocol, protocolMap, true);
                    }
                    return \`<div class="protocol-reference">References: \${id} (not in current result set)</div>\`;
                })
                .join('');
            
            compositionHTML += \`
                <div class="protocol-section">
                    <div class="protocol-section-title">Draws From</div>
                    <div class="embedded-protocols">
                        \${embeddedCards}
                    </div>
                </div>
            \`;
        }
        
        if (p.composition_coordination && p.composition_coordination.length > 0) {
            compositionHTML += \`
                <div class="protocol-section">
                    <div class="protocol-section-title">Coordination</div>
                    <ul class="protocol-composition-list">
                        \${p.composition_coordination.map(item => \`<li class="protocol-composition-item">\${item}</li>\`).join('')}
                    </ul>
                </div>
            \`;
        }
        
        if (p.composition_replaces && p.composition_replaces.length > 0) {
            compositionHTML += \`
                <div class="protocol-section">
                    <div class="protocol-section-title">Replaces</div>
                    <ul class="protocol-composition-list">
                        \${p.composition_replaces.map(id => \`<li class="protocol-composition-item">\${id}</li>\`).join('')}
                    </ul>
                </div>
            \`;
        }
        
        if (p.composition_reason) {
            compositionHTML += \`
                <div class="protocol-section">
                    <div class="protocol-section-title">Reason</div>
                    <p>\${p.composition_reason}</p>
                </div>
            \`;
        }

        const cardClass = isNested ? 'result-protocol nested' : 'result-protocol';

        return \`
            <div class="\${cardClass}" style="border-left: 4px solid \${color}">
                <div class="protocol-card-header">
                    <div class="protocol-title-row">
                        <div class="protocol-identifiers">
                            <span class="protocol-id-badge">\${p.id}</span>
                            \${p.alias ? \`<span class="protocol-alias">\${p.alias}</span>\` : ''}
                        </div>
                        <div class="protocol-badges">
                            <span class="proof-type-badge \${proofType.toLowerCase()}">\${proofType.toUpperCase()}</span>
                            \${isProven ? '<span class="proven-badge">✓ Verified</span>' : ''}
                        </div>
                    </div>
                    <h3 class="protocol-name">\${p.name || p.guideline}</h3>
                    <div class="protocol-meta-row">
                        <div class="meta-item"><strong>Region:</strong> \${p.country || 'N/A'}</div>
                        <div class="meta-item"><strong>Status:</strong> \${p.approval_status || 'N/A'}</div>
                        <div class="meta-item"><strong>Version:</strong> \${p.version || 'N/A'}</div>
                    </div>
                </div>
                <div class="protocol-card-body">
                    <div class="protocol-section">
                        <div class="protocol-section-title">Clinical Context</div>
                        <div class="condition-badges">
                            \${(p.conditions || []).map(c => \`<span class="condition-badge">\${c}</span>\`).join(' + ')}
                        </div>
                    </div>
                    \${compositionHTML}
                    <div class="protocol-section">
                        <div class="protocol-section-title">Regulatory Information</div>
                        <p><strong>Guideline:</strong> \${p.guideline || 'N/A'}</p>
                        <p><strong>Regulatory Body:</strong> \${p.regulatory_body || 'N/A'}</p>
                        \${p.reviewer ? \`<p><strong>Reviewed By:</strong> \${p.reviewer}</p>\` : ''}
                    </div>
                </div>
            </div>
        \`;
    }`;

// Replace the old _displayResults method
const pattern = /    _displayResults\(protocols\) \{[\s\S]*?\n    \}/;
const updated = content.replace(pattern, newMethod);

fs.writeFileSync('playground-controls.js', updated);
console.log('Updated successfully');

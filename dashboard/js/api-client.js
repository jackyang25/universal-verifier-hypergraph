/**
 * API client for Clinical Protocol Router backend
 */
class ProtocolRouterAPI {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }

    async _fetch(endpoint, options = {}) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    // Graph endpoints
    async getGraph(highlightConditions = null) {
        const params = highlightConditions?.length
            ? `?highlight_conditions=${highlightConditions.join(',')}`
            : '';
        return this._fetch(`/graph/export${params}`);
    }

    async getGraphStructure() {
        return this._fetch('/graph/structure');
    }

    // Protocol endpoints
    async getAllProtocols() {
        return this._fetch('/protocols/');
    }

    async getProtocol(protocolId) {
        return this._fetch(`/protocols/${protocolId}`);
    }

    async createProtocol(protocolData) {
        return this._fetch('/protocols/', {
            method: 'POST',
            body: JSON.stringify(protocolData),
        });
    }

    async updateProtocol(protocolId, updates) {
        return this._fetch(`/protocols/${protocolId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteProtocol(protocolId) {
        return this._fetch(`/protocols/${protocolId}`, {
            method: 'DELETE',
        });
    }

    async reloadConfig() {
        return this._fetch('/protocols/reload', {
            method: 'POST',
        });
    }

    // Routing endpoints
    async routePatient(conditions) {
        return this._fetch('/routing/match', {
            method: 'POST',
            body: JSON.stringify({
                conditions: Array.from(conditions),
            }),
        });
    }

    // Ontology safety checks
    async checkSafety(conditions) {
        return this._fetch('/ontology/check', {
            method: 'POST',
            body: JSON.stringify({
                conditions: Array.from(conditions),
            }),
        });
    }

    async getOntologyStatus() {
        return this._fetch('/ontology/status');
    }

    async getAllEntities() {
        return this._fetch('/ontology/entities');
    }

    // Health
    async health() {
        return this._fetch('/health');
    }
}

// export singleton
const api = new ProtocolRouterAPI();

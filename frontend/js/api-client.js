/**
 * API client for Axiom Router backend
 */
class AxiomRouterAPI {
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

    // Pack endpoints
    async getAllPacks() {
        return this._fetch('/packs/');
    }

    async getPack(packId) {
        return this._fetch(`/packs/${packId}`);
    }

    async createPack(packData) {
        return this._fetch('/packs/', {
            method: 'POST',
            body: JSON.stringify(packData),
        });
    }

    async updatePack(packId, updates) {
        return this._fetch(`/packs/${packId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deletePack(packId) {
        return this._fetch(`/packs/${packId}`, {
            method: 'DELETE',
        });
    }

    async reloadConfig() {
        return this._fetch('/packs/reload', {
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

    // Health
    async health() {
        return this._fetch('/health');
    }
}

// export singleton
const api = new AxiomRouterAPI();

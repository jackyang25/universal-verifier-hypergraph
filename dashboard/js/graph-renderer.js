/**
 * D3.js Hypergraph Renderer
 * Clean, consistent visualization of clinical protocol relationships
 */
class HypergraphRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.svg = null;
        this.nodes = [];
        this.hulls = [];
        this.width = 0;
        this.height = 0;
        this.tooltip = d3.select('#tooltip');
        this.isAnimating = false;
        
        this._setupSVG();
        this._setupResize();
    }

    _positionTooltipAboveElement(el) {
        const viz = document.getElementById('visualization');
        const tooltipNode = this.tooltip?.node?.();
        if (!viz || !el || !tooltipNode) return;

        const vizRect = viz.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const tipRect = tooltipNode.getBoundingClientRect();
        const offset = 8;

        const x = (elRect.left - vizRect.left) + (elRect.width / 2) - (tipRect.width / 2);
        const y = (elRect.top - vizRect.top) - tipRect.height - offset;

        this.tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

    _setupSVG() {
        const container = document.getElementById(this.containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select(`#${this.containerId}`)
            .attr('width', this.width)
            .attr('height', this.height);

        // z-order: hulls behind nodes
        this.hullGroup = this.svg.append('g').attr('class', 'hulls');
        this.nodeGroup = this.svg.append('g').attr('class', 'nodes');
    }

    _setupResize() {
        window.addEventListener('resize', () => {
            const container = document.getElementById(this.containerId);
            this.width = container.clientWidth;
            this.height = container.clientHeight;
            this.svg.attr('width', this.width).attr('height', this.height);
            this._layoutNodes();
            this._updatePositions(false);
        });
    }

    async render(graphData) {
        this.nodes = graphData.nodes.map(n => ({...n, x: 0, y: 0}));
        this.hulls = graphData.hulls.map(h => ({...h}));
        this.nodeMap = new Map(this.nodes.map(n => [n.id, n]));

        this._layoutNodes();
        this._drawHulls();
        this._drawNodes();
        this._updatePositions(false);
    }

    _layoutNodes() {
        // simple circular layout - consistent and predictable
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.32;

        this.nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / this.nodes.length - Math.PI / 2;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
        });
    }

    _drawNodes() {
        const nodeSelection = this.nodeGroup.selectAll('.node')
            .data(this.nodes, d => d.id);

        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'node');

        // outer ring (shows on active)
        nodeEnter.append('circle')
            .attr('class', 'ring')
            .attr('r', 24);

        // main circle
        nodeEnter.append('circle')
            .attr('class', 'core')
            .attr('r', 16);

        // label
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('dy', 36)
            .attr('text-anchor', 'middle')
            .text(d => d.id);

        // interactions
        nodeEnter
            .on('mouseenter', (event, d) => this._showTooltip(event, d))
            .on('mouseleave', () => this._hideTooltip());

        nodeSelection.exit().remove();
    }

    _drawHulls() {
        const hullSelection = this.hullGroup.selectAll('.hull-group')
            .data(this.hulls, d => d.id);

        const hullEnter = hullSelection.enter()
            .append('g')
            .attr('class', 'hull-group');

        hullEnter.append('path')
            .attr('class', 'hull')
            .attr('fill', d => d.color)
            .attr('stroke', d => d.color);

        hullSelection.exit().remove();
    }

    _updatePositions(animate = true) {
        const duration = animate ? 500 : 0;

        // update nodes
        this.nodeGroup.selectAll('.node')
            .transition()
            .duration(duration)
            .ease(d3.easeCubicOut)
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // update hulls smoothly
        if (animate) {
            this._animateHulls(duration);
        } else {
            this._updateHullPaths();
        }
    }

    _animateHulls(duration) {
        const steps = 20;
        const interval = duration / steps;
        let step = 0;

        const animate = () => {
            this._updateHullPaths();
            step++;
            if (step < steps) {
                setTimeout(animate, interval);
            }
        };
        animate();
    }

    _updateHullPaths() {
        const padding = 32;

        this.hullGroup.selectAll('.hull-group').each((hull, i, groups) => {
            const group = d3.select(groups[i]);
            const points = hull.conditions
                .map(id => this.nodeMap.get(id))
                .filter(n => n)
                .map(n => [n.x, n.y]);

            if (points.length === 0) {
                group.select('path').attr('d', '');
                return;
            }

            const path = this._createHullPath(points, padding);
            group.select('path').attr('d', path);
        });
    }

    _createHullPath(points, padding) {
        if (points.length === 1) {
            // circle for single node
            const [x, y] = points[0];
            const r = padding;
            return `M ${x - r} ${y} 
                    a ${r} ${r} 0 1 0 ${r * 2} 0 
                    a ${r} ${r} 0 1 0 ${-r * 2} 0`;
        }

        if (points.length === 2) {
            // pill shape for two nodes
            return this._pillPath(points[0], points[1], padding);
        }

        // convex hull for 3+ nodes
        const hull = d3.polygonHull(points);
        if (!hull || hull.length < 3) return '';

        // expand hull outward
        const centroid = this._centroid(hull);
        const expanded = hull.map(p => {
            const dx = p[0] - centroid[0];
            const dy = p[1] - centroid[1];
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            return [
                p[0] + (dx / dist) * padding,
                p[1] + (dy / dist) * padding
            ];
        });

        // smooth curve through points
        return d3.line().curve(d3.curveCardinalClosed.tension(0.75))(expanded);
    }

    _pillPath(p1, p2, padding) {
        const [x1, y1] = p1;
        const [x2, y2] = p2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // perpendicular unit vector
        const px = -dy / len;
        const py = dx / len;
        const r = padding;

        // rectangle with rounded ends
        return `M ${x1 + px * r} ${y1 + py * r}
                L ${x2 + px * r} ${y2 + py * r}
                A ${r} ${r} 0 0 1 ${x2 - px * r} ${y2 - py * r}
                L ${x1 - px * r} ${y1 - py * r}
                A ${r} ${r} 0 0 1 ${x1 + px * r} ${y1 + py * r} Z`;
    }

    _centroid(points) {
        const x = points.reduce((s, p) => s + p[0], 0) / points.length;
        const y = points.reduce((s, p) => s + p[1], 0) / points.length;
        return [x, y];
    }

    _showTooltip(event, d) {
        this.tooltip
            .classed('hidden', false)
            .html(`
                <div class="title">${d.id}</div>
                <div class="info">
                        In ${d.protocol_count} protocol${d.protocol_count !== 1 ? 's' : ''}<br>
                    Status: ${d.active ? '<strong>Active</strong>' : 'Inactive'}
                </div>
            `);
        this._positionTooltipAboveElement(event.currentTarget);
    }

    _hideTooltip() {
        this.tooltip.classed('hidden', true);
    }

    highlight(activeConditions) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const hasActive = activeConditions.size > 0;

        // update node states
        this.nodes.forEach(node => {
            node.active = activeConditions.has(node.id);
        });

        // update hull states
        this.hulls.forEach(hull => {
            hull.active = hull.conditions.every(c => activeConditions.has(c));
        });

        // calculate new positions
        if (hasActive) {
            this._layoutWithSelection(activeConditions);
        } else {
            this._layoutNodes();
        }

        // apply visual updates
        this._applyNodeStyles();
        this._applyHullStyles();
        this._updatePositions(true);

        setTimeout(() => {
            this.isAnimating = false;
        }, 550);
    }

    _layoutWithSelection(activeConditions) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const activeNodes = this.nodes.filter(n => n.active);
        const inactiveNodes = this.nodes.filter(n => !n.active);

        // active nodes: spread in center area
        const activeSpacing = Math.min(120, 300 / Math.max(activeNodes.length, 1));
        activeNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / activeNodes.length - Math.PI / 2;
            const radius = activeNodes.length === 1 ? 0 : activeSpacing;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
        });

        // inactive nodes: outer ring
        const outerRadius = Math.min(this.width, this.height) * 0.38;
        inactiveNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / inactiveNodes.length - Math.PI / 2;
            node.x = centerX + outerRadius * Math.cos(angle);
            node.y = centerY + outerRadius * Math.sin(angle);
        });
    }

    _applyNodeStyles() {
        // find the most specific active protocol for each active node
        const nodeColors = new Map();
        
        // get active hulls sorted by condition count (most specific first)
        const activeHulls = this.hulls
            .filter(h => h.active)
            .sort((a, b) => b.conditions.length - a.conditions.length);
        
        // assign each active node the color of its most specific protocol
        activeHulls.forEach(hull => {
            hull.conditions.forEach(cond => {
                if (!nodeColors.has(cond)) {
                    nodeColors.set(cond, hull.color);
                }
            });
        });

        this.nodeGroup.selectAll('.node')
            .classed('active', d => d.active)
            .each(function(d) {
                const node = d3.select(this);
                const color = d.active ? (nodeColors.get(d.id) || '#58a6ff') : '#8b949e';
                
                node.select('.core').attr('fill', color);
                node.select('.ring')
                    .attr('stroke', d.active ? color : 'transparent')
                    .attr('stroke-opacity', d.active ? 0.4 : 0);
            });
    }

    _applyHullStyles() {
        this.hullGroup.selectAll('.hull-group')
            .classed('visible', d => d.active)
            .select('.hull')
            .classed('active', d => d.active);
    }
}

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
        this.nodes = graphData.nodes.map(n => ({...n, x: 0, y: 0, active: false}));
        this.hulls = graphData.hulls.map(h => ({...h, active: false}));
        this.nodeMap = new Map(this.nodes.map(n => [n.id, n]));

        this._layoutNodes();
        this._drawHulls();
        this._drawNodes();
        this._updatePositions(false);
        
        // Apply initial styles to ensure nothing is highlighted
        this._applyNodeStyles();
        this._applyHullStyles();
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
        this.hullGroup.selectAll('.hull-group').each((hull, i, groups) => {
            const group = d3.select(groups[i]);
            
            // only draw hull if ALL its conditions are active (hull is active)
            if (!hull.active) {
                group.select('path').attr('d', '');
                return;
            }
            
            // get points for all nodes in this active hull
            // make sure to only use THIS hull's nodes, not influenced by any others
            const hullNodes = hull.conditions
                .map(id => this.nodeMap.get(id))
                .filter(n => n);
            
            const points = hullNodes.map(n => [n.x, n.y]);

            if (points.length === 0 || hullNodes.some(n => !n.active)) {
                // if any node in this hull became inactive, hide it
                group.select('path').attr('d', '');
                return;
            }

            // padding needs to account for node radius (24px ring) + extra space
            // for 3+ nodes, needs to be much bigger to clearly show it encompasses other protocols
            const nodeRadius = 24; // outer ring radius
            const extraPadding = points.length >= 3 ? 65 : 20;
            const padding = nodeRadius + extraPadding;
            
            // generate path using ONLY this hull's node positions
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
        if (!hull || hull.length < 3) {
            // fallback to pill shape if hull fails (collinear points)
            if (points.length === 2) return this._pillPath(points[0], points[1], padding);
            // fallback to enclosing circle for other cases
            return this._enclosingCircle(points, padding);
        }

        const nodeVisualRadius = 24; // outer ring radius
        const centroid = this._centroid(points);
        
        // expand hull vertices outward from centroid, maintaining consistent spacing
        const expanded = hull.map(hullPoint => {
            const dx = hullPoint[0] - centroid[0];
            const dy = hullPoint[1] - centroid[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 0.1) {
                return [hullPoint[0] + nodeVisualRadius + padding, hullPoint[1]];
            }
            
            // expand by node visual radius + padding
            const expandDist = nodeVisualRadius + padding;
            return [
                hullPoint[0] + (dx / dist) * expandDist,
                hullPoint[1] + (dy / dist) * expandDist
            ];
        });

        // use smooth curve with very low tension for rounded, circular corners
        // add more intermediate points for smoother curves
        const smoothed = [];
        for (let i = 0; i < expanded.length; i++) {
            const curr = expanded[i];
            const next = expanded[(i + 1) % expanded.length];
            smoothed.push(curr);
            // add 3 intermediate points for very smooth curves
            smoothed.push([
                curr[0] * 0.75 + next[0] * 0.25,
                curr[1] * 0.75 + next[1] * 0.25
            ]);
            smoothed.push([
                curr[0] * 0.5 + next[0] * 0.5,
                curr[1] * 0.5 + next[1] * 0.5
            ]);
            smoothed.push([
                curr[0] * 0.25 + next[0] * 0.75,
                curr[1] * 0.25 + next[1] * 0.75
            ]);
        }
        
        // use basis curve for maximally smooth, circular corners
        return d3.line().curve(d3.curveBasisClosed)(smoothed);
    }
    
    _enclosingCircle(points, padding) {
        // simple bounding circle for fallback
        const xs = points.map(p => p[0]);
        const ys = points.map(p => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const r = Math.max(maxX - minX, maxY - minY) / 2 + padding;
        
        return `M ${cx - r} ${cy} 
                a ${r} ${r} 0 1 0 ${r * 2} 0 
                a ${r} ${r} 0 1 0 ${-r * 2} 0`;
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
        // Cancel any pending animation timer
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
        }

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

        // apply visual updates immediately
        this._applyNodeStyles();
        this._applyHullStyles();
        this._updatePositions(true);

        this.animationTimer = setTimeout(() => {
            this.animationTimer = null;
        }, 500);
    }

    _layoutWithSelection(activeConditions) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const activeNodes = this.nodes.filter(n => n.active);
        const inactiveNodes = this.nodes.filter(n => !n.active);

        // find which active nodes belong to active hyperedges
        const nodesInActiveHulls = new Set();
        const activeHulls = this.hulls.filter(h => h.active);
        activeHulls.forEach(hull => {
            hull.conditions.forEach(cond => nodesInActiveHulls.add(cond));
        });

        // separate active nodes into those in hyperedges vs standalone
        const hullNodes = activeNodes.filter(n => nodesInActiveHulls.has(n.id));
        const standaloneNodes = activeNodes.filter(n => !nodesInActiveHulls.has(n.id));

        // layout nodes that are in active hyperedges - maintain consistent radius
        const baseRadius = Math.min(this.width, this.height) * 0.20;
        const hullRadius = hullNodes.length === 1 ? 0 : baseRadius;
        
        hullNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / hullNodes.length - Math.PI / 2;
            node.x = centerX + hullRadius * Math.cos(angle);
            node.y = centerY + hullRadius * Math.sin(angle);
        });

        // layout standalone active nodes (not in any active hyperedge) at a middle ring
        const standaloneRadius = Math.min(this.width, this.height) * 0.27;
        standaloneNodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / standaloneNodes.length - Math.PI / 2;
            node.x = centerX + standaloneRadius * Math.cos(angle);
            node.y = centerY + standaloneRadius * Math.sin(angle);
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

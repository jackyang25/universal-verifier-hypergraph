"""Export functionality for D3.js visualization."""

from typing import TYPE_CHECKING, Optional
import colorsys

if TYPE_CHECKING:
    from axiom_router.hypergraph import AxiomRouter


class D3Exporter:
    """Export hypergraph data for D3.js visualization."""
    
    def __init__(self, router: "AxiomRouter") -> None:
        """
        Initialize exporter with router.
        
        Args:
            router: AxiomRouter instance to export
        """
        self.router = router
    
    def export_graph(self) -> dict:
        """
        Export graph structure for D3 visualization.
        
        Returns:
            Dictionary with nodes, hulls, and metadata
        """
        nodes = self._build_nodes()
        hulls = self._build_hulls()
        
        return {
            "nodes": nodes,
            "hulls": hulls,
            "metadata": {
                "config_version": self.router.config_version,
                "total_conditions": len(self.router.conditions),
                "total_packs": self.router.pack_count,
            },
        }
    
    def export_with_context(self, active_conditions: set[str]) -> dict:
        """
        Export graph with highlighted active conditions.
        
        Args:
            active_conditions: Set of conditions to highlight
            
        Returns:
            Graph data with highlight information
        """
        nodes = self._build_nodes(active_conditions)
        hulls = self._build_hulls(active_conditions)
        activated_packs = self.router.match(active_conditions)
        
        return {
            "nodes": nodes,
            "hulls": hulls,
            "metadata": {
                "config_version": self.router.config_version,
                "total_conditions": len(self.router.conditions),
                "total_packs": self.router.pack_count,
                "active_conditions": sorted(active_conditions),
                "activated_pack_ids": [p.id for p in activated_packs],
            },
        }
    
    def _build_nodes(self, active_conditions: Optional[set[str]] = None) -> list[dict]:
        """Build node list for D3."""
        active = active_conditions or set()
        nodes = []
        
        for condition in sorted(self.router.conditions):
            # find packs that include this condition
            pack_ids = [
                p.id for p in self.router.packs 
                if condition in p.conditions
            ]
            
            nodes.append({
                "id": condition,
                "type": "condition",
                "active": condition in active,
                "pack_count": len(pack_ids),
                "packs": pack_ids,
            })
        
        return nodes
    
    def _build_hulls(self, active_conditions: Optional[set[str]] = None) -> list[dict]:
        """Build hull list for D3 convex hull rendering."""
        active = active_conditions or set()
        activated_ids = {p.id for p in self.router.match(active)} if active else set()
        
        hulls = []
        colors = self._generate_colors(self.router.pack_count)
        
        for i, pack in enumerate(sorted(self.router.packs, key=lambda p: p.id)):
            is_active = pack.id in activated_ids
            
            hulls.append({
                "id": pack.id,
                "name": pack.name,
                "conditions": sorted(pack.conditions),
                "condition_count": pack.condition_count,
                "is_interaction": pack.is_interaction_pack,
                "active": is_active,
                "color": colors[i],
                "version": pack.version,
            })
        
        return hulls
    
    def _generate_colors(self, count: int) -> list[str]:
        """Generate distinct, vibrant colors for hulls."""
        # curated palette for better visual distinction
        palette = [
            "#60a5fa",  # blue
            "#4ade80",  # green
            "#f472b6",  # pink
            "#facc15",  # yellow
            "#a78bfa",  # purple
            "#fb923c",  # orange
            "#2dd4bf",  # teal
            "#f87171",  # red
            "#38bdf8",  # sky
            "#a3e635",  # lime
            "#e879f9",  # fuchsia
            "#fbbf24",  # amber
        ]
        
        colors = []
        for i in range(count):
            if i < len(palette):
                colors.append(palette[i])
            else:
                # generate additional colors if needed
                hue = (i * 0.618033988749895) % 1  # golden ratio for spacing
                r, g, b = colorsys.hls_to_rgb(hue, 0.6, 0.7)
                colors.append(f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}")
        return colors

"""Config file loading for axiom packs."""

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from axiom_router.hypergraph import AxiomRouter


def load_from_yaml(path: str | Path) -> "AxiomRouter":
    """
    Load axiom router configuration from a YAML file.
    
    Args:
        path: Path to YAML config file
        
    Returns:
        AxiomRouter populated with packs from config
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        yaml.YAMLError: If YAML is malformed
        ValueError: If required fields are missing
    """
    import yaml
    
    from axiom_router.hypergraph import AxiomRouter
    
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    return AxiomRouter.from_dict(data)


def load_from_json(path: str | Path) -> "AxiomRouter":
    """
    Load axiom router configuration from a JSON file.
    
    Args:
        path: Path to JSON config file
        
    Returns:
        AxiomRouter populated with packs from config
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If JSON is malformed
        ValueError: If required fields are missing
    """
    from axiom_router.hypergraph import AxiomRouter
    
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return AxiomRouter.from_dict(data)


def save_to_yaml(router: "AxiomRouter", path: str | Path) -> None:
    """
    Export axiom router configuration to a YAML file.
    
    Args:
        router: AxiomRouter to export
        path: Destination file path
    """
    import yaml
    
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(
            router.to_dict(),
            f,
            default_flow_style=False,
            sort_keys=False,
            allow_unicode=True,
        )


def save_to_json(router: "AxiomRouter", path: str | Path, indent: int = 2) -> None:
    """
    Export axiom router configuration to a JSON file.
    
    Args:
        router: AxiomRouter to export
        path: Destination file path
        indent: JSON indentation level
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(router.to_dict(), f, indent=indent, ensure_ascii=False)

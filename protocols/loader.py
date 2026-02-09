"""Config file loading for clinical protocols."""

import json
from pathlib import Path
from typing import TYPE_CHECKING, Union

import yaml

if TYPE_CHECKING:
    from protocols.router import ProtocolRouter
else:
    # Import at runtime to avoid circular dependency
    from protocols.router import ProtocolRouter


def load_from_yaml(path: Union[str, Path]) -> "ProtocolRouter":
    """
    Load protocol router configuration from a YAML file.
    
    Args:
        path: Path to YAML config file
        
    Returns:
        ProtocolRouter populated with protocols from config
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        yaml.YAMLError: If YAML is malformed
        ValueError: If required fields are missing
    """
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    return ProtocolRouter.from_dict(data)


def load_from_json(path: Union[str, Path]) -> "ProtocolRouter":
    """
    Load protocol router configuration from a JSON file.
    
    Args:
        path: Path to JSON config file
        
    Returns:
        ProtocolRouter populated with protocols from config
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If JSON is malformed
        ValueError: If required fields are missing
    """
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return ProtocolRouter.from_dict(data)


def save_to_yaml(router: "ProtocolRouter", path: Union[str, Path]) -> None:
    """
    Export protocol router configuration to a YAML file.
    
    Args:
        router: ProtocolRouter to export
        path: Destination file path
    """
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


def save_to_json(router: "ProtocolRouter", path: Union[str, Path], indent: int = 2) -> None:
    """
    Export protocol router configuration to a JSON file.
    
    Args:
        router: ProtocolRouter to export
        path: Destination file path
        indent: JSON indentation level
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(router.to_dict(), f, indent=indent, ensure_ascii=False)

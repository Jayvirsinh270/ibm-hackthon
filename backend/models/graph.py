"""
backend/models/graph.py
Pydantic models for graph nodes and edges.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


class NodeType(str, Enum):
    FILE     = "file"
    CLASS    = "class"
    FUNCTION = "function"
    TEST     = "test"


class EdgeType(str, Enum):
    IMPORT      = "import"
    CALL        = "call"
    INHERITS    = "inherits"
    TEST_COVERS = "tests"


@dataclass
class GraphNode:
    id: str                      # dotted node id  e.g. "auth.login.AuthService"
    label: str                   # display name
    type: NodeType
    file_path: str               # absolute path to source file
    module_name: str             # dotted module  e.g. "auth.login"
    line_number: int = 0
    git_churn: int = 0           # populated in Phase 5


@dataclass
class GraphEdge:
    id: str                      # "{source}->{target}"
    source: str
    target: str
    type: EdgeType


@dataclass
class DependencyEdge:
    source_id: str
    target_id: str
    edge_type: EdgeType

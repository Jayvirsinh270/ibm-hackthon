"""
backend/models/parsed_file.py
Pydantic models for parsed Python source file data.
"""
from dataclasses import dataclass, field


@dataclass
class ImportInfo:
    module: str           # e.g. "auth.login" or "os"
    names: list[str]      # specific names imported, empty = "import module"
    is_relative: bool     # True for "from . import foo"


@dataclass
class FunctionInfo:
    name: str
    line_number: int
    calls: list[str]      # names of functions/methods called inside
    is_method: bool       # True when defined inside a class


@dataclass
class ClassInfo:
    name: str
    line_number: int
    bases: list[str]      # parent class names
    methods: list[str]    # method names defined in this class


@dataclass
class ParsedFile:
    path: str             # absolute path to the source file
    module_name: str      # dotted module name derived from path
    classes: list[ClassInfo] = field(default_factory=list)
    functions: list[FunctionInfo] = field(default_factory=list)
    imports: list[ImportInfo] = field(default_factory=list)
    is_test: bool = False
    parse_error: str | None = None

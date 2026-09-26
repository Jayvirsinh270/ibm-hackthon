"""
backend/cli.py
X-Ray CLI — Command-line interface for local change impact analysis.
Enables developers to analyze git diffs directly in their terminal and CI/CD pipelines.

Usage:
  python -m backend.cli diff [--repo-dir DIR] [--fail-on {HIGH,MEDIUM}] [--ai]
  python -m backend.cli scan [DIR]
"""
from __future__ import annotations
import argparse
import asyncio
import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Terminal ANSI styling helpers
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"
BG_RED = "\033[41m\033[37m"
BG_YELLOW = "\033[43m\033[30m"
BG_GREEN = "\033[42m\033[30m"


def _print_banner():
    banner = f"""
{BLUE}{BOLD}   [X-RAY]{RESET} {CYAN}Intelligent Software Change Impact Analyzer{RESET}
{DIM}   -----------------------------------------------------{RESET}
"""
    sys.stdout.write(banner)


def _get_git_diff(repo_dir: str, commit: str | None = None, base: str | None = None) -> str:
    """Extract git diff from the local repository."""
    try:
        import git
        repo = git.Repo(repo_dir, search_parent_directories=True)
    except Exception as exc:
        raise RuntimeError(f"Not a valid git repository: {repo_dir} ({exc})")

    if base:
        # Compare base branch to HEAD
        diff_text = repo.git.diff(f"{base}...HEAD")
    elif commit:
        # Diff for specific commit
        diff_text = repo.git.diff(f"{commit}~1", commit)
    else:
        # Working tree changes: staged + unstaged
        unstaged = repo.git.diff()
        staged = repo.git.diff("--cached")
        diff_text = f"{staged}\n{unstaged}".strip()

    return diff_text


def _scan_local_repo(repo_dir: str):
    """Parse local repository and build in-memory graph."""
    from backend.analysis.parser import parse_all_files
    from backend.analysis.dependency_analyzer import extract_dependencies
    from backend.analysis.git_analyzer import analyze_git
    from backend.graph.builder import build_graph

    py_files: list[str] = []
    for root, _dirs, files in os.walk(repo_dir):
        if any(skip in root for skip in (".git", ".venv", "node_modules", "__pycache__", "dist")):
            continue
        for f in files:
            if f.endswith(".py"):
                py_files.append(os.path.join(root, f))

    if not py_files:
        raise RuntimeError(f"No Python files found in {repo_dir}")

    parsed = parse_all_files(py_files, repo_dir)
    edges = extract_dependencies(parsed, repo_dir)
    git_data = analyze_git(repo_dir)
    G = build_graph(parsed, edges, git_data=git_data)
    return G, py_files


def run_diff_command(args: argparse.Namespace) -> int:
    """Execute 'xray diff' command."""
    _print_banner()

    repo_dir = os.path.abspath(args.repo_dir)
    diff_text = ""

    # 1. Read diff
    if args.diff_file:
        if args.diff_file == "-":
            diff_text = sys.stdin.read()
        else:
            with open(args.diff_file, "r", encoding="utf-8") as f:
                diff_text = f.read()
    else:
        sys.stdout.write(f"{DIM}Reading Git working copy changes in {repo_dir}…{RESET}\n")
        try:
            diff_text = _get_git_diff(repo_dir, commit=args.commit, base=args.base)
        except Exception as exc:
            sys.stderr.write(f"{RED}Error:{RESET} {exc}\n")
            return 1

    if not diff_text.strip():
        sys.stdout.write(f"{GREEN}[OK] No changes detected in working copy.{RESET}\n")
        return 0

    # 2. Build local graph
    sys.stdout.write(f"{DIM}Scanning repository and building dependency graph...{RESET}\n")
    try:
        G, py_files = _scan_local_repo(repo_dir)
    except Exception as exc:
        sys.stderr.write(f"{RED}Error building graph:{RESET} {exc}\n")
        return 1

    sys.stdout.write(
        f"{DIM}Indexed {len(py_files)} files -> {G.number_of_nodes()} nodes, {G.number_of_edges()} dependencies.{RESET}\n\n"
    )

    # 3. Analyze diff impact
    from backend.analysis.diff_analyzer import analyze_diff_impact
    result = analyze_diff_impact(G, diff_text, change_description=args.desc or "Local working copy changes")

    # 4. Render Terminal UI
    # Risk Badge
    risk_color = (
        BG_RED if result.risk.level.value == "HIGH"
        else BG_YELLOW if result.risk.level.value == "MEDIUM"
        else BG_GREEN
    )
    badge = f" {result.risk.level.value} RISK ({result.risk.score:.2f}) "
    sys.stdout.write(f"{BOLD}Risk Assessment:{RESET} {risk_color}{BOLD}{badge}{RESET}\n")

    # Contributing factors
    sys.stdout.write(f"\n{BOLD}Key Findings:{RESET}\n")
    for factor in result.risk.contributing_factors:
        sys.stdout.write(f"  * {factor}\n")

    # Changed symbols
    sys.stdout.write(f"\n{BOLD}Changed Code Symbols ({len(result.changed_symbols)}):{RESET}\n")
    for sym in result.changed_symbols:
        icon = "[fn]" if sym.type == "function" else "[cls]" if sym.type == "class" else "[file]"
        sys.stdout.write(f"  {CYAN}{icon}{RESET} {BOLD}{sym.label}{RESET} {DIM}(line {sym.line_number} in {sym.file_path}){RESET}\n")

    # Direct impact
    if result.direct_affected:
        sys.stdout.write(f"\n{BOLD}Directly Affected ({len(result.direct_affected)}):{RESET}\n")
        for comp in result.direct_affected:
            label = comp.get("label", comp.get("id"))
            mod = comp.get("module_name", "")
            sys.stdout.write(f"  {YELLOW}->{RESET} {label} {DIM}({mod}){RESET}\n")
    else:
        sys.stdout.write(f"\n{DIM}No external components directly affected.{RESET}\n")

    # Transitive impact
    if result.transitive_affected:
        sys.stdout.write(f"\n{BOLD}Transitive Blast Radius ({len(result.transitive_affected)}):{RESET}\n")
        for comp in result.transitive_affected[:8]:
            label = comp.get("label", comp.get("id"))
            mod = comp.get("module_name", "")
            sys.stdout.write(f"  {DIM}  |-> {label} ({mod}){RESET}\n")
        if len(result.transitive_affected) > 8:
            sys.stdout.write(f"  {DIM}  ... and {len(result.transitive_affected) - 8} more{RESET}\n")

    # Related tests & test command recommendation
    sys.stdout.write(f"\n{BOLD}Test Suite Status:{RESET}\n")
    if result.related_tests:
        test_paths = sorted({t.get("file_path", "") for t in result.related_tests if t.get("file_path")})
        sys.stdout.write(f"  {GREEN}[OK] Covered by {len(result.related_tests)} test component(s):{RESET}\n")
        for tp in test_paths:
            sys.stdout.write(f"    * {os.path.relpath(tp, repo_dir)}\n")
        
        rel_test_cmd = " ".join(os.path.relpath(tp, repo_dir) for tp in test_paths)
        sys.stdout.write(f"\n{BOLD}Recommended Verification Command:{RESET}\n")
        sys.stdout.write(f"  {GREEN}{BOLD}pytest {rel_test_cmd}{RESET}\n")
    else:
        sys.stdout.write(f"  {RED}[!] No tests found covering the impacted code paths!{RESET}\n")

    if result.untested_affected:
        sys.stdout.write(f"\n{YELLOW}{BOLD}[!] Untested Downstream Dependencies ({len(result.untested_affected)}):{RESET}\n")
        for comp in result.untested_affected[:5]:
            label = comp.get("label", comp.get("id"))
            sys.stdout.write(f"  {YELLOW}!{RESET} {label} lacks test coverage\n")
        if len(result.untested_affected) > 5:
            sys.stdout.write(f"  ... and {len(result.untested_affected) - 5} more\n")

    # Optional AI Explanation
    if args.ai:
        sys.stdout.write(f"\n{MAGENTA}{BOLD}Requesting watsonx.ai Architecture Assessment...{RESET}\n")
        from backend.models.ai import AIContext
        from backend.ai.factory import get_ai_service

        ctx = AIContext(
            selected_node_id=", ".join(s.node_id for s in result.changed_symbols[:5]),
            selected_node_label=f"Git Diff ({len(result.changed_symbols)} symbols)",
            selected_node_type="git_diff",
            change_description=args.desc or "Working copy changes",
            direct_affected=result.direct_affected,
            transitive_affected=result.transitive_affected,
            related_tests=result.related_tests,
            risk_level=result.risk.level.value,
            risk_score=result.risk.score,
            max_depth=result.max_depth,
            contributing_factors=result.risk.contributing_factors,
        )

        ai = get_ai_service()
        try:
            explanation = asyncio.run(ai.explain_impact(ctx))
            sys.stdout.write(f"\n{BOLD}watsonx.ai Migration & Safety Plan:{RESET}\n")
            sys.stdout.write(f"{explanation.explanation}\n")
            if explanation.risk_areas:
                sys.stdout.write(f"\n{BOLD}Risk Areas to Guard:{RESET}\n")
                for area in explanation.risk_areas:
                    sys.stdout.write(f"  * {area}\n")
            if explanation.migration_plan:
                sys.stdout.write(f"\n{BOLD}Step-by-Step Plan:{RESET}\n")
                for i, step in enumerate(explanation.migration_plan, 1):
                    sys.stdout.write(f"  {i}. {step}\n")
        except Exception as exc:
            sys.stderr.write(f"{YELLOW}AI explanation failed: {exc}{RESET}\n")

    sys.stdout.write("\n" + "-" * 60 + "\n")

    # CI Quality Gate Check
    if args.fail_on:
        threshold = args.fail_on.upper()
        if threshold == "MEDIUM" and result.risk.level.value in ("MEDIUM", "HIGH"):
            sys.stderr.write(f"{RED}{BOLD}CI Gate Failed:{RESET} Risk level {result.risk.level.value} meets or exceeds --fail-on={threshold}\n")
            return 1
        elif threshold == "HIGH" and result.risk.level.value == "HIGH":
            sys.stderr.write(f"{RED}{BOLD}CI Gate Failed:{RESET} Risk level HIGH violates --fail-on=HIGH\n")
            return 1

    return 0


def run_scan_command(args: argparse.Namespace) -> int:
    """Execute 'xray scan' command."""
    _print_banner()
    repo_dir = os.path.abspath(args.path)
    sys.stdout.write(f"{DIM}Scanning repository in {repo_dir}...{RESET}\n")

    try:
        G, py_files = _scan_local_repo(repo_dir)
    except Exception as exc:
        sys.stderr.write(f"{RED}Error:{RESET} {exc}\n")
        return 1

    sys.stdout.write(f"\n{GREEN}{BOLD}[OK] Scan Complete{RESET}\n")
    sys.stdout.write(f"  * Python files: {len(py_files)}\n")
    sys.stdout.write(f"  * Graph nodes:  {G.number_of_nodes()}\n")
    sys.stdout.write(f"  * Dependencies: {G.number_of_edges()}\n")

    # Show top central hubs (highest in-degree)
    in_degrees = sorted(G.in_degree(), key=lambda x: x[1], reverse=True)[:5]
    if in_degrees:
        sys.stdout.write(f"\n{BOLD}Top Most-Depended-Upon Components (Core Hubs):{RESET}\n")
        for nid, deg in in_degrees:
            label = G.nodes[nid].get("label", nid)
            ntype = G.nodes[nid].get("type", "node")
            sys.stdout.write(f"  * {CYAN}{label}{RESET} ({ntype}) -- {deg} direct dependents\n")

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="xray",
        description="X-Ray: Intelligent Software Change Impact Analyzer",
    )
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # diff command
    diff_parser = subparsers.add_parser("diff", help="Analyze blast radius of uncommitted or committed Git changes")
    diff_parser.add_argument("--repo-dir", "-d", default=".", help="Path to repository directory (default: current dir)")
    diff_parser.add_argument("--diff-file", "-f", help="Path to unified diff file (or '-' for stdin)")
    diff_parser.add_argument("--commit", "-c", help="Specific commit hash to analyze (e.g. HEAD~1)")
    diff_parser.add_argument("--base", "-b", help="Base branch/commit to compare HEAD against (e.g. main)")
    diff_parser.add_argument("--desc", help="Optional description of the proposed change")
    diff_parser.add_argument("--ai", action="store_true", help="Request watsonx.ai migration plan in terminal")
    diff_parser.add_argument("--fail-on", choices=["HIGH", "MEDIUM"], help="Exit with code 1 if risk meets or exceeds threshold (for CI/CD)")

    # scan command
    scan_parser = subparsers.add_parser("scan", help="Scan repository structure and print dependency summary")
    scan_parser.add_argument("path", nargs="?", default=".", help="Path to repository directory")

    args = parser.parse_args()

    if args.command == "diff":
        sys.exit(run_diff_command(args))
    elif args.command == "scan":
        sys.exit(run_scan_command(args))
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()

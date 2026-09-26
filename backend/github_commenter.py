"""
backend/github_commenter.py
Standalone GitHub Actions PR Commenter for X-Ray.

Reads an X-Ray markdown report and creates or updates a sticky comment
on the target GitHub Pull Request using GitHub's REST API.
Zero external dependencies (uses standard library urllib).
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

MARKER = "<!-- X-RAY-PR-IMPACT-REPORT -->"


def post_or_update_comment(repo: str, pr: int, report_file: str, token: str) -> int:
    """Find existing X-Ray comment on PR and update it, or post a new one."""
    if not os.path.exists(report_file):
        sys.stderr.write(f"Error: Report file '{report_file}' not found.\n")
        return 1

    with open(report_file, "r", encoding="utf-8") as f:
        body = f.read().strip()

    if not body:
        sys.stderr.write("Warning: Report file is empty, skipping PR comment.\n")
        return 0

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "X-Ray-Impact-Action",
    }

    base_api = f"https://api.github.com/repos/{repo}"

    # 1. Look for existing comment with our marker
    existing_comment_id = None
    list_url = f"{base_api}/issues/{pr}/comments?per_page=100"
    req = urllib.request.Request(list_url, headers=headers)

    try:
        with urllib.request.urlopen(req) as resp:
            comments = json.loads(resp.read().decode("utf-8"))
            for c in comments:
                if MARKER in c.get("body", ""):
                    existing_comment_id = c["id"]
                    break
    except urllib.error.HTTPError as exc:
        sys.stderr.write(f"Warning: Failed to fetch PR comments (HTTP {exc.code}): {exc.read().decode('utf-8', errors='replace')}\n")
    except Exception as exc:
        sys.stderr.write(f"Warning: Error querying PR comments: {exc}\n")

    # 2. Patch existing comment or create new one
    payload = json.dumps({"body": body}).encode("utf-8")

    if existing_comment_id:
        patch_url = f"{base_api}/issues/comments/{existing_comment_id}"
        req = urllib.request.Request(patch_url, data=payload, headers=headers, method="PATCH")
        action = f"Updated existing PR comment #{existing_comment_id}"
    else:
        post_url = f"{base_api}/issues/{pr}/comments"
        req = urllib.request.Request(post_url, data=payload, headers=headers, method="POST")
        action = "Posted new PR comment"

    try:
        with urllib.request.urlopen(req) as resp:
            sys.stdout.write(f"[OK] {action} on {repo}#{pr} (HTTP {resp.status})\n")
            return 0
    except urllib.error.HTTPError as exc:
        sys.stderr.write(f"Error posting PR comment (HTTP {exc.code}): {exc.read().decode('utf-8', errors='replace')}\n")
        return 1
    except Exception as exc:
        sys.stderr.write(f"Error posting PR comment: {exc}\n")
        return 1


def main():
    parser = argparse.ArgumentParser(description="Post X-Ray impact analysis report to a GitHub PR")
    parser.add_argument("--report", required=True, help="Path to markdown report file")
    parser.add_argument("--repo", required=True, help="Repository in 'owner/repo' format")
    parser.add_argument("--pr", type=int, required=True, help="Pull request number")
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"), help="GitHub token (defaults to GITHUB_TOKEN env var)")

    args = parser.parse_args()

    if not args.token:
        sys.stderr.write("Error: GITHUB_TOKEN not provided.\n")
        sys.exit(1)

    sys.exit(post_or_update_comment(args.repo, args.pr, args.report, args.token))


if __name__ == "__main__":
    main()

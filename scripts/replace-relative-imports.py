import os
import re

# Target directories to clean up and evaluate
TARGET_DIRS = ["core/src", "sandbox/apps"]

# Mappings of workspace directories to aliases relative to the monorepo root
ALIASES = [
    {"prefix": "core/src/backend/", "alias": "@backend/"},
    {"prefix": "core/src/database/", "alias": "@database/"},
    {"prefix": "sandbox/apps/", "alias": "@apps/"},
    {"prefix": "packages/sdk/", "alias": "@sdk/"},
    {"prefix": "test/", "alias": "@test/"},
]

# Regex patterns to find imports, exports, and requires
IMPORT_PATTERNS = [
    # import ... from '...'
    re.compile(r'(from\s+[\'"])([^\'"]+)([\'"])'),
    # import('...')
    re.compile(r'(import\([\'"])([^\'"]+)([\'"]\))'),
    # require('...')
    re.compile(r'(require\([\'"])([^\'"]+)([\'"]\))'),
    # export ... from '...'
    re.compile(r'(export\s+.*from\s+[\'"])([^\'"]+)([\'"])'),
]


def resolve_target_path(file_dir, rel_path, root_path):
    # Normalize the relative path
    abs_path = os.path.abspath(os.path.join(file_dir, rel_path))
    # Get relative to root_path
    rel_to_root = os.path.relpath(abs_path, root_path)
    return rel_to_root


def find_alias(file_path, target_rel_to_root, root_path):
    # Check if the importing file is inside core/src/frontend
    file_rel_to_root = os.path.relpath(file_path, root_path)
    is_frontend_file = file_rel_to_root.startswith("core/src/frontend")

    # If target is inside core/src/frontend, and the importing file is also inside core/src/frontend,
    # use the Next.js @/* alias.
    if is_frontend_file and target_rel_to_root.startswith("core/src/frontend/"):
        sub_path = target_rel_to_root[len("core/src/frontend/") :]
        return f"@/{sub_path}"

    # For other mappings
    for item in ALIASES:
        if target_rel_to_root.startswith(item["prefix"]):
            sub_path = target_rel_to_root[len(item["prefix"]) :]
            return f"{item['alias']}{sub_path}"

    # If target is core/src/frontend but the importing file is NOT in core/src/frontend
    if target_rel_to_root.startswith("core/src/frontend/"):
        sub_path = target_rel_to_root[len("core/src/frontend/") :]
        return f"@frontend/{sub_path}"

    return None


def process_file(file_path, root_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    file_dir = os.path.dirname(file_path)
    modified = False
    new_content = content

    lines = content.split("\n")
    for idx, line in enumerate(lines):
        # Skip commented lines
        if line.strip().startswith("//") or line.strip().startswith("*"):
            continue

        current_line = line
        for pattern in IMPORT_PATTERNS:

            def repl(match):
                nonlocal modified
                prefix, rel_path, suffix = match.groups()

                # We only want to convert relative imports that start with .
                if rel_path.startswith("."):
                    target_rel_to_root = resolve_target_path(
                        file_dir, rel_path, root_path
                    )
                    alias_path = find_alias(file_path, target_rel_to_root, root_path)
                    if alias_path:
                        # Normalize slashes
                        alias_path = alias_path.replace("\\", "/")
                        modified = True
                        print(
                            f"[{os.path.basename(file_path)}:{idx+1}] {rel_path} -> {alias_path}"
                        )
                        return f"{prefix}{alias_path}{suffix}"
                return match.group(0)

            current_line = pattern.sub(repl, current_line)
        lines[idx] = current_line

    if modified:
        new_content = "\n".join(lines)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)


def fix_imports(target_directory, root_path):
    print(f"Scanning directory for coupling violations: {target_directory}")
    for root, dirs, files in os.walk(target_directory):
        for file in files:
            if file.endswith((".ts", ".tsx")):
                file_path = os.path.join(root, file)
                process_file(file_path, root_path)


if __name__ == "__main__":
    root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    for target in TARGET_DIRS:
        fix_imports(os.path.join(root_path, target), root_path)

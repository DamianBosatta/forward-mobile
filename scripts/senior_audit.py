import os
import subprocess
import json
import sys

def run_command(command, cwd):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=cwd)
        return result.stdout, result.stderr, result.returncode
    except Exception as e:
        return "", str(e), 1

def audit_mobile():
    print("Starting Senior Audit for Forward Mobile...")
    cwd = r"d:\OneDrive\Documentos\Projects\Forward\forward-mobile"
    
    # 1. TypeScript Check
    print("Checking TypeScript types...")
    stdout, stderr, code = run_command("npx tsc --noEmit", cwd)
    if code != 0:
        print("TypeScript Check Failed:")
        print(stdout or stderr)
        return False
    print("TypeScript Check Passed.")

    # 2. Lint Check
    print("Checking ESLint rules...")
    stdout, stderr, code = run_command("npx eslint . --max-warnings 0", cwd)
    if code != 0:
        print("ESLint Check Failed:")
        print(stdout or stderr)
        return False
    print("ESLint Check Passed.")

    # 3. Senior Standards Check (Heuristics)
    print("Checking Senior standards (Heuristics)...")
    # Check for usage of 'any'
    stdout, stderr, code = run_command('git grep -l "any" -- "*.ts" "*.tsx" | grep -v "node_modules"', cwd)
    if stdout:
        print("Warning: 'any' found in files. Please use proper types.")
        # We don't fail for now, just warn.
    
    # Check for FlashList in screens with lists
    stdout, stderr, code = run_command('git grep -L "FlashList" -- "app/(tabs)/**/*.tsx"', cwd)
    if stdout:
        print("Warning: Screens without FlashList detected. Verify performance.")

    print("Audit completed successfully.")
    return True

if __name__ == "__main__":
    success = audit_mobile()
    if not success:
        sys.exit(1)
    sys.exit(0)

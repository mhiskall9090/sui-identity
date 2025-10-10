GEMINI CLI setup and indexing
=================================

This project includes two helper scripts to automate checking for the Gemini CLI, collecting API keys, and indexing repository content.

Files
-----
- `scripts/setup_gemini.ps1` — interactive PowerShell script that:
  - checks whether `gemini` is on PATH
  - offers to install via `winget` if available
  - prompts for `GEMINI_API_KEY` and `CURSOR_API_KEY`, writes them to a `.env` in the repo root
  - optionally persists them into your Windows user environment via `setx`
  - optionally runs the indexing script after setup

- `scripts/index_gemini.ps1` — simple indexing script that:
  - loads `.env` values into the environment
  - prepares a `gemini index` command and asks for confirmation before running
  - runs the indexing command and reports the exit code

Important notes
---------------
- These scripts are conservative and prompt before performing actions that change your system.
- The `.env` file stores keys in plaintext. Do NOT commit `.env` to version control. Add `.env` to your .gitignore if you keep it.
- The exact Gemini CLI command syntax may differ by version. `scripts/index_gemini.ps1` uses a placeholder:

  gemini index --source "<path>" --api-key "<key>"

  If your Gemini CLI uses different flags, edit `scripts/index_gemini.ps1` and update the `$cmdTemplate` variable.

How to run
----------
Open PowerShell in the repository root and run:

```powershell
.
\scripts\setup_gemini.ps1
```

or to skip the interactive setup and only index (assumes environment variables are set):

```powershell
.
\scripts\index_gemini.ps1 -RepoRoot (Get-Location).Path -IndexDir src
```

If you used `setx` to persist keys, restart your terminal to pick up the changed environment variables.

Customizing for Cursor / Gemini
-------------------------------
If you are integrating with Cursor, make sure `CURSOR_API_KEY` is set and consult Cursor docs for the index/upload API. The scripts intentionally leave the command-template in `index_gemini.ps1` easy to change.

Security
--------
- Treat API keys like secrets. Prefer storing them in a secure store (Windows Credential Manager, Azure Key Vault, etc.) instead of the `.env` file.

Troubleshooting
---------------
- If `gemini` isn't found, install it manually and ensure it's on PATH.
- If `winget` doesn't have a package, you'll need to follow the official installation instructions from the Gemini provider.

Contact / Next steps
--------------------
If you'd like, I can:
- update `index_gemini.ps1` to walk the repo file tree and index files individually (helpful for partial re-indexing)
- add an automated `.gitignore` entry for `.env`
- integrate the indexing into the project's npm/pnpm scripts so frontend developers can run `pnpm run index`.

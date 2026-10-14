# Repository Guidelines

## Project Structure & Module Organization

ClassPulse is a static, Thai-language student follow-up dashboard. All project files live at the repository root:

- `index.html`: page structure, dashboard sections, and task dialog.
- `styles.css`: colors, typography, components, and responsive layouts; fonts load from Google Fonts.
- `app.js`: data loading, rendering, search, filtering, task updates, persistence, and JSON export.
- `data.json`: fictional student and task seed data.
- `README.md`: local setup and hosting instructions.

There are no separate source, asset, or test directories and no package dependencies.

## Build, Test, and Development Commands

- `python -m http.server 8000`: serve the project root; open `http://localhost:8000` to use the app. VS Code Live Server is an alternative.
- `python -m json.tool data.json`: validate seed JSON syntax and print formatted data.

No build step, test runner, or lint command is configured. Serve the files over HTTP because opening `index.html` through `file://` can block the seed-data fetch. Static hosting uses the four application files directly.

## Coding Style & Naming Conventions

Follow the existing two-space indentation in HTML, JavaScript, and JSON. JavaScript uses `const`/`let`, semicolons, double-quoted strings, and camelCase names such as `renderTasks` and `studentId`. Keep CSS classes in kebab-case and reuse the custom properties in `:root`; existing CSS is compact. No formatter or linter is configured.

Preserve Thai interface text and keep DOM IDs consistent with their JavaScript references. Escape user-controlled values with `escapeHtml` when inserting HTML. Maintain task status values `pending`, `in_progress`, and `done`, and priorities `high`, `medium`, and `low`.

## Testing Guidelines

Manually verify initial loading, search, status filters, task creation, status transitions, dashboard counts, JSON export, and reset. Reload after edits to confirm persistence. Check desktop and narrow-screen layouts and the browser console. No automated test naming convention or coverage threshold exists.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout. Use concise, imperative commit subjects such as `Fix task status counts`. Keep changes focused. Pull requests should explain the behavior changed, link relevant issues, list manual checks, and include screenshots for visual changes.

## Data & Security

Use fictional student data only. Changes persist under `classpulse-demo-v1` in browser `localStorage`, rather than updating `data.json`. Reset restores seed data. This prototype has no authentication, authorization, or server backups; never commit real student records or secrets.

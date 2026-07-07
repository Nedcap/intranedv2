# Copilot instructions for intranet-webv2

## Project overview
- This repository is a Next.js 16 application using the App Router and TypeScript.
- The main application code lives in app/, components/, actions/, lib/, and public/.
- Dashboard pages and related routes are organized under app/dashboard/.
- API handlers are implemented as route files in app/api/*/route.ts.

## Working conventions
- Prefer the existing architecture over introducing new abstractions.
- Use server components by default; only add client components when browser APIs, hooks, or interactivity are required.
- Keep changes localized to the relevant feature area and follow the current folder structure.
- Reuse helpers from lib/ and action-oriented modules from actions/ when they already cover the functionality.
- Preserve naming patterns already used in the project, especially Portuguese-oriented route and component names.
- Respect environment-based integrations for Supabase, Google, OpenAI, S3, and related services; do not hard-code secrets.
- Avoid editing generated artifacts such as .next/ or lockfiles unless the change explicitly requires it.

## Implementation guidance
- For UI work, prefer existing component patterns and Tailwind-based styling already used in the app.
- For API work, keep handlers focused and return clear errors for invalid input or upstream failures.
- For data access, prefer the existing service/helper layer rather than creating new ad-hoc fetch logic.
- When touching routes or navigation, preserve the current dashboard structure and existing links.

## Validation
- Run npm run lint after meaningful changes.
- Use npm run build for broader changes that may affect routing, server components, or API behavior.

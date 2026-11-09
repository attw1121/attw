# Repository Guidelines

## Project Structure

This workspace contains `報修需求筆記.txt`, the requirements for a small repair request tracker. Read it before changing the demo scope, data fields, or access rules. The notes outline a web submission form and request list, a Supabase table and access policies, and supporting Excel, PowerPoint, and Word deliverables. There are currently no application source files, tests, or asset directories.

## Build and Development

There are no build, lint, test, or local run commands yet. When adding the web app, document its prerequisites, setup and run commands, and required configuration. Keep the database schema and access policy definitions with the implementation so contributors can reproduce the demo setup.

## Data and Access Rules

- Preserve the fields in the requirements, including category, urgency, status, and a system-generated registration timestamp. Keep example names and locations fictional.
- Keep the demo focused on submitting requests and viewing the list. Login, status updates, and notifications are outside the current demo scope.
- Enable row-level security (RLS) on the Supabase table. Public clients may insert and read records. Public updates and deletes must be denied. Use the public key in the browser and keep privileged credentials out of client code.

## Verification

When the app is available, submit a fictional request and confirm that it appears in the list with a system-generated timestamp. With the same public client credentials, verify that the database denies updates and deletes. Run those checks against the database as well as exercising the form and list in the browser.

## Change Reviews

This workspace has no Git history to establish a commit convention. If Git is introduced, use short, descriptive commit subjects. In pull requests, summarize the change and how it was verified. Link the relevant issue when available and include screenshots for visible form or list changes.

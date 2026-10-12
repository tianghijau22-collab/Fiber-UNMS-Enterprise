# API authentication and sessions

The API uses Laravel Sanctum. Private routes require an authenticated, active user and an explicit server-side access rule. Module permissions are checked separately from administrator-only capabilities and permission to change master records. Shared reference reads remain available to the modules that need them.

Browser clients use same-origin cookie sessions. Obtain the CSRF cookie from `/sanctum/csrf-cookie` before login or an authenticated write. Mobile clients use the bearer token returned by login; tokens expire after seven days and are revoked on logout. Password changes revoke the user's tokens and database sessions. The server derives the acting identity from authentication rather than client-supplied identity headers or request IDs.

The mobile source verifies its stored token against the server on startup, handles expired or inactive sessions, requires HTTPS on the configured API origin, verifies certificates, and disables automatic redirects. Existing installed clients require an updated APK to use these client-side changes.

Deployment requires installing dependencies from `composer.lock` and applying `2026_10_12_000001_create_personal_access_tokens_table.php`. Existing clients need to sign in again. Deploy the browser assets together with the backend change. Back up the database and application files first, and verify authentication, permissions, shared reads, and logout before completing rollout.

Verification for this change:

- Backend: 14 tests, 953 assertions; includes all 208 private API routes, identity forgery, role checks, token revocation, password changes, cookie flags, CSRF, and call ownership.
- Browser API client: five tests covering request headers, CSRF cookies, origin isolation, session expiry, and mutation notifications.
- Mobile session client: seven tests covering startup verification, expired sessions, network failures, server URL migration, and rejection of insecure requests.
- Production browser build and targeted mobile static analysis passed. APK distribution and physical-device verification are separate release steps.

New private routes must remain inside the authenticated route group and have an access rule. The route coverage test fails when either requirement is missing. This change does not alter optical telemetry collection, ONU mapping, or polling intervals.

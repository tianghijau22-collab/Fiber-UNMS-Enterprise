# OLT registered customer classification — Stage 1E C

A customer service already registered in FONA could appear as a new physical ONU when it had no ODP/OLT topology assignment. Customers resolved the same serial from hardware, while OLT Management restricted registration lookup to topology-owned records. Per-port responses also returned raw discovery rows after classification.

Registration presence now uses the global active customer registry. A registration without an explicit topology owner appears under the uniquely identified OLT when recent serial-table evidence confirms that owner. Membership does not depend on Rx availability. Existing explicit ownership is preserved; conflicting, ambiguous, stale, or incomplete registrations are offered for review, never new customer registration or automatic deletion. No ODP, service, or administrative binding is created or moved by a telemetry read.

Full inventory and stored/live per-port responses use the same partition. Physical evidence needed for review survives snapshot round-trips. Registered rows explain serial-based ownership, use registration IDs for row keys, and distinguish empty search results from an empty customer registry.

Validation includes isolated SQLite regression tests for unbound registrations, N/A, conflicting owners, cross-OLT ambiguity, stale identity, duplicate customer serials, incomplete ONT registration, read-only stored port reads, and evidence retention. Existing telemetry, authentication, customer intake, and sidebar tests are retained. Production verification uses read-only transactions; no customer registrations are created for testing.

Release procedure: publish selected files to GitHub, verify fresh database/application/configuration backups, deploy only declared files and built assets, reload PHP-FPM, verify API classification and administrative data integrity. No migrations or worker restarts are required.

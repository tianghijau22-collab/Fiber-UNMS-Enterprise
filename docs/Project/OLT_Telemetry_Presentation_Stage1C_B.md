# ONU telemetry presentation — stage 1C-B

Status: tested local candidate; not deployed.

The customer list, ODP port detail, GIS summary, infrastructure resource and diagnostics use one ownership-scoped read model. An ONU hardware interface is separate from the ODP topology uplink. A serial on a different OLT cannot replace the selected OLT's row, and a missing owner never falls back to the first device.

The response exposes `telemetry_contract=1`, `identity_status`, `gpon_interface`, `onu_id`, nullable `is_online`, nullable `rx_power`, `rx_available`, `telemetry_source`, `sampled_at`, `sample_age_seconds`, `telemetry_freshness`, and `telemetry_reason`. Online/Offline classification follows the selected producer status; missing power does not establish Offline, and numeric power does not override Offline. Offline sentinel values are not displayed as optical measurements. Legacy zero placeholders without an explicit validity flag are unavailable.

Samples older than 180 seconds, with missing timestamps or future timestamps are not current status. ZTE identities require validated serial-table provenance and an observation within 600 seconds. These are conservative presentation limits, not guarantees about per-ONU measurement age. Snapshot timestamps describe snapshot completion; bulk producer preservation and snapshot writer races remain separate work.

ODP point readings must confirm the same PON/ONU and registration selected for the response. Partial point reads may coexist with explicitly labelled stored samples. Aggregate summaries distinguish Online, Offline and unknown clients. Unknown clients do not establish total loss or good signal. Occupied physical ports are counted independently of stale stored used-port counters.

Customer response caching is reduced to 15 seconds, matching the GIS payload window. This limits additional presentation delay; it does not shorten hardware polling. Cache refresh and long-open browser sessions still require operational validation.

Diagnostics no longer synthesize optical histories, target IPs, Tx, distance, attenuation loss, or customer ICMP statistics. Missing measurements remain null/empty. Optical quality thresholds match the customer/ODP presentation. The read-only ODP detail path no longer creates ports or updates counters; port synchronization remains on editing/provisioning paths.

Deployment includes PHP sources and newly built web assets, with targeted customer/GIS cache invalidation. Preserve previous hashed assets during the manifest switch and preserve sessions. Existing browser tabs should reload to acquire the new presentation code. No database migration or OLT configuration change is required. Mobile parsing accepts nullable fields, but the installed application still needs a separate release to present unknown status correctly. Other bulk/status writers and interface probing are not repaired by this stage.

Validation covers cross-OLT identity reuse, mixed PONs, stale/missing/ambiguous data, working without Rx, immutable read-only detail responses, deleted customers, stale port counters, honest diagnostics, and snapshot decode cost. Live candidate inspection must use read-only database transactions and an in-memory cache; never run the writing optical probe to inspect an undeployed candidate.

# Large OLT state discovery — stage 1D-H

Normal polling on 16 October 2026 still showed root state walks stopping at their 35-second deadline. Eight observed cycle durations ranged from 38.39 to 75.14 seconds. A later attempt obtained 1042 root state rows before the deadline and 1073 Online state rows after bounded recovery; missing observations remained unknown. Reading OLTs sequentially means this cost also delays the next OLT. A three-second loop delay is not a three-second data refresh guarantee.

A 90-second passive capture of existing traffic observed OLT 1 state response median 44.51 ms, p95 2203.69 ms, maximum 5173.08 ms, and 19 repeated SNMP requests across its traffic. Five requests older than six seconds had no matched response during the capture. Those are capture-window observations, not a measured end-to-end packet-loss rate. VPS UDP receive-buffer/errors and IP reassembly-failure counters did not increase during that window. Fragmented packets were observed and reassembled; this does not establish fragmentation or VPN as the root cause. No credentials, serial values or packet payloads were persisted.

## Change

When the previous inventory exceeds 256 entries, discover PON names from a new complete hardware ifName walk, bounded by four seconds. Derive the vendor ONU-table index from each accepted GPON name. The standard ifName row index is deliberately not reused as the vendor ONU-table index: these differ on the deployed hardware.

Every freshly discovered PON receives a state-subtree walk, including empty ports and ports absent from the previous ONU inventory. Queue concurrency remains four; each job keeps its six-second limit, two-second request timeout and one transport retry. Failed PONs may be retried once within the same remaining deadline. Port discovery and state reads share the existing 35-second state budget; the later state-recovery/Rx stage retains its shared 20-second budget.

Incomplete ifName discovery, unknown GPON naming, duplicate normalized names, an empty/oversized scope, or exclusion of a previously observed valid PON cause a bounded whole-root fallback. A partial PON read remains partial even when previous snapshot tuples can supply request targets. Old states/Rx are never copied into new observations and a partial discovery cannot authorize a complete identity scope.

Small inventories and the first run keep the original root discovery. Hardware identities, ownership checks, observation timestamps, raw Online/Offline interpretation, alarms, web N/A display policy, freshness limits, VPN settings and firewall rules remain unchanged. This phase does not introduce parallel polling across different OLTs or a global acquisition lock. Any remaining large delay, overlapping reads or transport issue needs separate evidence before changing those mechanisms.

## Validation and limitations

Regression coverage checks new/empty PON discovery, the differing interface-index formats, complete-scope requirements, safe root fallback, bounded queued retries and refusal to fabricate prior snapshot values. The candidate is tested against hardware in memory using a database READ ONLY transaction and an isolated cache before deployment. Normal polling must be observed again after deployment; a single successful candidate read is not a sustained latency or availability guarantee.

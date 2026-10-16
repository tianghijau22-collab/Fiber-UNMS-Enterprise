# Bounded PON scheduling and exact Rx reads — stage 1D-D

The production ZTE v2c path reads the current working-state table first. Rx is then requested only for current Online tuples, using exact SNMP GET batches of at most 24 OIDs. Requests are grouped by PON and interleaved, with the first PON rotated across cycles. A rolling queue starts the next job when any of four workers finishes; a slow job does not hold a whole batch.

The initial state walk retains its 35-second group deadline. Point acquisition shares a 20-second window. When the state walk is partial, at most five seconds of that window can query missing state tuples selected from the previous inventory. Those old tuples select requests only: old state/Rx values are never copied into a new observation. A partial discovery remains partial even if known tuples are recovered.

For identity refresh, a complete current state walk scopes serial-table walks to the PONs actually observed by hardware. Both primary and secondary serial subtrees are queried for every PON. Their rows still pass the existing contradictory-value/duplicate-location checks. Incomplete state discovery uses the previous bounded whole-table identity reader; it cannot establish complete point scope. No interface name, topology record or old snapshot establishes a serial identity.

Queued jobs have two-second requests, one SNMP retry and a six-second job deadline. The whole queue has its original deadline (20 seconds for point work, 35 for identity). One further attempt may query only failed chunks within the remaining original budget. Initial and retry reports are retained. A global deadline reports unstarted requests explicitly. Queue output is limited to 64 KiB per job and 8 MiB per group; diagnostics exclude credentials, command arguments and raw stderr.

Exact GET parsing accepts only requested OIDs and requires an explicit response for every OID. No Such responses prove unavailability, not an optical value. Missing responses, nonzero exits, conflicting values, timeouts and output limits cannot become complete acquisition. Sensor sentinels remain unavailable and do not automatically make an Online ONU Offline.

Identity refresh starts at 300 seconds and expires at 600 seconds as before. Failed reads do not extend observation time. Sample validity, ownership/order guards, topology bindings, authentication, VPN monitoring, OLT configuration and browser assets are unchanged. The limits apply to these CLI operations, not the entire polling cycle or every concurrent application operation.

Validation covers exact response completeness, conflicts, output caps, rolling scheduling, deadlines/unstarted jobs, PON interleaving/rotation, both serial subtrees, selective retry, partial-state recovery without snapshot value reuse and Online without Rx. Read-only candidate trials and normal deployed cycles must be assessed separately; low duration or fewer missing rows is not an improvement if state coverage has shrunk.

This is specific to the deployed Linux ZTE SNMP v2c setup. It does not prove the cause of UDP timeouts, MTU behavior or agent load, and does not repair the separate optical diagnostic modal, ambiguous registrations or alarm ordering.

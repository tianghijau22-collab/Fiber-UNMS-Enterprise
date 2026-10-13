# Stage 1C-A: ZTE GPON hardware identity and ODP optical reads

Status: tested candidate, not deployed.

## Problem and resulting behavior

A customer registration ID could become `onu_id` when hardware discovery missed a serial. Bulk polling then seeded its serial cache from that snapshot, repeatedly querying a database identifier as if it were an ONU number. The ODP optical reader separately combined every customer's ONU number with one shared ODP PON. These paths could read a different ONU, miss an online ONU, or carry one customer's Rx value into another result.

The candidate separates customer topology from hardware identity. ZTE serial-table OIDs establish the PON/ONU tuple; database registration IDs remain `ont_id`. Missing or ambiguous hardware identities have null `onu_id` and null physical `port`, with `identity_status=unresolved`. The topology uplink remains available separately as `topology_port`.

## Identity cache and discovery

- A new, per-OLT `olt_bulk_sn_map_v2_<id>` scalar cache contains schema, observation time and entries. Old cache keys are not read, deleted, or flushed.
- Only the deployed ZTE GPON serial subtrees ending in `.3.50.11.2.1.3` and `.3.28.1.1.5` populate the map. Previous snapshots never seed it.
- Invalid OID suffixes and invalid port names cannot create a default location.
- Contradictory serial tables, a serial at multiple hardware locations, or multiple serials at one location do not use first/last wins.
- Provenance and observation time accompany hardware identities from bulk and driver reads. Valid PON `1/1/1` is retained.
- The existing 600-second identity cache remains; this change does not guarantee immediate detection of re-provisioned ONUs by bulk polling.

## ODP optical reads

Each ONU request uses its own PON and ONU ID. It reads both serial fields, phase state, and ONU Rx together, in groups of up to three ONUs. A result is accepted only when a serial confirms the expected identity and no valid serial field contradicts it. No ODP uplink or first-active-OLT fallback establishes a hardware identity.

The phase-state mapping is grounded in ZTE's `zxGponOntPhaseState`: working is 3; LOS, dying gasp, authentication failure and offline are 1, 4, 5 and 6. Logging and MIB synchronization are transient. See the manufacturer-authored [PON OLT Equipment MIB Specifications, section 8.2](https://www.scribd.com/document/486022802/ZXA10-C3xx-MIB-Specifications), hosted by a third party.

Missing, invalid or timed-out state reads remain unknown. A verified working ONU with unavailable Rx returns `rx_power=null`, not 0 or an inferred LOS. The existing -40 offline sentinel is retained only for an explicitly confirmed non-working state; it is not a measured optical value. Each ONU's Rx starts independently.

Only verified results update that ODP's selected registration IDs. Wrong OLT ownership is rejected. Soft-deleted registrations and customers are excluded. `success` and `complete` indicate complete status verification; optical availability is reported independently as `rx_available`. Incomplete verification cannot raise or clear an ODP mass alarm using stale database fallback counts. Successful live optical writes invalidate the actual GIS v2 and customer v5 payload keys.

## Validation

The candidate passes 51 tests with 1,253 assertions. Coverage includes mixed PONs with the same ONU number, contaminated legacy cache isolation, missing identities, conflicting serials, malformed ports, partial reads, serial reuse, unavailable Rx, preserved database rows and alarm state, wrong OLT ownership, and prior authentication/listener/source-guard behavior.

Read-only comparison against live serial tables and a read-only optical batch confirmed the expected PON/ONU tuples and readings for the reference case. No production customer, cache, service, notification, or OLT configuration was modified during that comparison.

## Boundaries

This is the backend identity and ODP reader stage. It does not yet unify every screen's interface/Rx display or all bulk/alarm writers. Existing snapshot races, bulk registration queries and global port updates, decoder heuristics, polling scheduling and frontend freshness remain separately tracked. Cross-OLT duplicate serials remain subject to the strict alarm-source guard; they are not automatically deleted or reassigned. Unknown identities do not prove that a customer has disconnected or cancelled service.

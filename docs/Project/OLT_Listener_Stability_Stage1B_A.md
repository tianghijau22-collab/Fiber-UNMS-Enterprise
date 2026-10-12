# OLT listener stability

The ODP correlation cache stores scalar arrays under a new versioned key with a 30-second TTL. It works when cache class deserialization is disabled. Legacy object payloads remain outside the new namespace; malformed or mismatched new payloads are rebuilt from the database. The correlation code reads arrays on both loss and recovery paths.

Packet processing uses an error boundary with the correct logger facade. Failures in packet processing, console output, or application logging do not escape that boundary and prevent the next packet from being handled. This does not guarantee delivery of UDP packets, protect every operation in the receiver loop, or retry events that failed partway through processing.

Seven isolated stability tests cover legacy incomplete objects, cold and warm serialized cache, nullable fields, invalid payloads, expiry, empty results, packet and diagnostic failures, and the loss/recovery consumers. SNMP probing and notifications are mocked. The backend suite has 21 tests and 1,012 assertions. API route coverage distinguishes public routes by both HTTP method and URI.

Deployment needs the listener and the new `OdpTopologyCache` service, followed by a controlled restart of the event listener. No schema migration, package update, browser build, or polling daemon restart is needed. Preserve disabled cache class deserialization and do not flush the telemetry cache.

This change does not alter alarm source selection, decoder rules, bulk update scope, optical measurements, ONU identities, or polling intervals. Source validation is a separate change requiring verified routing information, particularly for networks where several OLTs share a relay or NAT source.

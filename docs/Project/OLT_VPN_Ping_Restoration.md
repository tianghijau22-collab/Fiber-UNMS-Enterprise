# Restoring measured VPN peer ping

The monitoring health split removed the previous VPN peer ping measurement. The interface and route indicators remained available, but the latency cards and graph had no measured RTT to display.

This correction restores ICMP measurements to the peer discovered on the configured VPN interface. Each sample sends two packets through that interface, with a two-second command deadline and a three-second process timeout. Requests share the sample for up to 12 seconds; a non-blocking cache lock limits simultaneous probes. Measurements are made when monitoring is requested, not by a new background daemon.

The response includes mean RTT, RTT variation (Linux mdev), packet counts, loss percentage, and the original measurement time. Packet loss describes only this two-packet sample. ICMP failure does not by itself establish that the VPN interface or an OLT is down. Unavailable measurements remain null rather than synthetic zero values. A missing interface, invalid peer or missing peer route suppresses prior cached ping results. Recreated interfaces and changed peers receive separate cache keys.

The graph uses actual observation timestamps, deduplicates cached samples and leaves failed measurements as gaps. Existing process, VPN route, OLT response, polling outcome and ONU data freshness indicators remain separate. This does not change customer identities, Rx acquisition, OLT polling commands, alarm ingress, authentication or database structure.

Validation covers RTT extraction, true zero values, loss from packet counts, malformed output, no response, cache reuse/expiry, VPN disconnect, changed interfaces/peers, and missing routes. Frontend coverage checks graph deduplication, unknown historical values and failure gaps. Production rollout requires GitHub publication, a verified fresh backup, scoped source/assets, and verification of measured output and preserved configuration.

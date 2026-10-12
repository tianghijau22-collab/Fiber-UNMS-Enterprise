# OLT alarm source guard — stage 1B-B candidate

Status: prepared and tested; production activation requires an explicit deployment profile and review of ambiguous inventory identities.

The listener previously selected an OLT from customer topology, a matching port on any device, or the first active device. Shared sender addresses and reused port numbers can therefore associate an alarm with the wrong device.

This candidate resolves an active source before event classification and customer processing. Direct source addresses must identify one active OLT. Relayed SNMP traps require an explicit relay-to-device allowlist plus an original agent address or a serial found on exactly one active OLT. Community, original agent and serial identities must agree. Unknown, conflicting, malformed and unsupported inputs return before customer processing. Relayed syslog without verified device identity is rejected.

A bounded BER reader extracts identity from SNMPv1 and SNMPv2c typed fields. Header/community text cannot supply a customer serial. The existing vendor event classifier is unchanged. Accepted events use the selected device inventory; global port guesses and first-device fallback are removed. Source decision counters and last-decision metadata exclude payloads, communities and customer serials.

The listener binds an explicit IPv4 address; the default is loopback and a wildcard is rejected. Deployment must set `OLT_ALARM_BIND_ADDRESS` and a JSON `OLT_ALARM_TRUSTED_RELAYS` object whose keys are relay addresses and values are arrays of positive integer device IDs. Network ingress restrictions must accompany relay enrollment. A source IP and shared SNMPv2c community are not cryptographic device authentication.

## Validation

The complete isolated backend suite passes: **31 tests, 1,091 assertions**. Ten source-identity tests cover BER parsing/truncation, header spoofing, direct/shared sources, community and agent conflicts, missing/ambiguous/inactive inventory, safe decision metadata, rejected input before customer queries, and invalid listener binds. Network notifications are faked; no live OLT probing is used in tests.

## Deployment limits

- Prepare and verify database/application backups, current runtime hashes, private environment values and current firewall/service configuration before activation.
- Restrict only the alarm UDP ports through the verified network path. Do not replace or flush the existing firewall ruleset.
- Install the private ingress service and listener dependency, configure the listener address/relay allowlist, then restart only the listener. Verify both sockets, heartbeat, source decisions, natural traffic and application health; retain a rollback for the four runtime files, the two environment settings and the dedicated ingress configuration.
- Serial identities duplicated across active devices, serials absent from inventory, and relayed events without identity are deliberately withheld. Periodic telemetry remains active. Measure this impact and resolve inventory conflicts rather than selecting the first match.
- Registration duplicates, individual/bulk write scoping, hardware ONU IDs, customer PON selection, null/Rx handling, vendor event semantics, snapshot races and polling freshness remain separate open findings. This source guard does not establish end-to-end data correctness.

Protocol references: [SNMPv1 Trap-PDU](https://www.rfc-editor.org/rfc/rfc1157.html), [SNMPv2 Trap-PDU](https://www.rfc-editor.org/rfc/rfc3416.html), and [original-agent address in notification forwarding](https://www.rfc-editor.org/rfc/rfc3584.html).

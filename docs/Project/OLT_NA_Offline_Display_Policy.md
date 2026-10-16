# N/A optical display policy

At the user's explicit request, web ONU/customer rows whose optical reading displays N/A now display Offline. This is a presentation policy, not a new hardware observation. The shared presenter returns the original projected hardware status separately as hardwareOnline; it never replaces the input is_online, Rx, identity or timestamps.

The same presenter drives customer/ODP/inventory rows, filtering, exports and optical diagnostics. Inventory optical statistics and interface-probe totals follow the displayed row status. Weak but measured optical power remains Online. The diagnostic text distinguishes hardware-confirmed Offline from Offline displayed because Rx is N/A; it does not claim a cable break or Dying Gasp from missing data.

Backend status, SNMP polling, alarm generation, topology, billing/service status and OLT/VPN health remain unchanged. Unreturned rows in a partial interface probe remain unread; no observation is fabricated for them. Legacy data lacking the telemetry contract and the initial/loading state are not treated as a confirmed observation.

N/A may result from an unavailable sensor, incomplete reading, expired data or unresolved identity. Under this chosen policy such displayed rows can be Offline while the original OLT state is Online or unknown. Source timestamps and health diagnostics remain available for investigating this distinction. This release does not rebuild the APK.

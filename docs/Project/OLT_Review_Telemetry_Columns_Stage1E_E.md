# OLT review telemetry columns — Stage 1E E

The customer/ONU reconciliation table and mobile cards now show Port Interface and Redaman Rx Power. Interface includes the actual hardware PON and ONU ID; power uses the same validity, freshness, formatting and original sample timestamp as registered ONU inventory. An ODP uplink is not substituted for physical ONU identity. Unknown identity displays Belum terverifikasi; unavailable, ambiguous or stale Rx displays N/A.

The partitioner adds a bounded review_telemetry payload using the already selected registered inventory row or the same uniquely resolved hardware identity on the selected OLT. It preserves review classifications and cleanup permissions. Duplicate customer records display the observation associated with the serial and explain that it is the physical SN location. Foreign/uncertain customer ownership explicitly labels an observation as detected on the selected OLT; it does not move the customer or resolve ownership automatically.

Stored refresh and manual refresh use the existing reader paths. Rendering these columns does not initiate a new OLT query. Interface search/filter includes the detected physical interface while retaining existing topology search. Customer delete actions and confirmation remain available under their existing rules.

Regression coverage checks actual PON/ONU identity distinct from ODP uplink, shared sample metadata for duplicate customers, missing/ambiguous identity without legacy Rx fallback, and selected-OLT observations for foreign ownership. Browser fixtures cover desktop/mobile columns and N/A rendering without modifying production customers.

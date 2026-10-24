# OLT duplicate customer deletion — Stage 1E D

The reconciliation table now places Hapus Pelanggan beside Pelanggan for duplicate_customer_serial rows with a valid customer ID. The action is available to Super Administrators on both desktop and mobile. Other review types retain their existing cleanup rules; an Rx N/A value does not enable this action.

The confirmation identifies the selected customer, customer number and serial, and explicitly explains permanent deletion of all services and related customer data, release of assigned ODP ports, preservation of the other customer using the serial, and preservation of the physical OLT configuration. The request uses the existing authenticated DELETE /api/customers/{customer_id} endpoint, never the ONU registration ID or serial as a deletion key. Existing API permissions remain unchanged.

The customer delete operation is transactional. It includes soft-deleted services when releasing assigned ports, clears their customer labels, recalculates occupancy, records the audit event and invalidates relevant customer/ODP caches. Failure rolls the operation back. Other customers, including those using the same serial, are not selected for deletion.

The UI prevents duplicate submission, retains rows on rejection, removes only the deleted customer's rows after success and reloads stored OLT inventory/topology to recompute duplicate classifications. It never requests a live OLT read for that refresh. Pagination is clamped after rows disappear.

Validation uses temporary SQLite fixtures for exact-target deletion, duplicate serial preservation, soft-deleted service cleanup, transaction rollback and access denial. Browser fixtures exercise confirmation, cancellation, rejection, success and desktop/mobile layouts without touching production customers. Release validation includes a fresh database/application/configuration backup and read-only production integrity checks. Previously deployed AI formatting changes are retained unchanged in the reproducible frontend build.

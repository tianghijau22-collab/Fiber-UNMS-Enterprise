import {onuPresentation} from './onuTelemetry.js';

export function customerSerialKey(customer = {}) {
  const key = String(customer.onu_serial || customer.serial_number || '').trim().toUpperCase();
  return !key || /^(?:N\/A|NA|UNKNOWN|NULL|NONE|[-—]+|0+)$/.test(key) ? '' : key;
}

// Build from the complete customer list so search, OLT filters and pagination cannot hide a duplicate.
export function duplicateCustomerSerials(customers = []) {
  const owners = new Map();
  for (const [index, customer] of customers.entries()) {
    const key = customerSerialKey(customer);
    if (!key) continue;
    if (!owners.has(key)) owners.set(key, new Set());
    owners.get(key).add(String(customer.id ?? customer.customer_id ?? `row:${index}`));
  }
  return new Set([...owners].filter(([, customers]) => customers.size > 1).map(([serial]) => serial));
}

export function customerMatchesTelemetryFilters(customer, {duplicateSn = false, onlineNoRx = false} = {}, duplicates = new Set()) {
  const duplicate = customer.serial_duplicate === true || duplicates.has(customerSerialKey(customer));
  if (duplicateSn && !duplicate) return false;
  if (onlineNoRx) {
    const display = onuPresentation(customer);
    if (customer.identity_status !== 'resolved' || customer.telemetry_freshness !== 'fresh'
      || display.hardwareOnline !== true || display.rx !== null) return false;
  }
  return true;
}

export function customerPages(customers, pageSize = 8, groupSerials = false) {
  const size = Math.max(1, Math.floor(pageSize) || 8);
  if (!groupSerials) {
    const pages = [];
    for (let start = 0; start < customers.length; start += size) pages.push(customers.slice(start, start + size));
    return pages.length ? pages : [[]];
  }
  const groups = new Map();
  for (const [index, customer] of customers.entries()) {
    const key = customerSerialKey(customer) || `\uffff:${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(customer);
  }
  const pages = [];
  let page = [];
  for (const [, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (page.length && page.length + group.length > size) { pages.push(page); page = []; }
    page.push(...group);
    // A large group stays on one page rather than separating customers with the same serial.
    if (page.length >= size) { pages.push(page); page = []; }
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

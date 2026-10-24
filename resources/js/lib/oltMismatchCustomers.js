export function duplicateCustomerTarget(row) {
  const id = Number(row?.customer_id);
  if (row?.issue_code !== 'duplicate_customer_serial' || !Number.isSafeInteger(id) || id <= 0) return null;
  return { id, name: row.customer_name || 'Pelanggan', number: row.customer_number || `ID ${id}`, serial: row.onu_serial || row.onu_mac || '—' };
}

export async function deleteDuplicateCustomer(row, csrfToken = '', request = fetch) {
  const target = duplicateCustomerTarget(row);
  if (!target) throw new Error('Data pelanggan SN ganda tidak valid. Muat ulang daftar terlebih dahulu.');
  const response = await request(`/api/customers/${target.id}`, {
    method: 'DELETE', credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || 'Pelanggan belum berhasil dihapus. Muat ulang daftar sebelum mencoba kembali.');
  }
  return target;
}

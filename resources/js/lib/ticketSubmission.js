export function ticketSubmissionAttempt(previous, body, makeKey = () => globalThis.crypto.randomUUID()) {
  if (previous) {
    if (previous.body !== body) throw new Error('Hasil percobaan sebelumnya belum pasti. Periksa daftar tiket sebelum membuat tiket dengan isi yang berbeda.');
    return previous;
  }
  return { key: makeKey(), body };
}

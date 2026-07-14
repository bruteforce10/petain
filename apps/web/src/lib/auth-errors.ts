/** Terjemahkan pesan error Supabase Auth ke bahasa yang dipahami pengguna. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email atau password salah. Periksa lagi, lalu coba ulang.";
  }
  if (m.includes("email not confirmed")) {
    return "Email kamu belum dikonfirmasi. Cek inbox untuk link konfirmasinya.";
  }
  if (m.includes("user already registered")) {
    return "Email ini sudah terdaftar. Silakan log in.";
  }
  if (m.includes("rate limit")) {
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Tidak bisa terhubung ke server. Periksa koneksi internetmu.";
  }
  return message;
}

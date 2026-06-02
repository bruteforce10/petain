import { createPetainClient } from '@petain/supabase';

// Vite exposes VITE_* env vars to the browser. Default localStorage auth.
export const supabase = createPetainClient({
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  detectSessionInUrl: false,
});

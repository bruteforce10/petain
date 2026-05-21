import { createTerramapClient } from '@terramap/supabase';

// Next.js exposes NEXT_PUBLIC_* to the browser. Default localStorage auth.
export const supabase = createTerramapClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  detectSessionInUrl: true,
});

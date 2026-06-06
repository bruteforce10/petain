import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (cookie-backed via @supabase/ssr).
 *
 * Sessions live in cookies — readable by middleware and server components —
 * not localStorage. Used by all client components (signIn/signUp/signOut and
 * the fetch* helpers from @terramap/supabase, which take a client argument).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Shared singleton for components that just need one instance. */
export const supabase = createClient();

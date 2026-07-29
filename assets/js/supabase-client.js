(() => {
  "use strict";

  const config = window.BARFORD_2027_CONFIG;
  if (!config || !window.supabase?.createClient) {
    console.error("The 2027 Supabase connection could not be loaded.");
    return;
  }

  window.BarfordSupabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();

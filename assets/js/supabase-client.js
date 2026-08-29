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

  if (!document.querySelector('link[href*="personal-theme.css"]')) {
    const personalThemeStyle = document.createElement("link");
    personalThemeStyle.rel = "stylesheet";
    personalThemeStyle.href = "assets/css/personal-theme.css?v=3";
    document.head.appendChild(personalThemeStyle);
  }
  window.BarfordMemberContext = (async () => {
    const { data: { session } } = await window.BarfordSupabase.auth.getSession();
    if (!session) return { session: null, profile: null };
    const { data: profile } = await window.BarfordSupabase.from("profiles")
      .select("id,full_name,is_admin,photo_url,theme_primary,theme_accent").eq("id", session.user.id).maybeSingle();
    document.body.classList.toggle("is-admin", Boolean(profile?.is_admin));
    return { session, profile };
  })();
  const personalThemeScript = document.createElement("script");
  personalThemeScript.src = "assets/js/personal-theme.js?v=2";
  document.body.appendChild(personalThemeScript);

  // Keep the shared assignment/tee guard, which is not declared in page HTML.
  if (document.body.classList.contains("admin-page") || document.body.classList.contains("scoring-page")) {
    const workflow = document.createElement("script");
    workflow.src = "assets/js/scorecard-workflow-fix.js?v=speed20";
    workflow.async = true;
    document.body.appendChild(workflow);
  }

  // Dashboard scripts are declared in index.html. Injecting them here as well
  // duplicated downloads, observers and Supabase queries on the busiest page.

  // Normal members never see Admin in navigation. Existing authorised admins
  // get the link back automatically after their signed-in profile is checked.
  window.BarfordMemberContext.catch(() => {});
})();

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

  // Prepared, assigned and started are separate scorecard states.
  if (document.body.classList.contains("admin-page") || document.body.classList.contains("scoring-page")) {
    const workflow = document.createElement("script");
    workflow.src = "assets/js/scorecard-workflow-fix.js?v=2";
    workflow.defer = true;
    document.head.appendChild(workflow);
  }

  // The tee-group scorer guard is authoritative: no scorer means no open-card action.
  if (document.getElementById("dashboardTeeGroup")) {
    const scorerChoice = document.createElement("script");
    scorerChoice.src = "assets/js/dashboard-scorer-selection.js?v=4";
    scorerChoice.async = false;
    document.body.appendChild(scorerChoice);
  }

  // Normal members never see Admin in navigation. Existing authorised admins
  // get the link back automatically after their signed-in profile is checked.
  (async () => {
    const { data: { session } } = await window.BarfordSupabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await window.BarfordSupabase.from("profiles")
      .select("is_admin").eq("id", session.user.id).maybeSingle();
    document.body.classList.toggle("is-admin", Boolean(profile?.is_admin));
  })().catch(() => {});
})();

(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;
  (async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session || !navigator.onLine) return;
    const legacyKey = `barford-scorecard-v1:${session.user.id}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(legacyKey) || "null"); } catch (_) {}
    if (!cached?.card?.id) return;
    const { data: current } = await client.from("event_scorecards").select("id,status").eq("id", cached.card.id).maybeSingle();
    if (!current || current.status === "submitted" || current.status === "locked") {
      localStorage.removeItem(legacyKey);
    }
  })().catch(() => {});
})();
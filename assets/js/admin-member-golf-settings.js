(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client) return;

  const waitForList = () => {
    const list = document.querySelector("#adminAccountList");
    if (!list) return;
    const observer = new MutationObserver(() => enhance(list));
    observer.observe(list, { childList: true });
    enhance(list);
  };

  const enhance = async list => {
    const rows = [...list.querySelectorAll(".admin-account-row")];
    if (!rows.length || rows.every(row => row.dataset.golfSettingsReady)) return;
    const { data: profiles, error } = await client.from("profiles").select("id,full_name,handicap,playing_category").order("full_name");
    if (error) return;
    const byName = new Map((profiles || []).map(profile => [String(profile.full_name || "").trim().toLowerCase(), profile]));
    rows.forEach(row => {
      if (row.dataset.golfSettingsReady) return;
      const name = row.querySelector(".admin-account-name strong")?.textContent?.trim().toLowerCase();
      const profile = byName.get(name);
      if (!profile) return;
      row.dataset.golfSettingsReady = "1";
      const panel = document.createElement("div");
      panel.className = "admin-member-golf-settings";
      panel.innerHTML = `
        <div class="admin-member-golf-heading"><strong>Golf settings</strong><small>Committee controlled</small></div>
        <label>Playing tees
          <select data-member-tee>
            <option value="">Not set</option>
            <option value="men" ${profile.playing_category === "men" ? "selected" : ""}>Yellow tees</option>
            <option value="women" ${profile.playing_category === "women" ? "selected" : ""}>Red tees</option>
          </select>
        </label>
        <label>Starting handicap
          <input data-member-handicap type="number" min="0" max="54" step="0.1" inputmode="decimal" value="${profile.handicap ?? ""}" placeholder="e.g. 18.0">
        </label>
        <button class="button button-small button-outline" type="button" data-save-member-golf>Save golf settings</button>
        <small data-member-golf-status></small>`;
      row.appendChild(panel);
      panel.querySelector("[data-save-member-golf]").addEventListener("click", async event => {
        const button = event.currentTarget;
        const status = panel.querySelector("[data-member-golf-status]");
        const tee = panel.querySelector("[data-member-tee]").value || null;
        const rawHandicap = panel.querySelector("[data-member-handicap]").value.trim();
        const handicap = rawHandicap === "" ? null : Number(rawHandicap);
        if (handicap !== null && (!Number.isFinite(handicap) || handicap < 0 || handicap > 54)) {
          status.textContent = "Enter a handicap between 0 and 54.";
          return;
        }
        button.disabled = true;
        status.textContent = "Saving…";
        const { error: saveError } = await client.from("profiles").update({
          playing_category: tee,
          handicap,
          updated_at: new Date().toISOString()
        }).eq("id", profile.id);
        button.disabled = false;
        status.textContent = saveError ? saveError.message : "Saved.";
      });
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForList, { once: true });
  else waitForList();
})();
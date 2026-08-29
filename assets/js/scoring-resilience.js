(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("scoreApp")) return;
  const SCORE_CACHE_KEY = "barford-fast-scorecard-v4";
  const DB_NAME = "barford-score-safety";
  const DB_VERSION = 1;
  const UNCHANGED_TIMESTAMP = "1970-01-01T00:00:00.000Z";
  const TEST_CACHE_KEY = "barford-active-test-event";
  let dbPromise, wakeLock = null, wakeEnabled = false, recovered = false;

  const openDb = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "key" });
        if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "card_id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  };
  const tx = async (storeName, mode, work) => {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = work(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch { return null; }
  };
  const putSnapshot = record => tx("snapshots", "readwrite", store => store.put(record));
  const getSnapshot = key => tx("snapshots", "readonly", store => store.get(key));
  const putPending = record => tx("pending", "readwrite", store => store.put(record));
  const deletePending = cardId => tx("pending", "readwrite", store => store.delete(cardId));
  const getAllPending = () => tx("pending", "readonly", store => store.getAll());

  const scoreKeys = () => [SCORE_CACHE_KEY].filter(key => localStorage.getItem(key));
  const parse = value => { try { return JSON.parse(value || "null"); } catch { return null; } };
  const snapshotAll = async () => {
    for (const key of scoreKeys()) {
      const value = localStorage.getItem(key);
      const model = parse(value);
      if (!model?.card?.id) continue;
      await putSnapshot({ key, value, saved_at: model.savedAt || Date.now(), card_id: model.card.id, user_id: model.userId });
    }
  };
  const restoreForUser = async userId => {
    const key = SCORE_CACHE_KEY;
    const backup = await getSnapshot(key);
    if (!backup?.value || (backup.user_id && backup.user_id !== userId)) return;
    const current = localStorage.getItem(key);
    const currentModel = parse(current), backupModel = parse(backup.value);
    const currentTime = Number(currentModel?.savedAt || 0), backupTime = Number(backupModel?.savedAt || 0);
    if (!current || backupTime > currentTime) {
      localStorage.setItem(key, backup.value);
      recovered = true;
    }
  };

  if (navigator.storage?.persist) navigator.storage.persist().catch(()=>{});

  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async (...args) => {
    const result = await originalGetSession(...args);
    const userId = result?.data?.session?.user?.id;
    if (userId) await restoreForUser(userId);
    return result;
  };

  const findCachedModel = cardId => {
    for (const key of scoreKeys()) {
      const model = parse(localStorage.getItem(key));
      if (String(model?.card?.id) === String(cardId)) return model;
    }
    return null;
  };
  window.BarfordScoreSafety = { queue: putPending, remove: deletePending, snapshot: snapshotAll };

  const enrichChanges = args => {
    const model = findCachedModel(args?.target_scorecard_id);
    if (!model || !Array.isArray(args?.score_changes)) return args;
    return {
      ...args,
      score_changes: args.score_changes.map(change => ({
        ...change,
        changed_at: model.scores?.[`${change.player_id}:${change.hole}`]?.changed_at || UNCHANGED_TIMESTAMP
      }))
    };
  };

  const originalRpc = client.rpc.bind(client);
  client.rpc = async (fn, args, options) => {
    if (fn !== "sync_scorecard") return originalRpc(fn, args, options);
    const enriched = enrichChanges(args || {});
    let result;
    try { result = await originalRpc(fn, enriched, options); }
    catch (error) { result = { data: null, error }; }
    if (result?.error) {
      await putPending({ card_id: enriched.target_scorecard_id, args: enriched, saved_at: new Date().toISOString() });
    } else {
      await deletePending(enriched.target_scorecard_id);
      await snapshotAll();
    }
    return result;
  };

  const replayPending = async () => {
    if (!navigator.onLine) return;
    const pending = await getAllPending();
    for (const item of pending || []) {
      try {
        const result = await originalRpc("sync_scorecard", item.args);
        if (!result?.error && item.submit_when_synced) {
          const submitted = await client.from("event_scorecards").update({ status:"submitted", updated_at:new Date().toISOString() }).eq("id", item.card_id);
          if (!submitted?.error) { await deletePending(item.card_id); const cached = findCachedModel(item.card_id); if (cached) localStorage.removeItem(SCORE_CACHE_KEY); }
        } else if (!result?.error) await deletePending(item.card_id);
      } catch {}
    }
  };

  const bar = document.createElement("div");
  bar.id = "scoreSafetyBar";
  bar.className = "score-safety-bar";
  bar.innerHTML = `<div class="score-safety-copy"><span class="score-safety-dot"></span><span id="scoreSafetyText">Scores backed up on this phone</span></div><button id="scoreWakeButton" class="score-wake-button hidden" type="button">Keep screen awake</button>`;
  document.querySelector(".score-app-header")?.after(bar);
  if (recovered) {
    const note=document.createElement("div");note.className="score-recovery-note";note.textContent="✓ Recovered your latest scorecard from the safety backup on this phone.";bar.after(note);setTimeout(()=>note.remove(),5000);
  }

  const showTestMode = async () => {
    let testEvent = null;
    if (navigator.onLine) {
      const { data, error } = await client.from("events").select("id,name,test_original_event_date").eq("test_mode_active", true).limit(1).maybeSingle();
      if (!error) {
        testEvent = data || null;
        if (testEvent) localStorage.setItem(TEST_CACHE_KEY, JSON.stringify(testEvent));
        else localStorage.removeItem(TEST_CACHE_KEY);
      }
    }
    if (!testEvent) testEvent = parse(localStorage.getItem(TEST_CACHE_KEY));
    if (!testEvent || document.getElementById("scoreTestModeBanner")) return;
    const realDate = testEvent.test_original_event_date
      ? new Intl.DateTimeFormat("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" }).format(new Date(`${testEvent.test_original_event_date}T12:00:00`))
      : "the real scheduled date";
    const banner = document.createElement("div");
    banner.id = "scoreTestModeBanner";
    banner.className = "score-test-mode-banner";
    banner.innerHTML = `TEST EVENT · ${String(testEvent.name || "Society round").replace(/[<>]/g,"")}<small>Full live scoring simulation · real event date ${realDate}</small>`;
    bar.after(banner);
  };
  showTestMode();

  const safetyText = document.getElementById("scoreSafetyText");
  const updateSafety = () => {
    const syncText = document.getElementById("scoreSyncButton")?.textContent || "";
    bar.classList.toggle("offline", !navigator.onLine);
    bar.classList.toggle("problem", navigator.onLine && /offline|failed/i.test(syncText));
    if (!navigator.onLine) safetyText.textContent = "No signal — scores are safe on this phone";
    else if (/Saving/i.test(syncText)) safetyText.textContent = "Saving to phone and server…";
    else if (/offline|failed/i.test(syncText)) safetyText.textContent = "Server retry pending — phone backup is safe";
    else safetyText.textContent = "Phone backup ✓ · server saved";
  };
  const syncButton = document.getElementById("scoreSyncButton");
  if (syncButton) new MutationObserver(updateSafety).observe(syncButton, { childList:true, subtree:true, characterData:true, attributes:true });

  const requestWake = async () => {
    if (!wakeEnabled || !navigator.wakeLock || document.visibilityState !== "visible") return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch {}
  };
  const wakeButton = document.getElementById("scoreWakeButton");
  if ("wakeLock" in navigator && wakeButton) {
    wakeButton.classList.remove("hidden");
    wakeButton.addEventListener("click", async () => {
      wakeEnabled = !wakeEnabled;
      wakeButton.textContent = wakeEnabled ? "Screen stays awake" : "Keep screen awake";
      if (wakeEnabled) await requestWake(); else if (wakeLock) { try { await wakeLock.release(); } catch {} wakeLock=null; }
    });
  }

  const forceSafeSave = async () => {
    await snapshotAll();
    if (navigator.onLine) document.getElementById("scoreSyncButton")?.click();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") forceSafeSave();
    else if (wakeEnabled) requestWake();
  });
  window.addEventListener("pagehide", () => { snapshotAll(); });
  window.addEventListener("online", () => { updateSafety(); showTestMode(); setTimeout(async()=>{await replayPending();document.getElementById("scoreSyncButton")?.click();},250); });
  window.addEventListener("offline", updateSafety);
  window.addEventListener("error", () => snapshotAll());
  window.addEventListener("unhandledrejection", () => snapshotAll());
  setInterval(snapshotAll, 1200);
  setInterval(() => { if (navigator.onLine) replayPending(); }, 15000);
  if (navigator.onLine) replayPending();
  updateSafety();
})();

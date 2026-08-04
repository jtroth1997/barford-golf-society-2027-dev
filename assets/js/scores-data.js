/**
 * Empty 2027 scores adapter.
 *
 * The previous local demonstration season has been removed. This adapter
 * deliberately returns a clean season until the Supabase data adapter is
 * enabled after the first real administrator account is created.
 */
export const DATABASE_ADAPTER = Object.freeze({
  driver: "supabase",
  project: "xspzmthygrajzktydvvj",
  season: 2027
});

const emptySeason = () => ({
  season: 2027,
  players: [],
  rounds: [],
  achievements: [],
  nextEvent: null
});

let snapshot = emptySeason();
let loadedAt = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const changed = () => window.dispatchEvent(new CustomEvent("scores:data-changed"));

export const ScoresData = {
  async getSnapshot() {
    if (window.BarfordSupabase && Date.now() - loadedAt > 30000) {
      const today = new Date();
      const localToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
      const [snapshotResult, eventResult] = await Promise.all([
        window.BarfordSupabase.rpc("get_2027_leaderboard_snapshot"),
        window.BarfordSupabase
          .from("events")
          .select("id,name,venue,address,event_date,first_tee_time,price")
          .eq("status", "scheduled")
          .gte("event_date", localToday)
          .order("event_date", { ascending: true })
          .limit(1)
      ]);
      if (!snapshotResult.error && snapshotResult.data) {
        snapshot = {
          ...emptySeason(),
          ...snapshotResult.data,
          nextEvent: eventResult.error ? null : (eventResult.data?.[0] || null)
        };
        loadedAt = Date.now();
      }
    }
    return clone(snapshot);
  },
  async saveSnapshot(next) { snapshot = clone(next); changed(); return clone(snapshot); },
  async reset() { snapshot = emptySeason(); changed(); return clone(snapshot); },
  async addPlayer() { throw new Error("Use the secure 2027 member system to add players."); },
  async updatePlayer() { throw new Error("Secure score administration is not active yet."); },
  async removePlayer() { throw new Error("Secure score administration is not active yet."); },
  async createRound() { throw new Error("Secure score administration is not active yet."); },
  async saveRoundResults() { throw new Error("Secure score administration is not active yet."); },
  async addAchievement() { throw new Error("Secure score administration is not active yet."); },
  async removeAchievement() { throw new Error("Secure score administration is not active yet."); }
};

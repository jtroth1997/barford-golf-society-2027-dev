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
  achievements: []
});

let snapshot = emptySeason();
let loadedAt = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const changed = () => window.dispatchEvent(new CustomEvent("scores:data-changed"));

export const ScoresData = {
  async getSnapshot() {
    if (window.BarfordSupabase && Date.now() - loadedAt > 30000) {
      const { data, error } = await window.BarfordSupabase.rpc("get_2027_leaderboard_snapshot");
      if (!error && data) {
        snapshot = { ...emptySeason(), ...data };
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

/**
 * Development data adapter.
 *
 * DATABASE_ADAPTER is the only configuration point that must change when the
 * 2027 backend is connected. The current adapter is intentionally local-only:
 * no production URL, credentials, storage, authentication or API keys exist.
 */
export const DATABASE_ADAPTER = Object.freeze({
  driver: "localStorage",
  namespace: "barford-golf-society-2027-dev-v1"
});

const seed = {
  season: 2027,
  players: [
    { id: "p1", name: "Alan Brooks", startingHandicap: 18, currentHandicap: 17 },
    { id: "p2", name: "Brian Cooper", startingHandicap: 22, currentHandicap: 23 },
    { id: "p3", name: "Chris Davies", startingHandicap: 14, currentHandicap: 13 },
    { id: "p4", name: "David Evans", startingHandicap: 27, currentHandicap: 26 },
    { id: "p5", name: "Eric Foster", startingHandicap: 10, currentHandicap: 10 },
    { id: "p6", name: "Frank Green", startingHandicap: 31, currentHandicap: 32 }
  ],
  rounds: [
    { id: "r1", number: 1, name: "Round 1", date: "2027-03-21", results: [
      { playerId:"p1", handicapUsed:18, points:37, adjustment:-1, nextHandicap:17, dnp:false },
      { playerId:"p2", handicapUsed:22, points:31, adjustment:0, nextHandicap:22, dnp:false },
      { playerId:"p3", handicapUsed:14, points:39, adjustment:-1, nextHandicap:13, dnp:false },
      { playerId:"p4", handicapUsed:27, points:28, adjustment:1, nextHandicap:28, dnp:false },
      { playerId:"p5", handicapUsed:10, points:34, adjustment:0, nextHandicap:10, dnp:false },
      { playerId:"p6", handicapUsed:31, points:25, adjustment:2, nextHandicap:33, dnp:false }
    ]},
    { id: "r2", number: 2, name: "Round 2", date: "2027-04-18", results: [
      { playerId:"p1", handicapUsed:17, points:34, adjustment:0, nextHandicap:17, dnp:false },
      { playerId:"p2", handicapUsed:22, points:38, adjustment:-1, nextHandicap:21, dnp:false },
      { playerId:"p3", handicapUsed:13, points:35, adjustment:0, nextHandicap:13, dnp:false },
      { playerId:"p4", handicapUsed:28, points:40, adjustment:-2, nextHandicap:26, dnp:false },
      { playerId:"p5", handicapUsed:10, points:0, adjustment:null, nextHandicap:10, dnp:true },
      { playerId:"p6", handicapUsed:33, points:29, adjustment:-1, nextHandicap:32, dnp:false }
    ]}
  ],
  achievements: [
    { id:"a1", roundId:"r1", playerId:"p3", type:"win" },
    { id:"a2", roundId:"r1", playerId:"p1", type:"runnerUp" },
    { id:"a3", roundId:"r1", playerId:"p5", type:"third" },
    { id:"a4", roundId:"r1", playerId:"p2", type:"nearestPin" },
    { id:"a5", roundId:"r1", playerId:"p4", type:"longestDrive" },
    { id:"a6", roundId:"r2", playerId:"p4", type:"win" },
    { id:"a7", roundId:"r2", playerId:"p2", type:"runnerUp" },
    { id:"a8", roundId:"r2", playerId:"p3", type:"third" }
  ]
};

const clone = value => JSON.parse(JSON.stringify(value));
const key = DATABASE_ADAPTER.namespace;

function read() {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(seed));
      return clone(seed);
    }
    return JSON.parse(raw);
  } catch {
    return clone(seed);
  }
}

function write(data) {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("scores:data-changed"));
  return clone(data);
}

export const ScoresData = {
  async getSnapshot() { return clone(read()); },
  async saveSnapshot(snapshot) { return write(snapshot); },
  async reset() { localStorage.removeItem(key); return write(clone(seed)); },

  async addPlayer({ name, startingHandicap }) {
    const data = read();
    const cleanName = name.trim();
    if (!cleanName) throw new Error("Player name is required");
    if (data.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) throw new Error("Player already exists");
    data.players.push({
      id: crypto.randomUUID(),
      name: cleanName,
      startingHandicap,
      currentHandicap: startingHandicap
    });
    return write(data);
  },

  async updatePlayer(playerId, patch) {
    const data = read();
    const player = data.players.find(item => item.id === playerId);
    if (!player) throw new Error("Player not found");
    Object.assign(player, patch);
    return write(data);
  },

  async removePlayer(playerId) {
    const data = read();
    data.players = data.players.filter(p => p.id !== playerId);
    data.rounds.forEach(round => round.results = round.results.filter(r => r.playerId !== playerId));
    data.achievements = data.achievements.filter(a => a.playerId !== playerId);
    return write(data);
  },

  async createRound({ name, date }) {
    const data = read();
    const number = data.rounds.length ? Math.max(...data.rounds.map(r => r.number)) + 1 : 1;
    data.rounds.push({ id: crypto.randomUUID(), number, name: name.trim() || `Round ${number}`, date, results: [] });
    return write(data);
  },

  async saveRoundResults(roundId, results) {
    const data = read();
    const round = data.rounds.find(item => item.id === roundId);
    if (!round) throw new Error("Round not found");
    round.results = clone(results);
    results.forEach(result => {
      const player = data.players.find(p => p.id === result.playerId);
      if (player) player.currentHandicap = result.nextHandicap;
    });
    return write(data);
  },

  async addAchievement(record) {
    const data = read();
    data.achievements.push({ id: crypto.randomUUID(), ...record });
    return write(data);
  },

  async removeAchievement(id) {
    const data = read();
    data.achievements = data.achievements.filter(item => item.id !== id);
    return write(data);
  }
};

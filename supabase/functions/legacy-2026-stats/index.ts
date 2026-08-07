import { createClient } from "jsr:@supabase/supabase-js@2";

const LIVE_2026_URL = "https://tzzkgfehtnuizamzlbgr.supabase.co";
const LIVE_2026_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6emtnZmVodG51aXphbXpsYmdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzY5ODAsImV4cCI6MjA3ODAxMjk4MH0.2mf4RMbJJvPo0NApywlrDyHuqAMfMyEWxgOS2ZSP4KQ";
const allowedOrigins = new Set([
  "https://jtroth1997.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const cors = (request: Request) => {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://jtroth1997.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
};
const json = (request: Request, value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...cors(request), "Content-Type": "application/json", "Cache-Control": "private, no-store" }
});
const normalise = (value: string) => String(value || "").toLowerCase()
  .replace(/\bmoyce\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
const commonSenseMatch = (accountName: string, scoreName: string) => {
  const account = normalise(accountName);
  const score = normalise(scoreName);
  if (!score.length) return false;
  const surnameMatches = account.at(-1) === score.at(-1);
  const firstMatches = account[0] === score[0] || account[0]?.startsWith(score[0]) || score[0]?.startsWith(account[0]);
  return Boolean(surnameMatches && firstMatches);
};

const buildStats = (
  playerName: string,
  players: Array<{ name: string }>,
  scores: Array<Record<string, unknown>>
) => {
  const rows = scores
    .filter(row => row.player === playerName && Number.isFinite(Number(row.points)))
    .sort((a, b) => Number(a.round) - Number(b.round));
  const leaderboard = players.map(entry => {
    const entries = scores.filter(score => score.player === entry.name && Number.isFinite(Number(score.points)));
    return {
      name: entry.name,
      total: entries.map(score => Number(score.points)).sort((a, b) => b - a)
        .slice(0, 5).reduce((sum, points) => sum + points, 0),
      wins: entries.filter(score => score.winner).length
    };
  }).sort((a, b) => b.total - a.total || b.wins - a.wins || a.name.localeCompare(b.name));
  const position = leaderboard.findIndex(entry => entry.name === playerName) + 1;
  if (!rows.length) return { name: playerName, position, rounds: 0 };
  const points = rows.map(row => Number(row.points));
  const latest = rows[rows.length - 1];
  const topThreeFinishes = rows.reduce((count, score) => {
    const roundRows = scores
      .filter(row => Number(row.round) === Number(score.round) && Number.isFinite(Number(row.points)))
      .sort((a, b) => Number(b.points) - Number(a.points));
    const place = roundRows.findIndex(row => row.player === playerName);
    return count + (place >= 0 && place < 3 ? 1 : 0);
  }, 0);
  return {
    name: playerName,
    position,
    points: leaderboard.find(entry => entry.name === playerName)?.total || 0,
    best: Math.max(...points),
    average: Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 10) / 10,
    rounds: points.length,
    handicap: latest.next_handicap ?? latest.handicap ?? null,
    wins: rows.filter(row => row.winner).length,
    topThreeFinishes,
    trend: points[points.length - 1] - points[0],
    latestScore: points[points.length - 1]
  };
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

  const requestBody = await request.json().catch(() => ({}));
  const action = String(requestBody.action || "suggest");
  const liveHeaders = { apikey: LIVE_2026_ANON_KEY, Authorization: `Bearer ${LIVE_2026_ANON_KEY}` };

  // Registration needs names only. The 2026 player list is already public;
  // no contact details, account IDs or 2027 profile fields leave this function.
  if (action === "roster") {
    const playersResponse = await fetch(`${LIVE_2026_URL}/rest/v1/players?select=name&order=name.asc`, { headers: liveHeaders });
    if (!playersResponse.ok) return json(request, { error: "Member names are temporarily unavailable" }, 503);
    const players: Array<{ name: string }> = await playersResponse.json();
    return json(request, { players: [...new Set(players.map(player => String(player.name || "").trim()).filter(Boolean))] });
  }

  const authorization = request.headers.get("Authorization");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const projectKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!authorization || !projectUrl || !projectKey) return json(request, { error: "Unauthorised" }, 401);
  const memberClient = createClient(projectUrl, projectKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: { user }, error: userError } = await memberClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Unauthorised" }, 401);
  const [{ data: profile }, { data: existingLink }] = await Promise.all([
    memberClient.from("profiles").select("full_name").eq("id", user.id).single(),
    memberClient.from("legacy_member_links").select("*").eq("member_id", user.id).maybeSingle()
  ]);
  if (!profile) return json(request, { error: "Member profile not found" }, 404);

  if (action === "decline") {
    const { error } = await memberClient.from("legacy_member_links").upsert({
      member_id: user.id, legacy_name: null, confirmed: false,
      declined_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    if (error) return json(request, { error: error.message }, 400);
    return json(request, { status: "declined" });
  }

  const [playersResponse, scoresResponse] = await Promise.all([
    fetch(`${LIVE_2026_URL}/rest/v1/players?select=name&order=name.asc`, { headers: liveHeaders }),
    fetch(`${LIVE_2026_URL}/rest/v1/scores?select=player,round,points,handicap,next_handicap,winner`, { headers: liveHeaders })
  ]);
  if (!playersResponse.ok || !scoresResponse.ok) return json(request, { error: "2026 results are temporarily unavailable" }, 503);
  const players: Array<{ name: string }> = await playersResponse.json();
  const scores: Array<Record<string, unknown>> = await scoresResponse.json();

  if (existingLink?.confirmed && existingLink.legacy_name) {
    const exists = players.some(player => player.name === existingLink.legacy_name);
    if (exists) return json(request, { status: "linked", stats: buildStats(existingLink.legacy_name, players, scores) });
  }
  if (existingLink?.declined_at && action === "suggest") return json(request, { status: "declined" });

  const candidate = players.find(player => commonSenseMatch(profile.full_name, player.name));
  if (!candidate) return json(request, { status: "no-match" });
  if (action !== "confirm") return json(request, { status: "confirm", candidate: { name: candidate.name } });
  if (String(requestBody.legacyName || "") !== candidate.name) return json(request, { error: "Player confirmation did not match" }, 400);

  const { error: linkError } = await memberClient.from("legacy_member_links").upsert({
    member_id: user.id,
    legacy_name: candidate.name,
    confirmed: true,
    declined_at: null,
    updated_at: new Date().toISOString()
  });
  if (linkError) {
    const message = linkError.code === "23505"
      ? "That 2026 player has already been linked to another account."
      : linkError.message;
    return json(request, { error: message }, 409);
  }
  return json(request, { status: "linked", stats: buildStats(candidate.name, players, scores) });
});

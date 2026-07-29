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
  headers: { ...cors(request), "Content-Type": "application/json", "Cache-Control": "private, max-age=300" }
});

const normalise = (value: string) => String(value || "")
  .toLowerCase()
  .replace(/moyce/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const matches = (accountName: string, scoreName: string) => {
  const account = normalise(accountName);
  const score = normalise(scoreName);
  return score.length > 0 && score.every(part => account.includes(part));
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed" }, 405);

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

  const { data: profile, error: profileError } = await memberClient
    .from("profiles").select("full_name").eq("id", user.id).single();
  if (profileError || !profile) return json(request, { error: "Member profile not found" }, 404);

  const headers = { apikey: LIVE_2026_ANON_KEY, Authorization: `Bearer ${LIVE_2026_ANON_KEY}` };
  const [playersResponse, scoresResponse] = await Promise.all([
    fetch(`${LIVE_2026_URL}/rest/v1/players?select=name&order=name.asc`, { headers }),
    fetch(`${LIVE_2026_URL}/rest/v1/scores?select=player,round,points,handicap,next_handicap,winner`, { headers })
  ]);
  if (!playersResponse.ok || !scoresResponse.ok) return json(request, { error: "2026 results are temporarily unavailable" }, 503);

  const players = await playersResponse.json();
  const scores = await scoresResponse.json();
  const player = players.find((row: { name: string }) => matches(profile.full_name, row.name));
  if (!player) return json(request, null);

  const rows = scores
    .filter((row: Record<string, unknown>) => row.player === player.name && Number.isFinite(Number(row.points)))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(a.round) - Number(b.round));
  const leaderboard = players.map((entry: { name: string }) => {
    const entries = scores.filter((score: Record<string, unknown>) =>
      score.player === entry.name && Number.isFinite(Number(score.points)));
    return {
      name: entry.name,
      total: entries.map((score: Record<string, unknown>) => Number(score.points))
        .sort((a: number, b: number) => b - a).slice(0, 5).reduce((sum: number, points: number) => sum + points, 0),
      wins: entries.filter((score: Record<string, unknown>) => score.winner).length
    };
  }).sort((a: { total: number; wins: number; name: string }, b: { total: number; wins: number; name: string }) =>
    b.total - a.total || b.wins - a.wins || a.name.localeCompare(b.name));

  const position = leaderboard.findIndex((entry: { name: string }) => entry.name === player.name) + 1;
  if (!rows.length) return json(request, { name: player.name, position, rounds: 0 });

  const points = rows.map((row: Record<string, unknown>) => Number(row.points));
  const latest = rows[rows.length - 1];
  const topThreeFinishes = rows.reduce((count: number, score: Record<string, unknown>) => {
    const roundRows = scores
      .filter((row: Record<string, unknown>) => Number(row.round) === Number(score.round) && Number.isFinite(Number(row.points)))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.points) - Number(a.points));
    const place = roundRows.findIndex((row: Record<string, unknown>) => row.player === player.name);
    return count + (place >= 0 && place < 3 ? 1 : 0);
  }, 0);

  return json(request, {
    name: player.name,
    position,
    points: leaderboard.find((entry: { name: string }) => entry.name === player.name)?.total || 0,
    best: Math.max(...points),
    average: Math.round((points.reduce((sum: number, value: number) => sum + value, 0) / points.length) * 10) / 10,
    rounds: points.length,
    handicap: latest.next_handicap ?? latest.handicap ?? null,
    wins: rows.filter((row: Record<string, unknown>) => row.winner).length,
    topThreeFinishes,
    trend: points[points.length - 1] - points[0],
    latestScore: points[points.length - 1]
  });
});

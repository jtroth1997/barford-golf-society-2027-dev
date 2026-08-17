const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const adminRequest = async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!authorization || !supabaseUrl || !anonKey || !serviceKey) return false;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  return profiles?.[0]?.is_admin === true;
};

const arrayFrom = (value: any, keys: string[]) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
};

const colour = (tee: any) => String(tee.colour || tee.color || tee.tee_colour || tee.tee_color || tee.name || tee.tee_name || "").trim();
const normaliseHoles = (tee: any) => arrayFrom(tee, ["holes", "scorecard", "hole_data"]).map((hole: any, index: number) => ({
  hole: Number(hole.hole || hole.hole_number || hole.number || index + 1),
  par: Number(hole.par || hole.par_value),
  yards: Number(hole.yards || hole.yardage || hole.length_yards || hole.distance),
  stroke_index: Number(hole.stroke_index || hole.si || hole.handicap || hole.hcp),
})).filter((hole: any) => hole.hole >= 1 && hole.hole <= 18);

const normaliseTeeSets = (payload: any) => {
  const roots = [payload, payload?.data, payload?.course, payload?.scorecard].filter(Boolean);
  let tees: any[] = [];
  for (const root of roots) {
    tees = arrayFrom(root, ["tee_sets", "tees", "teeboxes", "tee_boxes", "scorecards"]);
    if (tees.length) break;
  }
  return tees.map(tee => ({
    id: String(tee.id || tee.tee_id || colour(tee)),
    name: colour(tee),
    gender: String(tee.gender || tee.sex || tee.category || "").toLowerCase(),
    holes: normaliseHoles(tee),
  })).filter(tee => tee.holes.length === 18);
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await adminRequest(request))) return json({ error: "Administrator access required." }, 403);
  const apiKey = Deno.env.get("UK_GOLF_API_KEY");
  if (!apiKey) return json({ error: "UK Golf API is ready but its RapidAPI key has not been connected yet.", code: "UK_GOLF_KEY_MISSING" }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  let path = "";
  if (action === "nearby") {
    const lat = Number(body.latitude), lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "This event has no course location." }, 400);
    path = `/clubs/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius_km=8`;
  } else if (action === "courses" && body.club_id) path = `/clubs/${encodeURIComponent(body.club_id)}/courses`;
  else if (action === "scorecard" && body.course_id) path = `/courses/${encodeURIComponent(body.course_id)}/scorecard`;
  else return json({ error: "Invalid course-data request." }, 400);

  const response = await fetch(`https://uk-golf-api.vercel.app${path}`, {
    headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "uk-golf-course-data-api.p.rapidapi.com" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return json({ error: payload?.message || payload?.error || `UK Golf API returned ${response.status}.` }, response.status);
  if (action === "nearby") {
    const clubs = arrayFrom(payload, ["clubs", "results", "data"]).map((club: any) => ({ id: club.id || club.club_id, name: club.name || club.club_name, county: club.county || club.region || "" }));
    return json({ clubs });
  }
  if (action === "courses") {
    const courses = arrayFrom(payload, ["courses", "results", "data"]).map((course: any) => ({ id: course.id || course.course_id, name: course.name || course.course_name, holes: course.holes || course.hole_count || 18 }));
    return json({ courses });
  }
  return json({ tee_sets: normaliseTeeSets(payload) });
});

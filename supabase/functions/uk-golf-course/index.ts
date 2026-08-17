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
const normaliseTeeMetadata = (course: any) => arrayFrom(course, ["tee_sets", "tees", "teeboxes", "tee_boxes"]).map((tee: any) => ({
  id: String(tee.id || tee.tee_id || tee.tee_set_id || ""),
  name: colour(tee),
  gender: String(tee.gender || tee.sex || tee.category || "").toLowerCase(),
})).filter((tee: any) => tee.id && tee.name);
const normaliseHoles = (tee: any) => arrayFrom(tee, ["holes", "scorecard", "hole_data"]).map((hole: any, index: number) => ({
  hole: Number(hole.hole || hole.hole_number || hole.number || index + 1),
  par: Number(hole.par || hole.par_value),
  yards: Number(hole.yards || hole.yardage || hole.length_yards || hole.distance),
  stroke_index: Number(hole.stroke_index || hole.si || hole.handicap || hole.hcp),
})).filter((hole: any) => hole.hole >= 1 && hole.hole <= 18);

const normaliseScorecard = (payload: any) => {
  const root = payload?.data || payload;
  const tee = root?.tee_set || root?.tee || root;
  return {
    id: String(tee?.id || tee?.tee_id || ""),
    name: colour(tee),
    gender: String(tee?.gender || tee?.sex || tee?.category || "").toLowerCase(),
    holes: normaliseHoles({ ...tee, holes: root?.holes || tee?.holes }),
  };
};

// UK Golf API currently omits SI values for these Celtic Manor cards. These
// published indexes are deliberately narrow fallbacks, not inferred values.
// Source: https://www.golfify.io/courses/celtic-manor-resort-twenty-ten
// Source: https://www.golfify.io/courses/celtic-manor-resort-montgomerie
const curatedStrokeIndexes: Record<string, { yellow: number[]; red: number[] }> = {
  "9fc6399e-3e5f-40e0-8c95-d14ff9a174db": {
    yellow: [11, 3, 13, 15, 1, 7, 17, 9, 5, 18, 8, 4, 14, 2, 12, 6, 16, 10],
    red: [13, 5, 11, 15, 1, 7, 17, 9, 3, 18, 8, 4, 14, 2, 12, 6, 16, 10],
  },
  "178cfe35-675c-4a27-b60b-0904373af9fc": {
    yellow: [3, 13, 9, 7, 11, 15, 1, 17, 5, 18, 10, 8, 14, 4, 16, 12, 2, 6],
    red: [3, 13, 9, 7, 11, 15, 1, 17, 5, 18, 10, 8, 14, 4, 16, 12, 2, 6],
  },
};

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
  let apiKey = Deno.env.get("UK_GOLF_API_KEY");
  if (!apiKey) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const secretResponse = await fetch(`${supabaseUrl}/rest/v1/integration_secrets?name=eq.UK_GOLF_API_KEY&select=secret_value`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (secretResponse.ok) apiKey = (await secretResponse.json())?.[0]?.secret_value;
    }
  }
  if (!apiKey) return json({ error: "UK Golf API is ready but its RapidAPI key has not been connected yet.", code: "UK_GOLF_KEY_MISSING" }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  let path = "";
  if (action === "nearby") {
    const lat = Number(body.latitude), lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "This event has no course location." }, 400);
    const query = String(body.query || "").replace(/\b(resort|hotel|the)\b/gi, " ").replace(/\s+/g, " ").trim();
    path = query ? `/clubs?search=${encodeURIComponent(query)}` : `/clubs/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius_km=8`;
  } else if (action === "courses" && body.club_id) path = `/clubs/${encodeURIComponent(String(body.club_id).split(",")[0])}/courses`;
  else if (action === "scorecard" && body.course_id && body.yellow_tee_id && body.red_tee_id) path = `/courses/${encodeURIComponent(body.course_id)}/scorecard`;
  else return json({ error: "Invalid course-data request." }, 400);

  const apiHeaders = { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "uk-golf-course-data-api.p.rapidapi.com" };
  if (action === "courses" && String(body.club_id).includes(",")) {
    const clubIds = String(body.club_id).split(",").filter(Boolean);
    const payloads = await Promise.all(clubIds.map(async id => {
      const result = await fetch(`https://uk-golf-course-data-api.p.rapidapi.com/clubs/${encodeURIComponent(id)}/courses`, { headers: apiHeaders });
      return result.ok ? await result.json() : [];
    }));
    const courses = payloads.flatMap(payload => arrayFrom(payload, ["courses", "results", "data"])).map((course: any) => ({ id: course.id || course.course_id, name: course.name || course.course_name, holes: course.holes || course.hole_count || 18, tee_sets: normaliseTeeMetadata(course) }));
    return json({ courses });
  }
  if (action === "scorecard") {
    const teeIds = [String(body.yellow_tee_id), String(body.red_tee_id)];
    const responses = await Promise.all(teeIds.map(teeId => fetch(`https://uk-golf-course-data-api.p.rapidapi.com${path}?tee_id=${encodeURIComponent(teeId)}`, { headers: apiHeaders })));
    const payloads = await Promise.all(responses.map(response => response.json().catch(() => null)));
    const failed = responses.findIndex(response => !response.ok);
    if (failed >= 0) return json({ error: payloads[failed]?.message || payloads[failed]?.error || `UK Golf API returned ${responses[failed].status}.` }, responses[failed].status);
    const teeSets = payloads.map(normaliseScorecard);
    const fallback = curatedStrokeIndexes[String(body.course_id)];
    if (fallback) teeSets.forEach((tee, index) => {
      const indexes = index === 0 ? fallback.yellow : fallback.red;
      if (tee.holes.every((hole: any) => !hole.stroke_index)) tee.holes = tee.holes.map((hole: any, holeIndex: number) => ({ ...hole, stroke_index: indexes[holeIndex] }));
    });
    return json({ tee_sets: teeSets });
  }
  const response = await fetch(`https://uk-golf-course-data-api.p.rapidapi.com${path}`, { headers: apiHeaders });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return json({ error: payload?.message || payload?.error || `UK Golf API returned ${response.status}.` }, response.status);
  if (action === "nearby") {
    let found = arrayFrom(payload, ["clubs", "results", "data"]);
    const grouped = new Map<string, any>();
    found.forEach((club: any) => {
      const name=String(club.name || club.club_name || "Golf club"), key=name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing=grouped.get(key);
      if(existing) existing.id += `,${club.id || club.club_id}`;
      else grouped.set(key,{id:String(club.id || club.club_id),name,county:club.county || club.region || ""});
    });
    return json({ clubs: [...grouped.values()] });
  }
  if (action === "courses") {
    const courses = arrayFrom(payload, ["courses", "results", "data"]).map((course: any) => ({ id: course.id || course.course_id, name: course.name || course.course_name, holes: course.holes || course.hole_count || 18, tee_sets: normaliseTeeMetadata(course) }));
    return json({ courses });
  }
  return json({ tee_sets: normaliseTeeSets(payload) });
});

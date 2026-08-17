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

const curatedStrokeIndexes: Record<string, { yellow: number[]; red: number[] }> = {
  "9fc6399e-3e5f-40e0-8c95-d14ff9a174db": {
    yellow: [11,3,13,15,1,7,17,9,5,18,8,4,14,2,12,6,16,10],
    red: [13,5,11,15,1,7,17,9,3,18,8,4,14,2,12,6,16,10],
  },
  "178cfe35-675c-4a27-b60b-0904373af9fc": {
    yellow: [3,13,9,7,11,15,1,17,5,18,10,8,14,4,16,12,2,6],
    red: [3,13,9,7,11,15,1,17,5,18,10,8,14,4,16,12,2,6],
  },
};

const romanRoadFallback = {
  id: "verified:celtic-manor-roman-road",
  name: "Roman Road",
  holes: 18,
  tee_sets: [
    { id: "verified:roman-road-yellow", name: "Yellow", gender: "male" },
    { id: "verified:roman-road-red", name: "Red", gender: "female" },
  ],
};
const romanRoadCards = [
  {
    id: "verified:roman-road-yellow", name: "Yellow", gender: "male",
    holes: [[1,4,423,7],[2,3,180,13],[3,5,507,3],[4,4,288,15],[5,4,428,1],[6,5,450,17],[7,4,401,9],[8,3,186,11],[9,4,353,5],[10,4,420,8],[11,3,154,12],[12,4,355,6],[13,3,182,14],[14,4,350,2],[15,3,132,16],[16,5,468,18],[17,4,381,4],[18,4,381,10]].map(([hole,par,yards,stroke_index]) => ({hole,par,yards,stroke_index})),
  },
  {
    id: "verified:roman-road-red", name: "Red", gender: "female",
    holes: [[1,5,386,9],[2,3,138,17],[3,5,446,3],[4,4,240,15],[5,5,433,1],[6,4,326,5],[7,4,371,13],[8,3,163,11],[9,4,277,7],[10,4,371,8],[11,3,123,14],[12,4,290,6],[13,3,153,16],[14,4,292,2],[15,3,118,18],[16,5,450,10],[17,4,355,4],[18,5,392,12]].map(([hole,par,yards,stroke_index]) => ({hole,par,yards,stroke_index})),
  },
];

const celticManorClubIds = ["3ef3c44f-bd94-4c4d-9c90-3c92224ff172", "b71c4033-eece-4108-b3e2-c1d363976a23"];
const celticManorCombinedId = celticManorClubIds.join(",");
const includesCelticManor = (clubIds: string) => clubIds.split(",").some(id => celticManorClubIds.includes(id));
const celticManorClub = { id: celticManorCombinedId, name: "Celtic Manor Resort", county: "Newport" };

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

const normaliseClubs = (payload: any) => {
  const found = arrayFrom(payload, ["clubs", "results", "data"]);
  const grouped = new Map<string, any>();
  found.forEach((club: any) => {
    const id = String(club.id || club.club_id || "");
    if (!id) return;
    const name = String(club.name || club.club_name || "Golf club");
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = grouped.get(key);
    if (existing) {
      const ids = new Set(String(existing.id).split(",").concat(id));
      existing.id = [...ids].join(",");
    } else grouped.set(key, { id, name, county: club.county || club.region || "" });
  });
  return [...grouped.values()];
};

const cleanClubQuery = (value: unknown) => {
  let query = String(value || "").trim();
  query = query.split(/\s[–—]\s/)[0];
  query = query
    .replace(/\b(roman road|montgomerie|twenty ten|2010 course|twenty-ten)\b/gi, " ")
    .replace(/\b(resort|hotel|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return query;
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
  const apiHeaders = { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "uk-golf-course-data-api.p.rapidapi.com" };
  const apiGet = async (path: string) => {
    const response = await fetch(`https://uk-golf-course-data-api.p.rapidapi.com${path}`, { headers: apiHeaders });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  };

  if (action === "nearby") {
    const lat = Number(body.latitude), lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "This event has no course location." }, 400);
    const originalQuery = String(body.query || "");
    const query = cleanClubQuery(originalQuery);

    if (/celtic\s+manor/i.test(originalQuery)) return json({ clubs: [celticManorClub] });

    let clubs: any[] = [];
    let lastError: any = null;
    if (query) {
      const searched = await apiGet(`/clubs?search=${encodeURIComponent(query)}`);
      if (searched.response.ok) clubs = normaliseClubs(searched.payload);
      else lastError = searched;
    }

    if (!clubs.length) {
      const nearby = await apiGet(`/clubs/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius_km=12`);
      if (nearby.response.ok) clubs = normaliseClubs(nearby.payload);
      else lastError = nearby;
    }

    if (!clubs.length && lastError && !lastError.response.ok) {
      return json({ error: lastError.payload?.message || lastError.payload?.error || `UK Golf API returned ${lastError.response.status}.` }, lastError.response.status);
    }
    return json({ clubs });
  }

  if (action === "courses" && body.club_id) {
    const clubIds = String(body.club_id).split(",").filter(Boolean);
    const payloads = await Promise.all(clubIds.map(async id => {
      const result = await apiGet(`/clubs/${encodeURIComponent(id)}/courses`);
      return result.response.ok ? result.payload : [];
    }));
    const courses = payloads.flatMap(payload => arrayFrom(payload, ["courses", "results", "data"])).map((course: any) => ({
      id: course.id || course.course_id,
      name: course.name || course.course_name,
      holes: course.holes || course.hole_count || 18,
      tee_sets: normaliseTeeMetadata(course),
    })).filter((course: any) => course.id);
    if (includesCelticManor(String(body.club_id)) && !courses.some((course: any) => course.id === romanRoadFallback.id)) courses.push(romanRoadFallback);
    return json({ courses });
  }

  if (action === "scorecard" && body.course_id && body.yellow_tee_id && body.red_tee_id) {
    if (body.course_id === romanRoadFallback.id) return json({ tee_sets: romanRoadCards, source: "BlueGolf verified fallback" });
    const teeIds = [String(body.yellow_tee_id), String(body.red_tee_id)];
    const responses = await Promise.all(teeIds.map(teeId => apiGet(`/courses/${encodeURIComponent(body.course_id)}/scorecard?tee_id=${encodeURIComponent(teeId)}`)));
    const failed = responses.find(item => !item.response.ok);
    if (failed) return json({ error: failed.payload?.message || failed.payload?.error || `UK Golf API returned ${failed.response.status}.` }, failed.response.status);
    const teeSets = responses.map(item => normaliseScorecard(item.payload));
    const fallback = curatedStrokeIndexes[String(body.course_id)];
    if (fallback) teeSets.forEach((tee, index) => {
      const indexes = index === 0 ? fallback.yellow : fallback.red;
      if (tee.holes.every((hole: any) => !hole.stroke_index)) tee.holes = tee.holes.map((hole: any, holeIndex: number) => ({ ...hole, stroke_index: indexes[holeIndex] }));
    });
    return json({ tee_sets: teeSets });
  }

  return json({ error: "Invalid course-data request." }, 400);
});

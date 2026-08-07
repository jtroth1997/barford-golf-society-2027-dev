const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  editorialSummary?: { text?: string };
  websiteUri?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const placeFields = "id,displayName,formattedAddress,location,editorialSummary,websiteUri";

const normalisePlace = (place: GooglePlace) => ({
  place_id: place.id || null,
  name: place.displayName?.text || "Golf course",
  address: place.formattedAddress || "",
  description: place.editorialSummary?.text || "",
  latitude: place.location?.latitude ?? null,
  longitude: place.location?.longitude ?? null,
  website_url: place.websiteUri || null,
});

const rankCourses = (places: GooglePlace[], query: string) => {
  const needle = query.toLowerCase().trim();
  const words = needle.split(/\s+/).filter(Boolean);
  const score = (place: GooglePlace) => {
    const name = (place.displayName?.text || "").toLowerCase();
    const address = (place.formattedAddress || "").toLowerCase();
    let total = 0;
    if (name === needle) total += 100;
    if (name.startsWith(needle)) total += 70;
    else if (name.includes(needle)) total += 55;
    total += words.filter(word => name.includes(word)).length * 12;
    total += words.filter(word => address.includes(word)).length * 3;
    return total;
  };
  return [...places].sort((a, b) => score(b) - score(a));
};

const adminRequest = async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!authorization || !supabaseUrl || !anonKey || !serviceKey) return false;
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!authResponse.ok) return false;
  const user = await authResponse.json();
  if (!user?.id) return false;
  const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) return false;
  const profiles = await response.json();
  return profiles?.[0]?.is_admin === true;
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await adminRequest(request))) return json({ error: "Administrator access required." }, 403);

  const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleKey) return json({ error: "Course search has not been configured." }, 503);

  const body = await request.json().catch(() => ({}));
  const query = String(body.query || "").trim();
  const placeId = String(body.place_id || "").trim();

  try {
    if (placeId) {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": googleKey,
          "X-Goog-FieldMask": placeFields,
        },
      });
      if (!response.ok) {
        const googleError = await response.json().catch(() => null);
        return json({ error: googleError?.error?.message || `Google Places returned ${response.status} while loading that course.` }, 502);
      }
      const place = normalisePlace(await response.json());

      const youtubeKey = Deno.env.get("YOUTUBE_API_KEY");
      let videoUrl: string | null = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${place.name} golf course flyover`)}`;
      if (youtubeKey) {
        const search = new URL("https://www.googleapis.com/youtube/v3/search");
        search.searchParams.set("part", "snippet");
        search.searchParams.set("type", "video");
        search.searchParams.set("maxResults", "1");
        search.searchParams.set("q", `${place.name} golf course official course flyover`);
        search.searchParams.set("key", youtubeKey);
        const videoResponse = await fetch(search);
        if (videoResponse.ok) {
          const result = await videoResponse.json();
          const videoId = result?.items?.[0]?.id?.videoId;
          if (videoId) videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
      return json({ course: { ...place, video_url: videoUrl } });
    }

    if (query.length < 3) return json({ courses: [] });
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask": `places.${placeFields.replaceAll(",", ",places.")}`,
      },
      body: JSON.stringify({
        textQuery: `${query} golf course`,
        maxResultCount: 10,
        languageCode: "en",
        regionCode: "GB",
      }),
    });
    if (!response.ok) {
      const googleError = await response.json().catch(() => null);
      return json({ error: googleError?.error?.message || `Google Places returned ${response.status} while searching.` }, 502);
    }
    const result = await response.json();
    return json({ courses: rankCourses(result.places || [], query).slice(0, 5).map(normalisePlace) });
  } catch {
    return json({ error: "Course search is temporarily unavailable." }, 500);
  }
});

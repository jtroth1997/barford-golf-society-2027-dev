(() => {
  "use strict";
  const db = window.BarfordSupabase;
  if (!db) return;
  async function saveLayout({ eventId, clubName, layoutName, externalClubId = null, externalCourseId = null, men, women }) {
    if (!eventId || !clubName || !layoutName || men?.holes?.length !== 18 || women?.holes?.length !== 18) throw new Error("A club, exact course and complete men’s and women’s cards are required.");
    const found = await db.from("course_scorecards").select("id").ilike("course_name", clubName).ilike("course_layout", layoutName).maybeSingle();
    if (found.error) throw found.error;
    let scorecardId = found.data?.id;
    if (!scorecardId) {
      const created = await db.from("course_scorecards").insert({ course_name: clubName, course_layout: layoutName }).select("id").single();
      if (created.error) throw created.error;
      scorecardId = created.data.id;
    }
    for (const [category, card] of [["men", men], ["women", women]]) {
      const tee = await db.from("course_scorecard_tees").upsert({ scorecard_id: scorecardId, playing_category: category, tee_name: card.name || (category === "men" ? "Yellow" : "Red") }, { onConflict: "scorecard_id,playing_category" }).select("id").single();
      if (tee.error) throw tee.error;
      const removed = await db.from("course_scorecard_holes").delete().eq("tee_id", tee.data.id);
      if (removed.error) throw removed.error;
      const inserted = await db.from("course_scorecard_holes").insert(card.holes.map(h => ({ tee_id: tee.data.id, hole_number: h.hole ?? h.hole_number, par: h.par, yards: h.yards, stroke_index: h.stroke_index })));
      if (inserted.error) throw inserted.error;
    }
    const linked = await db.from("events").update({ course_scorecard_id: scorecardId, selected_course_name: layoutName, uk_golf_club_id: externalClubId || null, uk_golf_course_id: externalCourseId || null, scorecards_status: "course_verified", updated_at: new Date().toISOString() }).eq("id", eventId);
    if (linked.error) throw linked.error;
    return scorecardId;
  }
  window.BarfordCourseLayouts = { saveLayout };
})();

(() => {
  "use strict";
  const client = window.BarfordSupabase;
  if (!client || !document.getElementById("memberHomeDashboard")) return;

  const addButton = async () => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const { data: events } = await client.from("events")
      .select("id,name,venue,address,event_date,status")
      .gte("event_date", localToday)
      .eq("status", "scheduled")
      .order("event_date")
      .limit(1);
    const event = events?.[0];
    if (!event) return;
    const destination = [event.venue, event.address].filter(Boolean).join(", ");
    if (!destination) return;

    const confirmation = document.getElementById("dashboardPlayingConfirmation");
    const nextEventCard = document.querySelector(".dashboard-next-event");
    if (!confirmation || !nextEventCard || document.getElementById("dashboardHomeDirections")) return;

    const button = document.createElement("button");
    button.id = "dashboardHomeDirections";
    button.type = "button";
    button.className = "button button-primary dashboard-home-directions";
    button.innerHTML = '<span aria-hidden="true">↗</span> Directions to event';
    button.style.cssText = "width:100%;margin-top:12px;min-height:50px;font-weight:800;";
    confirmation.insertAdjacentElement("afterend", button);

    button.addEventListener("click", () => {
      const encoded = encodeURIComponent(destination);
      const dialog = document.getElementById("dashboardDirectionsDialog");
      const label = document.getElementById("dashboardDirectionsDestination");
      const apple = document.getElementById("dashboardAppleMaps");
      const google = document.getElementById("dashboardGoogleMaps");
      const waze = document.getElementById("dashboardWaze");
      if (label) label.textContent = destination;
      if (apple) apple.href = `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
      if (google) google.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      if (waze) waze.href = `https://waze.com/ul?q=${encoded}&navigate=yes`;
      dialog?.showModal();
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton, { once:true });
  else addButton();
})();

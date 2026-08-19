(() => {
  'use strict';
  const client = window.BarfordSupabase;
  const button = document.getElementById('dashboardEventDirections');
  if (!client || !button) return;

  let destination = '';
  const dialog = document.getElementById('dashboardDirectionsDialog');
  const setLink = (id, href) => { const el = document.getElementById(id); if (el) el.href = href; };

  const reveal = async () => {
    try {
      const { data: events, error } = await client.from('events')
        .select('id,name,event_date,venue,address,status')
        .neq('status','archived')
        .order('event_date',{ascending:true});
      if (error) return;
      const today = new Date(); today.setHours(0,0,0,0);
      const next = (events || []).find(e => new Date(`${e.event_date}T12:00:00`) >= today && e.status !== 'cancelled') || (events || [])[0];
      if (!next) return;
      destination = [next.venue, next.address].filter(Boolean).join(', ') || next.name;
      button.classList.remove('hidden');
      button.hidden = false;
      button.style.setProperty('display','inline-flex','important');
      const label = document.getElementById('dashboardDirectionsDestination');
      if (label) label.textContent = destination;
      const q = encodeURIComponent(destination);
      setLink('dashboardAppleMaps', `https://maps.apple.com/?daddr=${q}`);
      setLink('dashboardGoogleMaps', `https://www.google.com/maps/dir/?api=1&destination=${q}`);
      setLink('dashboardWaze', `https://waze.com/ul?q=${q}&navigate=yes`);
    } catch (_) {}
  };

  // Capture-phase handler so this remains independent of tee-time/dashboard state.
  button.addEventListener('click', e => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!destination) return;
    if (dialog?.showModal) dialog.showModal();
    else window.open(`https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`,'_blank');
  }, true);

  reveal();
  setTimeout(reveal, 500);
  setTimeout(reveal, 1500);
})();
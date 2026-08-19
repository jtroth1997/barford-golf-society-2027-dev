(() => {
  const button = document.getElementById('dashboardEventDirections');
  const detail = document.getElementById('dashboardEventDetail');
  if (!button || !detail) return;

  const style = document.createElement('style');
  style.textContent = '#dashboardEventDirections.dashboard-event-directions-primary{display:inline-flex!important}';
  document.head.appendChild(style);

  button.classList.remove('hidden');

  button.addEventListener('click', () => {
    const destination = String(detail.textContent || '').trim();
    if (!destination || destination.includes('will appear here')) return;
    const encoded = encodeURIComponent(destination.replace(/ · /g, ', '));
    const destinationText = document.getElementById('dashboardDirectionsDestination');
    const apple = document.getElementById('dashboardAppleMaps');
    const google = document.getElementById('dashboardGoogleMaps');
    const waze = document.getElementById('dashboardWaze');
    if (destinationText) destinationText.textContent = destination.replace(/ · /g, ', ');
    if (apple) apple.href = `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
    if (google) google.href = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    if (waze) waze.href = `https://waze.com/ul?q=${encoded}&navigate=yes`;
    document.getElementById('dashboardDirectionsDialog')?.showModal();
  });
})();
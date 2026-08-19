(() => {
  "use strict";

  const client = window.BarfordSupabase;
  const list = document.querySelector("#eventList");
  const summary = document.querySelector("#eventCalendarSummary");
  if (!list) return;

  const escapeHtml = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const friendlyDate = value => new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));
  const dateParts = value => { const date=new Date(`${value}T12:00:00`); return {month:new Intl.DateTimeFormat("en-GB",{month:"short"}).format(date).toUpperCase(),day:new Intl.DateTimeFormat("en-GB",{day:"2-digit"}).format(date),year:new Intl.DateTimeFormat("en-GB",{year:"numeric"}).format(date)}; };
  const friendlyTime = value => value ? String(value).slice(0,5) : "To be confirmed";
  const friendlyPrice = value => value == null || value === "" ? "Price TBC" : Number(value)===0 ? "Free" : `£${Number(value).toFixed(2)}`;
  const cancelMarker="[BARFORD_CANCEL_REASON] ";
  const cancellationReason=event=>event.cancel_reason||(()=>{const text=String(event.notes||"");const index=text.lastIndexOf(cancelMarker);return index>=0?text.slice(index+cancelMarker.length).trim():"";})();
  const courseDescription=notes=>{const text=String(notes||"");const index=text.lastIndexOf(cancelMarker);return(index>=0?text.slice(0,index):text).trim();};
  const videoEmbedUrl=value=>{try{const url=new URL(value);if(url.hostname.includes("youtu.be"))return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;if(url.hostname.includes("youtube.com")){const id=url.searchParams.get("v")||url.pathname.split("/").filter(Boolean).pop();return id?`https://www.youtube.com/embed/${id}`:value;}if(url.hostname.includes("vimeo.com")&&!url.hostname.includes("player.")){const id=url.pathname.split("/").filter(Boolean).pop();return id?`https://player.vimeo.com/video/${id}`:value;}return value;}catch{return value;}};
  const emptyState=(title,message)=>{list.innerHTML=`<article class="empty-state account-panel"><p class="eyebrow">No events yet</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></article>`;};

  const renderEvent=(event,memberState={})=>{
    const date=dateParts(event.event_date), cancelled=event.status==="cancelled", memberRsvp=memberState.rsvp;
    const address=event.address?`<span><b>Address</b>${escapeHtml(event.address)}</span>`:"";
    const description=courseDescription(event.notes), notes=description?`<p class="event-description">${escapeHtml(description)}</p>`:"";
    const video=event.course_video_url?`<button class="button button-outline" type="button" data-course-video="${escapeHtml(event.course_video_url)}" data-course-name="${escapeHtml(event.name)}">Course video</button>`:"";
    let participation;
    if(cancelled) participation=`<div class="event-member-state cancelled"><strong>Event cancelled</strong><small>No action needed.</small></div>`;
    else if(!memberState.signedIn) participation=`<div class="event-member-state"><strong>Want to play?</strong><small>Sign in, then tell us whether you’re playing.</small><a class="button button-primary" href="account.html">Sign in</a></div>`;
    else if(memberState.lockUnknown) participation=`<div class="event-member-state"><strong>RSVP temporarily unavailable</strong><small>We couldn’t confirm whether tee times are locked. Please try again in a moment.</small></div>`;
    else if(memberState.locked) participation=`<div class="event-member-state ${memberRsvp?.status==="playing"?"playing":""}"><strong>${memberRsvp?.status==="playing"?"✓ You’re playing":"RSVP closed"}</strong><small>Tee times are published.</small><span class="rsvp-contact-admin">Contact admin to make a change</span></div>`;
    else participation=`<div class="event-member-state ${memberRsvp?.status==="playing"?"playing":""}"><strong>${memberRsvp?.status==="playing"?"✓ You’re playing":memberRsvp?.status==="not_playing"||memberRsvp?.status==="cancelled"?"You’re not playing":"Are you playing?"}</strong><small>RSVP here for this event. You can change your answer until tee times are published.</small><div class="event-direct-rsvp-actions"><button class="button button-primary" type="button" data-event-rsvp="playing" data-event-id="${event.id}">${memberRsvp?.status==="playing"?"Keep me playing":"Yes, I’m playing"}</button><button class="button button-outline" type="button" data-event-rsvp="not_playing" data-event-id="${event.id}">No, I can’t play</button></div></div>`;
    return `<article class="compact-event-card ${cancelled?"event-cancelled-card":""}">${cancelled?`<div class="event-cancelled-banner">CANCELLED${cancellationReason(event)?`<small>${escapeHtml(cancellationReason(event))}</small>`:""}</div>`:""}<div class="event-date-block" aria-label="${escapeHtml(friendlyDate(event.event_date))}"><span>${date.month}</span><strong>${date.day}</strong><small>${date.year}</small></div><div class="event-main"><div class="event-title-row"><div class="event-heading-copy"><h3>${escapeHtml(event.name)}</h3><p class="event-venue">${escapeHtml(event.venue)}</p></div><span class="event-price">${friendlyPrice(event.price)}</span></div><div class="event-summary-row"><span><b>Date:</b> ${escapeHtml(friendlyDate(event.event_date))}</span><span><b>First tee:</b> ${escapeHtml(friendlyTime(event.first_tee_time))}</span><span><b>Places:</b> ${event.capacity?escapeHtml(event.capacity):"TBC"}</span></div>${notes}<div class="event-button-row">${video}<button class="button button-outline" type="button" data-event-details aria-expanded="false">More details</button></div><div class="event-more-details hidden"><div class="detail-grid"><span><b>Course</b>${escapeHtml(event.venue)}</span>${address}<span><b>Date</b>${escapeHtml(friendlyDate(event.event_date))}</span><span><b>First tee</b>${escapeHtml(friendlyTime(event.first_tee_time))}</span></div></div></div><aside class="event-rsvp-section">${participation}</aside></article>`;
  };

  const loadEvents=async()=>{
    if(!client){emptyState("Events could not be loaded","Please refresh the page and try again.");return;}
    const today=new Date(), localToday=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    let result=await client.from("events").select("id,name,venue,address,event_date,first_tee_time,price,capacity,course_video_url,notes,status,cancel_reason").in("status",["scheduled","cancelled"]).gte("event_date",localToday).order("event_date",{ascending:true});
    if(result.error&&/cancel_reason|column .* does not exist/i.test(result.error.message||""))result=await client.from("events").select("id,name,venue,address,event_date,first_tee_time,price,capacity,course_video_url,notes,status").in("status",["scheduled","cancelled"]).gte("event_date",localToday).order("event_date",{ascending:true});
    const {data,error}=result;if(error){emptyState("Events could not be loaded","Please refresh the page and try again.");return;}
    const events=data||[];if(!events.length){emptyState("The 2027 calendar is empty","Once an administrator publishes an event, members will be able to see it here.");if(summary)summary.textContent="The committee has not published any upcoming events yet.";return;}
    const {data:{session}}=await client.auth.getSession();let ownRsvps=[];const lockMap=new Map();
    if(session){
      const [{data:rsvps,error:rsvpError},locks]=await Promise.all([
        client.from("rsvps").select("event_id,status,buggy_requested,preferred_tee_time").eq("member_id",session.user.id).in("event_id",events.map(e=>e.id)),
        Promise.all(events.map(e=>client.rpc("get_event_rsvp_lock_status",{target_event_id:e.id})))
      ]);
      if(!rsvpError) ownRsvps=rsvps||[];
      events.forEach((e,i)=>lockMap.set(e.id,locks[i]?.error?null:Boolean(locks[i]?.data)));
    }
    const rsvpByEvent=new Map(ownRsvps.map(r=>[r.event_id,r]));
    list.innerHTML=events.map(e=>{const lock=lockMap.get(e.id);return renderEvent(e,{signedIn:Boolean(session),rsvp:rsvpByEvent.get(e.id),locked:lock===true,lockUnknown:Boolean(session)&&lock===null});}).join("");
    if(summary)summary.textContent=`${events.length} upcoming event${events.length===1?"":"s"} published.`;

    list.querySelectorAll("[data-event-rsvp]").forEach(button=>button.addEventListener("click",async()=>{
      if(!session){location.href="account.html";return;}
      const eventId=button.dataset.eventId,status=button.dataset.eventRsvp;
      const lockCheck=await client.rpc("get_event_rsvp_lock_status",{target_event_id:eventId});
      if(lockCheck.error){alert("We couldn’t confirm whether this RSVP is still open. Please try again.");return;}
      if(lockCheck.data){alert("Tee times have already been produced. Please contact an admin to make a change.");await loadEvents();return;}
      button.disabled=true;const old=button.textContent;button.textContent="Saving…";
      const existing=rsvpByEvent.get(eventId);
      const payload={event_id:eventId,member_id:session.user.id,status,updated_at:new Date().toISOString()};
      if(existing){
        if(existing.buggy_requested!==undefined&&existing.buggy_requested!==null)payload.buggy_requested=existing.buggy_requested;
        if(existing.preferred_tee_time)payload.preferred_tee_time=existing.preferred_tee_time;
      }
      const {error:saveError}=await client.from("rsvps").upsert(payload,{onConflict:"event_id,member_id"});
      if(saveError){button.disabled=false;button.textContent=old;alert(saveError.message?.includes("locked")?"Tee times have already been produced. Please contact an admin to make a change.":"We couldn’t save your RSVP. Please try again.");return;}
      await loadEvents();
    }));
    list.querySelectorAll("[data-event-details]").forEach(button=>button.addEventListener("click",()=>{const details=button.closest(".event-main")?.querySelector(".event-more-details");if(!details)return;const open=details.classList.contains("hidden");details.classList.toggle("hidden",!open);button.setAttribute("aria-expanded",String(open));button.textContent=open?"Hide details":"More details";}));
    const videoDialog=document.querySelector("#courseVideoDialog"),videoFrame=document.querySelector("#courseVideoFrame"),videoTitle=document.querySelector("#courseVideoTitle");const closeVideo=()=>{videoDialog?.close();if(videoFrame)videoFrame.src="";};
    list.querySelectorAll("[data-course-video]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.courseVideo.includes("youtube.com/results")){window.open(button.dataset.courseVideo,"_blank","noopener,noreferrer");return;}if(!videoDialog||!videoFrame)return;videoTitle.textContent=button.dataset.courseName||"Course video";videoFrame.src=videoEmbedUrl(button.dataset.courseVideo);videoDialog.showModal();}));document.querySelector("#courseVideoClose")?.addEventListener("click",closeVideo);document.querySelector("#courseVideoDone")?.addEventListener("click",closeVideo);
  };
  loadEvents();
})();

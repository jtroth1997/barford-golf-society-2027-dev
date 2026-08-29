(() => {
  "use strict";
  const client=window.BarfordSupabase,config=window.BARFORD_2027_CONFIG;
  const button=document.getElementById("dashboardEventCamera"),input=document.getElementById("dashboardEventCameraInput");
  if(!client||!config||!button||!input)return;
  button.setAttribute("aria-label","Take an event photo and add it to the gallery");
  button.removeAttribute("title");
  button.innerHTML='<span class="event-camera-icon" aria-hidden="true">📷</span><span class="event-camera-copy"><strong>Take an event photo</strong><small>Opens your camera · adds it to the event gallery</small></span><span class="event-camera-arrow" aria-hidden="true">›</span>';
  let activeEvent=null,session=null;
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const initialise=async()=>{
    ({data:{session}}=await client.auth.getSession());if(!session)return;
    const {data}=await client.from("events").select("id,name,event_date,status,test_mode_active,test_original_event_date").eq("event_date",today()).eq("status","scheduled").limit(1).maybeSingle();
    activeEvent=data||null;if(!activeEvent){button.classList.add("hidden");return;}
    const {data:rsvp}=await client.from("rsvps").select("status").eq("event_id",activeEvent.id).eq("member_id",session.user.id).maybeSingle();
    const playing=rsvp?.status==="playing";
    button.classList.toggle("hidden",!playing);
    if(playing){
      const action=document.getElementById("dashboardNextStepText");
      if(action&&!action.textContent.toLowerCase().includes("score"))action.textContent="Choose one person in your group to keep the score today.";
      document.getElementById("dashboardNextStep")?.classList.add("needs-action");
    }
  };
  button.addEventListener("click",()=>{if(activeEvent)input.click()});
  input.addEventListener("change",async()=>{
    const file=input.files?.[0];if(!file||!session||!activeEvent)return;
    button.classList.add("is-uploading");button.querySelector("strong").textContent="Uploading…";button.disabled=true;
    const extension=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await client.storage.from(config.galleryBucket).upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});
    if(!uploadError){
      const shownDate=activeEvent.test_mode_active&&activeEvent.test_original_event_date?activeEvent.test_original_event_date:activeEvent.event_date;
      const dateText=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${shownDate}T12:00:00`));
      const caption=`${activeEvent.test_mode_active?"TEST · ":""}${activeEvent.name} · ${dateText}`;
      const {error:recordError}=await client.from("gallery_photos").insert({event_id:activeEvent.id,storage_path:path,uploaded_by:session.user.id,approved:true,caption});
      if(!recordError){button.classList.remove("is-uploading");button.classList.add("is-done");button.querySelector("strong").textContent="Photo added to the gallery";button.querySelector(".event-camera-icon").textContent="✓";setTimeout(()=>{button.classList.remove("is-done");button.querySelector("strong").textContent="Take an event photo";button.querySelector(".event-camera-icon").textContent="📷";button.disabled=false;input.value=""},1800);return}
    }
    button.classList.remove("is-uploading");button.querySelector("strong").textContent="Try again";button.disabled=false;input.value="";
  });
  initialise();
})();

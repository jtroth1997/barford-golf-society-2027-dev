(() => {
  "use strict";
  const client=window.BarfordSupabase,config=window.BARFORD_2027_CONFIG;
  const button=document.getElementById("dashboardEventCamera"),input=document.getElementById("dashboardEventCameraInput");
  if(!client||!config||!button||!input)return;
  let activeEvent=null,session=null;
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const initialise=async()=>{
    ({data:{session}}=await client.auth.getSession());if(!session)return;
    const {data}=await client.from("events").select("id,name,event_date,status").eq("event_date",today()).eq("status","scheduled").limit(1).maybeSingle();
    activeEvent=data||null;button.classList.toggle("hidden",!activeEvent);if(!activeEvent)return;
    const {data:rsvp}=await client.from("rsvps").select("status").eq("event_id",activeEvent.id).eq("member_id",session.user.id).maybeSingle();
    if(rsvp?.status==="playing"){
      const action=document.getElementById("dashboardNextStepText");
      if(action)action.textContent="Choose one person in your group to keep the score today.";
      document.getElementById("dashboardNextStep")?.classList.add("needs-action");
    }
  };
  button.addEventListener("click",()=>{if(activeEvent)input.click()});
  input.addEventListener("change",async()=>{
    const file=input.files?.[0];if(!file||!session||!activeEvent)return;
    button.classList.add("is-uploading");button.querySelector("strong").textContent="Uploading…";button.disabled=true;
    const extension=(file.name.split(".").pop()||"jpg").toLowerCase(),path=`${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await client.storage.from(config.galleryBucket).upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});
    if(!uploadError){const {error:recordError}=await client.from("gallery_photos").insert({storage_path:path,uploaded_by:session.user.id,approved:true,caption:`${activeEvent.name} · ${new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${activeEvent.event_date}T12:00:00`))}`});if(!recordError){button.classList.remove("is-uploading");button.classList.add("is-done");button.querySelector("strong").textContent="Added";button.querySelector("span").textContent="✓";setTimeout(()=>{button.classList.remove("is-done");button.querySelector("strong").textContent="Photo";button.querySelector("span").textContent="📷";button.disabled=false;input.value=""},1800);return}}
    button.classList.remove("is-uploading");button.querySelector("strong").textContent="Try again";button.disabled=false;input.value="";
  });
  initialise();
})();

(() => {
  "use strict";

  const STORAGE_KEY = "bgs-2027-smart-tee-drafts-v1";
  const events = {
    "event-1": {
      name:"Season Opener", venue:"The Belfry – Derby Course",
      players:[
        ["p1","David Smith",16,false,"","First"],["p2","Steve Jones",22,true,"must","First"],
        ["p3","Mark Taylor",21,false,"","Middle"],["p4","Chris Brown",14,false,"",""],
        ["p5","Andy Green",19,true,"happy","End"],["p6","Paul Roberts",12,true,"must","Middle"],
        ["p7","Ben Harris",18,true,"must","Middle"],["p8","John Close",24,false,"","End"],
        ["p9","Richard Jones",11,false,"","First"],["p10","Tim Sewards",17,false,"",""],
        ["p11","Nick Benbow",15,true,"must","End"],["p12","Derek Lewis",23,true,"happy","End"],
        ["p13","Adam Betteridge",20,false,"","Middle"],["p14","Michael Evans",13,false,"",""],
        ["p15","Simon Clarke",25,false,"","First"],["p16","James Wilson",10,false,"","Middle"],
        ["p17","Lee Walker",18,false,"",""],["p18","Tom Harrison",27,false,"","End"]
      ]
    },
    "event-2": {
      name:"Captain's Day", venue:"Forest of Arden",
      players:[
        ["p19","Ben Harris",18,true,"must","First"],["p20","Paul Roberts",12,true,"must","First"],
        ["p21","John Close",24,false,"","First"],["p22","Richard Jones",11,false,"",""],
        ["p23","David Smith",16,false,"","Middle"],["p24","Steve Jones",22,true,"must","Middle"],
        ["p25","Mark Taylor",21,false,"","Middle"],["p26","Chris Brown",14,false,"",""],
        ["p27","Andy Green",19,true,"happy","End"],["p28","Tim Sewards",17,false,"","First"],
        ["p29","Nick Benbow",15,true,"must","End"],["p30","Derek Lewis",23,true,"happy","End"],
        ["p31","Adam Betteridge",20,false,"","Middle"],["p32","Michael Evans",13,false,"",""],
        ["p33","Simon Clarke",25,false,"","First"],["p34","James Wilson",10,false,"","Middle"],
        ["p35","Lee Walker",18,false,"",""],["p36","Tom Harrison",27,false,"","End"],
        ["p37","Matt Cooper",20,false,"","End"],["p38","Daniel King",9,false,"","First"],
        ["p39","Peter Hall",17,true,"must",""],["p40","Robert Moore",22,true,"must","Middle"],
        ["p41","Gary Turner",26,false,"","End"],["p42","Martin Hill",14,false,"",""]
      ]
    },
    "event-3": {
      name:"Summer Stableford", venue:"The Warwickshire",
      players:[
        ["p43","Tim Sewards",17,false,"","First"],["p44","Nick Benbow",15,true,"must","First"],
        ["p45","Derek Lewis",23,true,"happy","First"],["p46","Adam Betteridge",20,false,"",""],
        ["p47","David Smith",16,false,"","Middle"],["p48","Steve Jones",22,true,"must","Middle"],
        ["p49","Mark Taylor",21,false,"","Middle"],["p50","Chris Brown",14,false,"",""],
        ["p51","Ben Harris",18,true,"must","End"],["p52","Paul Roberts",12,true,"must","End"],
        ["p53","John Close",24,false,"","End"],["p54","Richard Jones",11,false,"",""]
      ]
    }
  };

  Object.values(events).forEach(event => {
    event.players = event.players.map(([id,name,handicap,buggy,flexibility,preference]) => ({id,name,handicap,buggy,flexibility,preference}));
  });

  const previousPairs = new Set([
    "David Smith|Mark Taylor","Chris Brown|Paul Roberts","Ben Harris|Richard Jones",
    "John Close|Tim Sewards","Adam Betteridge|Nick Benbow","James Wilson|Lee Walker",
    "Andy Green|Steve Jones","Derek Lewis|Tom Harrison"
  ].map(pair => pair.split("|").sort().join("|")));

  const select = document.querySelector("#teeEventSelect");
  const startInput = document.querySelector("#teeStartTime");
  const gapInput = document.querySelector("#teeGap");
  const groupsRoot = document.querySelector("#smartTeeGroups");
  const status = document.querySelector("#teeOrganiserStatus");
  const warnings = document.querySelector("#teeWarnings");
  const finalActions = document.querySelector("#teeFinalActions");
  let groups = [];

  const eventPlayers = () => events[select.value].players.map(player => ({...player}));

  const updateSummary = () => {
    const players = eventPlayers();
    document.querySelector("#teePlayerCount").textContent = players.length;
    document.querySelector("#teeBuggyCount").textContent = players.filter(p => p.buggy).length;
    document.querySelector("#teePreferenceCount").textContent = players.filter(p => p.preference).length;
    document.querySelector("#teeGroupCount").textContent = groups.length;
  };

  const balancedSizes = total => {
    const count = Math.ceil(total / 4);
    const base = Math.floor(total / count);
    const extra = total % count;
    return Array.from({length:count},(_,index) => base + (index < extra ? 1 : 0));
  };

  const pairKey = (a,b) => [a.name,b.name].sort().join("|");
  const desiredPosition = preference => preference === "First" ? 0 : preference === "End" ? 2 : 1;
  const groupPreference = group => group.players.length ? group.players.reduce((sum,p) => sum + desiredPosition(p.preference),0) / group.players.length : 1;

  const makeUnits = (players, notes) => {
    const pairBuggies = document.querySelector("#pairBuggies").checked;
    let buggy = players.filter(p => p.buggy);
    const walkers = players.filter(p => !p.buggy);

    if (pairBuggies && buggy.length % 2) {
      const flexible = buggy.find(p => p.flexibility === "happy");
      if (flexible) {
        flexible.buggy = false;
        buggy = buggy.filter(p => p.id !== flexible.id);
        walkers.push(flexible);
        notes.push(`${flexible.name} was moved to walking because the buggy list was odd and they are happy to walk.`);
      }
    }

    const units = [];
    if (pairBuggies) {
      while (buggy.length >= 2) units.push({players:buggy.splice(0,2),buggyPair:true});
      if (buggy.length) {
        units.push({players:[buggy[0]],buggyPair:false});
        notes.push(`${buggy[0].name} still needs a buggy partner.`);
      }
    } else {
      buggy.forEach(player => units.push({players:[player],buggyPair:false}));
    }
    walkers.forEach(player => units.push({players:[player],buggyPair:false}));
    return units.sort((a,b) => b.players.length - a.players.length || Math.random() - .5);
  };

  const assignmentCost = (unit,group,index,totalGroups) => {
    let cost = 0;
    const respect = document.querySelector("#respectPreferences").checked;
    const avoid = document.querySelector("#avoidRepeats").checked;
    const position = totalGroups <= 1 ? 1 : (index / (totalGroups - 1)) * 2;
    if (respect) unit.players.forEach(player => { if (player.preference) cost += Math.abs(desiredPosition(player.preference) - position) * 7; });
    if (avoid) unit.players.forEach(player => group.players.forEach(existing => { if (previousPairs.has(pairKey(player,existing))) cost += 18; }));
    const projected = [...group.players,...unit.players];
    const average = projected.reduce((sum,p) => sum + p.handicap,0) / projected.length;
    cost += Math.abs(18 - average) * .15;
    return cost + Math.random() * .8;
  };

  const generate = () => {
    const notes = [];
    const players = eventPlayers();
    const sizes = balancedSizes(players.length);
    groups = sizes.map(size => ({capacity:size,players:[]}));
    const units = makeUnits(players,notes);

    units.forEach(unit => {
      const candidates = groups.map((group,index) => ({group,index,space:group.capacity-group.players.length}))
        .filter(item => item.space >= unit.players.length)
        .sort((a,b) => assignmentCost(unit,a.group,a.index,groups.length) - assignmentCost(unit,b.group,b.index,groups.length));
      const target = candidates[0] || groups.find(group => group.players.length < group.capacity);
      if (target?.group) target.group.players.push(...unit.players);
      else if (target) target.players.push(...unit.players);
    });

    if (document.querySelector("#respectPreferences").checked) groups.sort((a,b) => groupPreference(a) - groupPreference(b));
    groups.forEach((group,index) => { group.number=index+1; });
    render(notes);
    status.textContent = "Smart tee times generated. You can move or remove players before saving.";
  };

  const addMinutes = (value,minutes) => {
    const [hour,minute] = value.split(":").map(Number);
    const date = new Date(2000,0,1,hour,minute + minutes);
    return date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false});
  };

  const timeFor = index => addMinutes(startInput.value || "09:00", Number(gapInput.value || 8) * index);

  const render = (notes=[]) => {
    updateSummary();
    warnings.classList.toggle("hidden", !notes.length);
    warnings.innerHTML = notes.length ? `<strong>Check these:</strong><br>${notes.map(note => `• ${note}`).join("<br>")}` : "";
    if (!groups.length) {
      groupsRoot.innerHTML = '<div class="empty-state">No groups generated yet.</div>';
      finalActions.classList.add("hidden");
      return;
    }

    groupsRoot.innerHTML = groups.map((group,index) => {
      const buggy = group.players.filter(player => player.buggy);
      const pairLines = [];
      for (let i=0;i<buggy.length;i+=2) pairLines.push(buggy[i+1] ? `🛺 ${buggy[i].name} + ${buggy[i+1].name}` : `⚠️ ${buggy[i].name} needs a partner`);
      const average = group.players.length ? Math.round(group.players.reduce((sum,p) => sum + p.handicap,0) / group.players.length) : 0;
      return `<article class="smart-tee-group" data-group="${index}">
        <div class="tee-group-heading"><div><span>Group ${index+1}</span><strong>${timeFor(index)}</strong></div><span>${group.players.length}-ball · Avg HCP ${average}</span></div>
        <div class="tee-group-players">${group.players.map(player => `
          <div class="tee-player">
            <span class="tee-player-icon" aria-hidden="true">${player.buggy ? "🛺" : "🚶"}</span>
            <div class="tee-player-info"><strong>${player.name}</strong><small>HCP ${player.handicap}${player.preference ? ` · ${player.preference} preference` : ""}${player.flexibility==="happy" ? " · Happy to walk" : ""}</small></div>
            <div class="tee-player-actions">
              <select class="move-player" data-player="${player.id}" aria-label="Move ${player.name} to another group">
                ${groups.map((_,groupIndex) => `<option value="${groupIndex}" ${groupIndex===index?"selected":""}>Group ${groupIndex+1}</option>`).join("")}
              </select>
              <button class="tee-remove" type="button" data-player="${player.id}" title="Remove dropout" aria-label="Remove ${player.name}">×</button>
            </div>
          </div>`).join("")}</div>
        ${pairLines.length ? `<div class="buggy-pair">${pairLines.join("<br>")}</div>` : ""}
        <div class="tee-group-note">Preference mix: ${group.players.map(p => p.preference || "None").join(", ")}</div>
      </article>`;
    }).join("");
    finalActions.classList.remove("hidden");
    bindGroupActions();
  };

  const bindGroupActions = () => {
    document.querySelectorAll(".move-player").forEach(control => control.addEventListener("change", () => {
      const from = groups.find(group => group.players.some(player => player.id === control.dataset.player));
      const player = from?.players.find(item => item.id === control.dataset.player);
      const targetIndex = Number(control.value);
      if (!from || !player || groups[targetIndex].players.length >= 4) {
        status.textContent = "That group is already full.";
        render();
        return;
      }
      from.players = from.players.filter(item => item.id !== player.id);
      groups[targetIndex].players.push(player);
      groups = groups.filter(group => group.players.length);
      groups.forEach((group,index) => group.number=index+1);
      render(["Manual move applied. Check preferences and buggy pairings before saving."]);
    }));

    document.querySelectorAll(".tee-remove").forEach(button => button.addEventListener("click", () => {
      const sourceIndex = groups.findIndex(group => group.players.some(player => player.id === button.dataset.player));
      if (sourceIndex < 0) return;
      const player = groups[sourceIndex].players.find(item => item.id === button.dataset.player);
      if (!confirm(`Remove ${player.name} and repair the groups?`)) return;
      groups[sourceIndex].players = groups[sourceIndex].players.filter(item => item.id !== player.id);
      const source = groups[sourceIndex];
      if (source.players.length < 3) {
        const donorIndex = groups.findIndex((group,index) => index !== sourceIndex && group.players.length > 3);
        if (donorIndex >= 0) {
          const donor = groups[donorIndex];
          const candidate = donor.players.sort((a,b) => assignmentCost({players:[a]},source,sourceIndex,groups.length) - assignmentCost({players:[b]},source,sourceIndex,groups.length))[0];
          donor.players = donor.players.filter(item => item.id !== candidate.id);
          source.players.push(candidate);
        }
      }
      groups = groups.filter(group => group.players.length);
      groups.forEach((group,index) => group.number=index+1);
      render([`${player.name} removed. Only the minimum necessary group repair was applied.`]);
      status.textContent = "Dropout removed without regenerating every tee time.";
    }));
  };

  const readDrafts = () => { try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch{return {};} };
  const saveDraft = () => {
    const drafts = readDrafts();
    drafts[select.value] = {groups,start:startInput.value,gap:gapInput.value,savedAt:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(drafts));
    status.textContent = "Draft tee times saved on this device.";
  };
  const loadDraft = () => {
    const draft = readDrafts()[select.value];
    if (!draft) { status.textContent = "No saved draft exists for this event."; return; }
    groups = draft.groups;
    startInput.value = draft.start;
    gapInput.value = draft.gap;
    render(["Loaded saved draft."]);
    status.textContent = "Saved draft loaded.";
  };

  const copyMessage = async () => {
    const event = events[select.value];
    const message = [`⛳ ${event.name} — ${event.venue}`,"",...groups.map((group,index) => `Group ${index+1} — ${timeFor(index)}\n${group.players.map(player => `${player.buggy?"🛺":"•"} ${player.name}`).join("\n")}`)].join("\n\n");
    try { await navigator.clipboard.writeText(message); status.textContent = "WhatsApp-ready tee times copied."; }
    catch { status.textContent = "Copy was blocked by this browser. Please try again."; }
  };

  document.querySelector("#generateSmartTeeTimes")?.addEventListener("click",generate);
  document.querySelector("#regenerateTeeTimes")?.addEventListener("click",generate);
  document.querySelector("#saveTeeDraft")?.addEventListener("click",saveDraft);
  document.querySelector("#loadSavedTeeTimes")?.addEventListener("click",loadDraft);
  document.querySelector("#copyTeeMessage")?.addEventListener("click",copyMessage);
  document.querySelector("#clearTeeDraft")?.addEventListener("click",() => {
    const drafts=readDrafts(); delete drafts[select.value]; localStorage.setItem(STORAGE_KEY,JSON.stringify(drafts));
    groups=[]; render(); status.textContent="Saved draft cleared.";
  });
  select?.addEventListener("change",() => { groups=[]; render(); updateSummary(); status.textContent=""; });
  startInput?.addEventListener("change",() => groups.length && render());
  gapInput?.addEventListener("change",() => groups.length && render());

  updateSummary();
})();
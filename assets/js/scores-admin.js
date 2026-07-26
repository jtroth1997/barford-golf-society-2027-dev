import { calculateRoundAverage, calculateHandicapResult } from "./handicap-engine.js";

export class AdminDashboard {
  constructor({ dataService, onChanged }) {
    this.dataService = dataService;
    this.onChanged = onChanged;
    this.dialog = document.querySelector("#adminDialog");
    this.confirmDialog = document.querySelector("#confirmDialog");
    this.pendingConfirm = null;
    this.bind();
  }

  async open() { await this.render(); this.dialog.showModal(); }
  close() { this.dialog.close(); }

  bind() {
    document.querySelector("#closeAdmin").addEventListener("click", () => this.close());
    document.querySelector("#adminNav").addEventListener("click", event => {
      const button = event.target.closest("[data-admin-panel]");
      if (button) this.showPanel(button.dataset.adminPanel, button.textContent);
    });
    document.querySelector("#scoreRoundSelect").addEventListener("change", () => this.renderScoreEntries());
    document.querySelector("#calculateRoundButton").addEventListener("click", () => this.calculateAndSave());
    document.querySelector("#addPlayerForm").addEventListener("submit", event => this.addPlayer(event));
    document.querySelector("#createRoundForm").addEventListener("submit", event => this.createRound(event));
    document.querySelector("#overrideHandicapButton").addEventListener("click", () => this.overrideHandicap());
    document.querySelector("#generateNextRoundButton").addEventListener("click", () => this.generateNextRound());
    document.querySelector("#trophyForm").addEventListener("submit", event => this.addAchievement(event));
    document.querySelector("#exportCsvButton").addEventListener("click", () => this.exportCsv());
    document.querySelector("#importCsvInput").addEventListener("change", event => this.importCsv(event));
    document.querySelector("#resetSeasonButton").addEventListener("click", () => this.confirm("Reset development season?", "This restores the demonstration data.", async () => {
      await this.dataService.reset(); await this.render(); await this.onChanged();
    }));
    this.confirmDialog.addEventListener("close", async () => {
      if (this.confirmDialog.returnValue === "confirm" && this.pendingConfirm) await this.pendingConfirm();
      this.pendingConfirm = null;
    });
  }

  showPanel(name, title) {
    document.querySelectorAll(".admin-nav-button").forEach(b => b.classList.toggle("is-active", b.dataset.adminPanel === name));
    document.querySelectorAll(".admin-panel").forEach(p => { const active=p.id===`admin-${name}`; p.hidden=!active; p.classList.toggle("is-active",active); });
    document.querySelector("#adminPanelTitle").textContent = title.trim();
  }

  async render() {
    this.data = await this.dataService.getSnapshot();
    const playerOptions = this.data.players.map(p => `<option value="${p.id}">${this.escape(p.name)}</option>`).join("");
    const roundOptions = this.data.rounds.map(r => `<option value="${r.id}">${this.escape(r.name)}</option>`).join("");
    ["overridePlayer","trophyPlayer"].forEach(id => document.querySelector(`#${id}`).innerHTML = playerOptions);
    ["scoreRoundSelect","trophyRound"].forEach(id => document.querySelector(`#${id}`).innerHTML = roundOptions);
    this.renderScoreEntries(); this.renderPlayers(); this.renderRounds(); this.renderAchievements();
  }

  renderScoreEntries() {
    const roundId=document.querySelector("#scoreRoundSelect").value;
    const round=this.data.rounds.find(r=>r.id===roundId);
    const list=document.querySelector("#scoreEntryList"); list.innerHTML="";

    this.data.players.forEach(player=>{
      const saved=round?.results.find(r=>r.playerId===player.id);
      const handicapForRound = saved?.handicapUsed ?? this.getHandicapForRound(player.id, roundId);

      const row=document.createElement("div"); row.className="score-entry-row";
      row.innerHTML=`<div class="score-player">
          <strong>${this.escape(player.name)}</strong>
          <span>Playing handicap for this round: <b>${handicapForRound}</b></span>
        </div>
        <label class="field"><span>Handicap played</span><input data-hcp="${player.id}" type="number" min="0" step="1" value="${handicapForRound}"></label>
        <label class="field"><span>Round score</span><input data-points="${player.id}" type="number" min="0" step="1" value="${saved?.dnp ? 0 : saved?.points ?? ""}" placeholder="0 = DNP"></label>
        <div class="calculated-result" data-result="${player.id}" aria-live="polite">
          ${saved ? this.resultMarkup(saved.adjustment, saved.nextHandicap, saved.dnp) : '<span>Press calculate to see next handicap</span>'}
        </div>`;
      list.append(row);
    });
  }

  getHandicapForRound(playerId, roundId) {
    const rounds = [...this.data.rounds].sort((a, b) => a.number - b.number);
    const selectedIndex = rounds.findIndex(round => round.id === roundId);
    const player = this.data.players.find(item => item.id === playerId);

    if (!player) return 0;

    // Work backwards from the selected round and use the latest calculated
    // next-round handicap. This is the handicap the player should play from.
    for (let index = selectedIndex - 1; index >= 0; index -= 1) {
      const previousResult = rounds[index].results.find(
        result => result.playerId === playerId
      );

      if (previousResult && Number.isFinite(previousResult.nextHandicap)) {
        return previousResult.nextHandicap;
      }
    }

    return player.startingHandicap ?? player.currentHandicap ?? 0;
  }

  async calculateAndSave() {
    try {
      const roundId=document.querySelector("#scoreRoundSelect").value;
      const entries=this.data.players.map(player=>({
        playerId:player.id,
        handicap:Number(document.querySelector(`[data-hcp="${player.id}"]`).value),
        points:Number(document.querySelector(`[data-points="${player.id}"]`).value)
      }));
      const playable=entries.map(e=>e.points).filter(p=>Number.isFinite(p)&&p>0);
      const average=calculateRoundAverage(playable);
      const results=entries.map(entry=>{
        const result=calculateHandicapResult({handicap:entry.handicap,points:entry.points,average});
        const calculated = {
          playerId:entry.playerId,
          handicapUsed:entry.handicap,
          points:result.countedScore,
          adjustment:result.adjustment,
          nextHandicap:result.nextHandicap,
          dnp:result.dnp
        };

        const output = document.querySelector(`[data-result="${entry.playerId}"]`);
        if (output) {
          output.innerHTML = this.resultMarkup(
            calculated.adjustment,
            calculated.nextHandicap,
            calculated.dnp
          );
          output.classList.add("is-calculated");
        }

        return calculated;
      });
      await this.dataService.saveRoundResults(roundId,results);

      const orderedRounds = [...this.data.rounds].sort((a, b) => a.number - b.number);
      const currentIndex = orderedRounds.findIndex(round => round.id === roundId);
      const nextRound = orderedRounds[currentIndex + 1];

      await this.render();

      if (nextRound) {
        document.querySelector("#scoreRoundSelect").value = nextRound.id;
        this.renderScoreEntries();
      }

      await this.onChanged();
      alert(
        nextRound
          ? `Round saved. Calculated average: ${average}. The next round is ready with the new handicaps.`
          : `Round saved. Calculated average: ${average}.`
      );
    } catch(error) { alert(error.message); }
  }

  resultMarkup(adjustment, nextHandicap, dnp) {
    const adjustmentText = dnp ? "DNP" : adjustment > 0 ? `+${adjustment}` : `${adjustment}`;
    const adjustmentClass = dnp || adjustment === 0 ? "same" : adjustment > 0 ? "up" : "down";

    return `<span>Adjustment <strong class="change ${adjustmentClass}">${adjustmentText}</strong></span>
      <span>Next-round handicap <strong class="next-admin-handicap">${nextHandicap}</strong></span>`;
  }

  renderPlayers() {
    const list=document.querySelector("#adminPlayerList"); list.innerHTML="";
    this.data.players.forEach(player=>{
      const row=document.createElement("article");row.className="admin-list-item";
      row.innerHTML=`<div><h4>${this.escape(player.name)}</h4><span>Current handicap ${player.currentHandicap}</span></div><button class="small-button danger" type="button">Remove</button>`;
      row.querySelector("button").addEventListener("click",()=>this.confirm(`Remove ${player.name}?`,"Their scores and achievements will also be removed.",async()=>{
        await this.dataService.removePlayer(player.id);await this.render();await this.onChanged();
      }));
      list.append(row);
    });
  }

  async addPlayer(event) {
    event.preventDefault();
    try {
      await this.dataService.addPlayer({name:document.querySelector("#newPlayerName").value,startingHandicap:Number(document.querySelector("#newPlayerHandicap").value)});
      event.target.reset(); await this.render(); await this.onChanged();
    } catch(error){alert(error.message)}
  }

  renderRounds() {
    const list=document.querySelector("#adminRoundList"); list.innerHTML="";
    this.data.rounds.forEach(round=>{
      const row=document.createElement("article");row.className="admin-list-item";
      row.innerHTML=`<div><h4>${this.escape(round.name)}</h4><span>${round.date||"No date"} · ${round.results.length} results</span></div>`;
      list.append(row);
    });
  }

  async createRound(event) {
    event.preventDefault();
    await this.dataService.createRound({name:document.querySelector("#newRoundName").value,date:document.querySelector("#newRoundDate").value});
    event.target.reset(); await this.render(); await this.onChanged();
  }

  async overrideHandicap() {
    const playerId=document.querySelector("#overridePlayer").value;
    const value=Number(document.querySelector("#overrideHandicap").value);
    if(!Number.isFinite(value)||value<0)return alert("Enter a valid handicap");
    await this.dataService.updatePlayer(playerId,{currentHandicap:value});
    await this.render();await this.onChanged();
  }

  async generateNextRound() {
    const last=[...this.data.rounds].sort((a,b)=>b.number-a.number)[0];
    if(!last)return alert("Create a round first");
    for(const player of this.data.players){
      const result=last.results.find(r=>r.playerId===player.id);
      if(result) await this.dataService.updatePlayer(player.id,{currentHandicap:result.nextHandicap});
    }
    await this.render();await this.onChanged();alert("Next-round handicaps generated");
  }

  renderAchievements() {
    const list=document.querySelector("#achievementList");list.innerHTML="";
    const labels={win:"Round win",runnerUp:"Runner-up",third:"Third place",nearestPin:"Nearest the Pin",longestDrive:"Longest Drive"};
    this.data.achievements.forEach(item=>{
      const player=this.data.players.find(p=>p.id===item.playerId),round=this.data.rounds.find(r=>r.id===item.roundId);
      const row=document.createElement("article");row.className="admin-list-item";
      row.innerHTML=`<div><h4>${this.escape(labels[item.type])}</h4><span>${this.escape(player?.name||"Unknown")} · ${this.escape(round?.name||"Unknown")}</span></div><button class="small-button danger">Remove</button>`;
      row.querySelector("button").addEventListener("click",async()=>{await this.dataService.removeAchievement(item.id);await this.render();await this.onChanged()});
      list.append(row);
    });
  }

  async addAchievement(event) {
    event.preventDefault();
    await this.dataService.addAchievement({roundId:document.querySelector("#trophyRound").value,playerId:document.querySelector("#trophyPlayer").value,type:document.querySelector("#trophyType").value});
    await this.render();await this.onChanged();
  }

  exportCsv() {
    const rows=[["Player","Round","Date","Handicap Used","Points","Adjustment","Next Handicap","DNP"]];
    this.data.rounds.forEach(round=>round.results.forEach(result=>{
      const player=this.data.players.find(p=>p.id===result.playerId);
      rows.push([player?.name||"",round.name,round.date||"",result.handicapUsed,result.points??"",result.adjustment??"",result.nextHandicap,result.dnp?"Yes":"No"]);
    }));
    const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`barford-scores-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  async importCsv(event) {
    const file=event.target.files[0];if(!file)return;
    try{
      const lines=(await file.text()).split(/\r?\n/).filter(Boolean);
      const rows=lines.slice(1).map(line=>this.parseCsvLine(line));
      const snapshot=await this.dataService.getSnapshot();
      for(const row of rows){
        const [playerName,roundName,date,hcp,points,adj,next,dnp]=row;
        let player=snapshot.players.find(p=>p.name.toLowerCase()===playerName.toLowerCase());
        if(!player){player={id:crypto.randomUUID(),name:playerName,startingHandicap:Number(hcp),currentHandicap:Number(next||hcp)};snapshot.players.push(player)}
        let round=snapshot.rounds.find(r=>r.name.toLowerCase()===roundName.toLowerCase());
        if(!round){round={id:crypto.randomUUID(),number:snapshot.rounds.length+1,name:roundName,date,results:[]};snapshot.rounds.push(round)}
        const result={playerId:player.id,handicapUsed:Number(hcp),points:points===""?null:Number(points),adjustment:adj===""?null:Number(adj),nextHandicap:Number(next),dnp:dnp.toLowerCase()==="yes"};
        round.results=round.results.filter(r=>r.playerId!==player.id);round.results.push(result);
      }
      await this.dataService.saveSnapshot(snapshot);await this.render();await this.onChanged();alert("CSV imported");
    }catch(error){alert(`Import failed: ${error.message}`)}
    event.target.value="";
  }

  parseCsvLine(line) {
    const values=[];let current="",quoted=false;
    for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){current+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===","&&!quoted){values.push(current);current=""}else current+=c}
    values.push(current);return values;
  }

  confirm(title,message,action) {
    document.querySelector("#confirmTitle").textContent=title;
    document.querySelector("#confirmMessage").textContent=message;
    this.pendingConfirm=action;this.confirmDialog.showModal();
  }

  escape(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
}

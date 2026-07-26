import { ScoresData } from "./scores-data.js";
import { rankPlayers, calculatePlayerStatistics } from "./handicap-engine.js";
import { AdminDashboard } from "./scores-admin.js";

const state = {
  data: null,
  activeView: "leaderboard",
  selectedRoundId: null,
  selectedLeaderboardRoundId: null,
  selectedPlayerId: null,
  search: ""
};
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const formatChange = value => value == null ? "DNP" : value > 0 ? `+${value}` : `${value}`;
const latestResult = (playerId) => [...state.data.rounds].reverse().map(r => r.results.find(x => x.playerId === playerId)).find(Boolean);

async function refresh() {
  state.data = await ScoresData.getSnapshot();
  state.selectedRoundId ||= state.data.rounds[0]?.id;
  state.selectedPlayerId ||= state.data.players[0]?.id;

  const completedRounds = getCompletedRounds();
  if (
    !state.selectedLeaderboardRoundId ||
    !completedRounds.some(round => round.id === state.selectedLeaderboardRoundId)
  ) {
    state.selectedLeaderboardRoundId = completedRounds.at(-1)?.id ?? null;
  }

  renderAll();
}

function renderAll() {
  renderLeaderboardRoundTabs();
  renderLeaderboard();
  renderRoundTabs();
  renderRound();
  renderPlayerSelects();
  if (state.activeView === "handicaps") renderHandicapHistory();
  if (state.activeView === "statistics") renderStatistics();
}

function getCompletedRounds() {
  return [...state.data.rounds]
    .filter(round => round.results.some(result => result && (result.dnp || Number.isFinite(result.points))))
    .sort((a, b) => a.number - b.number);
}

function getLeaderboardRounds() {
  const completed = getCompletedRounds();
  const selectedIndex = completed.findIndex(round => round.id === state.selectedLeaderboardRoundId);
  return selectedIndex >= 0 ? completed.slice(0, selectedIndex + 1) : completed;
}

function renderLeaderboardRoundTabs() {
  const tabs = $("#leaderboardRoundTabs");
  tabs.innerHTML = "";
  const rounds = getCompletedRounds();

  rounds.forEach(round => {
    const button = document.createElement("button");
    button.className = "leaderboard-round-tab";
    button.type = "button";
    button.role = "tab";
    button.textContent = `After ${round.name}`;
    button.setAttribute("aria-selected", String(round.id === state.selectedLeaderboardRoundId));
    button.addEventListener("click", () => {
      state.selectedLeaderboardRoundId = round.id;
      renderLeaderboardRoundTabs();
      renderLeaderboard();
    });
    tabs.append(button);
  });
}

function renderLeaderboard() {
  const list = $("#leaderboardList");
  list.innerHTML = "";

  const selectedRound = state.data.rounds.find(
    round => round.id === state.selectedLeaderboardRoundId
  );
  const roundsForStandings = getLeaderboardRounds();
  const roundLabel = selectedRound ? `after ${selectedRound.name}` : "before the season starts";

  $("#leaderboardHeading").textContent = selectedRound
    ? `Leaderboard after ${selectedRound.name}`
    : "Leaderboard";

  $("#leaderboardContext").innerHTML = selectedRound
    ? `<strong>${escapeHtml(selectedRound.name)} standings</strong><span>Season totals include completed rounds up to and including this round.</span>`
    : `<strong>No completed rounds yet</strong><span>The leaderboard will appear after scores are calculated and saved.</span>`;

  const ranked = rankPlayers(state.data.players, roundsForStandings, state.data.achievements)
    .filter(player => player.name.toLowerCase().includes(state.search));

  ranked.forEach(player => {
    const node = $("#leaderboardCardTemplate").content.cloneNode(true);
    const card = node.querySelector(".player-card");
    const summary = node.querySelector(".player-card-summary");
    const detail = node.querySelector(".player-details");
    const selectedResult = selectedRound?.results.find(result => result.playerId === player.id);
    const medal = ["🥇","🥈","🥉"][player.position - 1];

    node.querySelector(".rank-badge").textContent = medal || player.position;
    if (medal) node.querySelector(".rank-badge").classList.add("medal");
    node.querySelector(".player-name").textContent = player.name;

    const meta = node.querySelector(".player-meta");
    meta.innerHTML = selectedResult
      ? `<span class="leaderboard-round-line"><span>Played off</span><strong>${selectedResult.handicapUsed}</strong></span>
         <span class="leaderboard-round-line"><span>Score</span><strong>${selectedResult.dnp ? "DNP" : selectedResult.points}</strong></span>
         <span class="leaderboard-round-line"><span>Adjustment</span><strong class="change ${changeClass(selectedResult.adjustment)}">${formatChange(selectedResult.adjustment)}</strong></span>
         <span class="leaderboard-round-line"><span>Next HCP</span><strong>${selectedResult.nextHandicap}</strong></span>`
      : `<span class="leaderboard-round-line leaderboard-empty"><span>No result recorded</span><strong>${escapeHtml(selectedRound?.name ?? "This round")}</strong></span>`;

    node.querySelector(".player-points").textContent = player.statistics.seasonPoints;

    summary.setAttribute(
      "aria-label",
      `${player.name}, position ${player.position}, ${player.statistics.seasonPoints} points, ${roundLabel}`
    );

    summary.addEventListener("click", () => {
      const open = card.classList.toggle("is-open");
      summary.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
      if (open && !detail.dataset.rendered) {
        detail.innerHTML = playerDetailsMarkup(player, roundsForStandings);
        detail.dataset.rendered = "true";
      }
    });
    list.append(node);
  });

  $("#statusMessage").textContent = ranked.length ? "" : "No players match that search.";
}

function playerDetailsMarkup(player, roundsForStandings = state.data.rounds) {
  const s = player.statistics;
  const history = roundsForStandings.map(round => {
    const result = round.results.find(item => item.playerId === player.id);
    return { round, result };
  }).filter(item => item.result);
  let running = 0;
  return `
    <div class="detail-stats">
      ${statTile("Current handicap", s.currentHandicap)}
      ${statTile("Average score", s.average == null ? "—" : s.average.toFixed(1))}
      ${statTile("Best round", s.best ?? "—")}
      ${statTile("Season points", s.seasonPoints)}
    </div>
    <div class="history-list">
      ${history.map(({round,result}) => {
        if (Number.isFinite(result.points)) running += result.points;
        const seasonAtPoint = history
          .slice(0, history.findIndex(x => x.round.id === round.id) + 1)
          .map(x => x.result.points).filter(Number.isFinite).sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0);
        return `<article class="history-card">
          <div>
            <h4>${escapeHtml(round.name)}</h4>
            <p>Handicap used: <strong>${result.handicapUsed}</strong></p>
            <p>${result.dnp ? "Did not play" : `Stableford score: <strong>${result.points}</strong>`}</p>
          </div>
          <div class="history-values">
            <span class="history-label">Adjustment</span>
            <strong class="change ${changeClass(result.adjustment)}">${formatChange(result.adjustment)}</strong>
          </div>
          <div>
            <span class="history-label">Next-round handicap</span>
            <strong class="next-handicap-value">${result.nextHandicap}</strong>
          </div>
          <div class="history-values">
            <span class="history-label">Running season total</span>
            <strong>${seasonAtPoint}</strong>
          </div>
        </article>`;
      }).join("") || "<p>No rounds recorded.</p>"}
    </div>`;
}

function statTile(label,value){ return `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`; }
function changeClass(value){ return value == null || value === 0 ? "same" : value > 0 ? "up" : "down"; }

function renderRoundTabs() {
  const tabs = $("#roundTabs"); tabs.innerHTML = "";
  state.data.rounds.forEach(round => {
    const button = document.createElement("button");
    button.className = "round-tab";
    button.type = "button";
    button.role = "tab";
    button.textContent = round.name;
    button.setAttribute("aria-selected", String(round.id === state.selectedRoundId));
    button.addEventListener("click", () => { state.selectedRoundId = round.id; renderRoundTabs(); renderRound(); });
    tabs.append(button);
  });
}

function renderRound() {
  const round = state.data.rounds.find(r => r.id === state.selectedRoundId);
  const list = $("#roundList"); list.innerHTML = "";
  if (!round) { $("#roundSummary").innerHTML = "<strong>No rounds created</strong>"; return; }
  const played = round.results.filter(result => Number.isFinite(result.points));
  const winner = [...played].sort((a,b)=>b.points-a.points)[0];
  const winnerName = state.data.players.find(p => p.id === winner?.playerId)?.name ?? "Not recorded";
  $("#roundSummary").innerHTML = `<strong>${escapeHtml(round.name)}</strong><br>${round.date || "Date not set"} · Winner: ${escapeHtml(winnerName)}`;

  [...round.results].sort((a,b)=>(b.points ?? -1)-(a.points ?? -1)).forEach(result => {
    const player = state.data.players.find(p => p.id === result.playerId);
    if (!player || !player.name.toLowerCase().includes(state.search)) return;
    const row = document.createElement("article"); row.className = "round-row";
    row.innerHTML = `<div><h4>${escapeHtml(player.name)}</h4><div class="metric-line">
      <span>HCP <strong>${result.handicapUsed}</strong></span><span>Points <strong>${result.dnp ? "DNP" : result.points}</strong></span>
      <span>Adjustment <strong class="change ${changeClass(result.adjustment)}">${formatChange(result.adjustment)}</strong></span>
      <span>Next HCP <strong>${result.nextHandicap}</strong></span></div></div>`;
    list.append(row);
  });
}

function renderPlayerSelects() {
  const select = $("#handicapPlayerSelect");
  const current = state.selectedPlayerId;
  select.innerHTML = state.data.players.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  select.value = current || state.data.players[0]?.id || "";
}

function renderHandicapHistory() {
  const player = state.data.players.find(p => p.id === state.selectedPlayerId);
  const timeline = $("#handicapTimeline");
  if (!player) { $("#handicapChart").innerHTML = ""; timeline.innerHTML = ""; return; }
  const points = [{ label:"Start", value:player.startingHandicap }];
  state.data.rounds.forEach(round => {
    const result = round.results.find(r => r.playerId === player.id);
    if (result) points.push({ label:round.name, value:result.nextHandicap, result });
  });
  $("#handicapChart").innerHTML = createChart(points);
  timeline.innerHTML = points.slice(1).map(point => `<div class="timeline-row"><span>${escapeHtml(point.label)}</span><strong>${point.value}</strong></div>`).join("");
}

function createChart(points) {
  if (points.length < 2) return "<p>More round data is needed to draw the graph.</p>";
  const width=700,height=270,pad=42, values=points.map(p=>p.value), min=Math.min(...values)-1,max=Math.max(...values)+1;
  const x=i=>pad+(i*(width-pad*2)/(points.length-1));
  const y=v=>height-pad-((v-min)/(max-min||1))*(height-pad*2);
  const poly=points.map((p,i)=>`${x(i)},${y(p.value)}`).join(" ");
  const grid=[0,.25,.5,.75,1].map(t=>`<line class="chart-grid" x1="${pad}" y1="${pad+t*(height-pad*2)}" x2="${width-pad}" y2="${pad+t*(height-pad*2)}"/>`).join("");
  const dots=points.map((p,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(p.value)}" r="6"><title>${p.label}: ${p.value}</title></circle><text class="chart-label" x="${x(i)}" y="${height-12}" text-anchor="middle">${escapeHtml(p.label.replace("Round ","R"))}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${grid}<polyline class="chart-line" points="${poly}"/>${dots}</svg>`;
}

function renderStatistics() {
  const grid=$("#statisticsGrid"); grid.innerHTML="";
  rankPlayers(state.data.players,state.data.rounds,state.data.achievements)
    .filter(p=>p.name.toLowerCase().includes(state.search))
    .forEach(player=>{
      const s=calculatePlayerStatistics(player,state.data.rounds,state.data.achievements);
      const card=document.createElement("article"); card.className="stat-card";
      card.innerHTML=`<h4>${escapeHtml(player.name)}</h4><div class="stat-card-grid">
        ${statTile("Current HCP",s.currentHandicap)}${statTile("Average",s.average==null?"—":s.average.toFixed(1))}
        ${statTile("Best",s.best??"—")}${statTile("Worst",s.worst??"—")}
        ${statTile("Rounds",s.roundsPlayed)}${statTile("Wins",s.wins)}
        ${statTile("Runner-up",s.runnerUps)}${statTile("Third",s.thirds)}
        ${statTile("Nearest Pin",s.nearestPin)}${statTile("Longest Drive",s.longestDrive)}
        ${statTile("Season points",s.seasonPoints)}
      </div>`;
      grid.append(card);
    });
}

function setView(name) {
  state.activeView=name;
  $$(".nav-tab").forEach(b=>b.classList.toggle("is-active",b.dataset.view===name));
  $$(".view").forEach(v=>{const active=v.id===`${name}View`;v.hidden=!active;v.classList.toggle("is-active",active)});
  const titles={leaderboard:["Leaderboard","Best five rounds count towards the season total."],rounds:["Rounds","Every player, handicap and adjustment in a phone-friendly view."],handicaps:["Handicap History","See how handicaps move throughout the season."],statistics:["Statistics","Performance summaries for every member."]};
  $("#heroTitle").textContent=titles[name][0];$("#heroSubtitle").textContent=titles[name][1];
  if(name==="handicaps")renderHandicapHistory();if(name==="statistics")renderStatistics();
}

function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

$$(".nav-tab").forEach(button=>button.addEventListener("click",()=>{setView(button.dataset.view);$("#primaryNav").classList.remove("is-open")}));
$("#menuButton").addEventListener("click",()=>{const open=$("#primaryNav").classList.toggle("is-open");$("#menuButton").setAttribute("aria-expanded",String(open))});
$("#playerSearch").addEventListener("input",event=>{state.search=event.target.value.trim().toLowerCase();renderLeaderboard();renderRound();if(state.activeView==="statistics")renderStatistics()});
$("#handicapPlayerSelect").addEventListener("change",event=>{state.selectedPlayerId=event.target.value;renderHandicapHistory()});
window.addEventListener("scores:data-changed",refresh);

const admin = new AdminDashboard({ dataService: ScoresData, onChanged: refresh });
$("#adminEntry").addEventListener("click",()=>admin.open());
refresh();

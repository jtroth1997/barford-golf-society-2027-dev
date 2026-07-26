
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

  async open() {
    await this.render();
    this.dialog.showModal();
  }

  close() {
    this.dialog.close();
  }

  bind() {
    document.querySelector("#closeAdmin")?.addEventListener("click", () => this.close());

    document.querySelector("#adminNav")?.addEventListener("click", event => {
      const button = event.target.closest("[data-admin-panel]");
      if (!button) return;
      this.showPanel(button.dataset.adminPanel, button.textContent.trim());
    });

    document.querySelector("#scoreRoundSelect")?.addEventListener("change", () => this.renderScoreEntries());
    document.querySelector("#calculateRoundButton")?.addEventListener("click", () => this.calculateAndSave());
    document.querySelector("#addPlayerForm")?.addEventListener("submit", event => this.addPlayer(event));
    document.querySelector("#overrideHandicapButton")?.addEventListener("click", () => this.overrideHandicap());
    document.querySelector("#exportCsvButton")?.addEventListener("click", () => this.exportCsv());
    document.querySelector("#importCsvInput")?.addEventListener("change", event => this.importCsv(event));
    document.querySelector("#resetSeasonButton")?.addEventListener("click", () =>
      this.confirm("Reset demonstration season?", "This restores the original test players and rounds.", async () => {
        await this.dataService.reset();
        await this.render();
        await this.onChanged();
      })
    );

    this.confirmDialog?.addEventListener("close", async () => {
      if (this.confirmDialog.returnValue === "confirm" && this.pendingConfirm) {
        await this.pendingConfirm();
      }
      this.pendingConfirm = null;
    });
  }

  showPanel(name, title) {
    document.querySelectorAll(".admin-nav-button").forEach(button => {
      button.classList.toggle("is-active", button.dataset.adminPanel === name);
    });
    document.querySelectorAll(".admin-panel").forEach(panel => {
      const active = panel.id === `admin-${name}`;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    document.querySelector("#adminPanelTitle").textContent = title;
  }

  async render() {
    this.data = await this.dataService.getSnapshot();

    const playerOptions = this.data.players
      .map(player => `<option value="${player.id}">${this.escape(player.name)}</option>`)
      .join("");

    const roundOptions = [...this.data.rounds]
      .sort((a, b) => a.number - b.number)
      .map(round => {
        const label = round.eventName
          ? `${round.name} — ${round.eventName}`
          : round.name;
        return `<option value="${round.id}">${this.escape(label)}</option>`;
      })
      .join("");

    document.querySelector("#overridePlayer").innerHTML = playerOptions;
    document.querySelector("#scoreRoundSelect").innerHTML = roundOptions;

    this.renderScoreEntries();
    this.renderPlayers();
    this.showPanel("scores", "Enter Scores");
  }

  renderScoreEntries() {
    const roundId = document.querySelector("#scoreRoundSelect").value;
    const round = this.data.rounds.find(item => item.id === roundId);
    const list = document.querySelector("#scoreEntryList");
    list.innerHTML = "";

    this.data.players.forEach(player => {
      const saved = round?.results.find(result => result.playerId === player.id);
      const handicap = saved?.handicapUsed ?? this.getHandicapForRound(player.id, roundId);

      const row = document.createElement("article");
      row.className = "score-entry-row mobile-score-card";
      row.innerHTML = `
        <div class="score-player">
          <strong>${this.escape(player.name)}</strong>
          <span>Handicap for this round: <b>${handicap}</b></span>
        </div>
        <label class="field compact-field">
          <span>Stableford points</span>
          <input data-points="${player.id}" type="number" min="0" step="1"
            value="${saved?.dnp ? 0 : saved?.points ?? ""}" placeholder="0 = DNP">
        </label>
        <input data-hcp="${player.id}" type="hidden" value="${handicap}">
        <div class="calculated-result" data-result="${player.id}" aria-live="polite">
          ${saved ? this.resultMarkup(saved.adjustment, saved.nextHandicap, saved.dnp) : ""}
        </div>
      `;
      list.append(row);
    });
  }

  getHandicapForRound(playerId, roundId) {
    const rounds = [...this.data.rounds].sort((a, b) => a.number - b.number);
    const selectedIndex = rounds.findIndex(round => round.id === roundId);
    const player = this.data.players.find(item => item.id === playerId);

    for (let index = selectedIndex - 1; index >= 0; index -= 1) {
      const previous = rounds[index].results.find(result => result.playerId === playerId);
      if (previous && Number.isFinite(previous.nextHandicap)) return previous.nextHandicap;
    }

    return player?.startingHandicap ?? player?.currentHandicap ?? 0;
  }

  async calculateAndSave() {
    try {
      const roundId = document.querySelector("#scoreRoundSelect").value;
      const entries = this.data.players.map(player => ({
        playerId: player.id,
        handicap: Number(document.querySelector(`[data-hcp="${player.id}"]`).value),
        points: Number(document.querySelector(`[data-points="${player.id}"]`).value)
      }));

      const playableScores = entries
        .map(entry => entry.points)
        .filter(points => Number.isFinite(points) && points > 0);

      const average = calculateRoundAverage(playableScores);

      const results = entries.map(entry => {
        const result = calculateHandicapResult({
          handicap: entry.handicap,
          points: entry.points,
          average
        });

        return {
          playerId: entry.playerId,
          handicapUsed: entry.handicap,
          points: result.countedScore,
          adjustment: result.adjustment,
          nextHandicap: result.nextHandicap,
          dnp: result.dnp
        };
      });

      await this.dataService.saveRoundResults(roundId, results);
      await this.render();
      await this.onChanged();

      alert(`Round saved. Average score: ${average}. Next-round handicaps are ready.`);
    } catch (error) {
      alert(error.message);
    }
  }

  resultMarkup(adjustment, nextHandicap, dnp) {
    const adjustmentText = dnp ? "DNP" : adjustment > 0 ? `+${adjustment}` : `${adjustment}`;
    return `
      <span><small>Adjustment</small><strong>${adjustmentText}</strong></span>
      <span><small>Next HCP</small><strong>${nextHandicap}</strong></span>
    `;
  }

  renderPlayers() {
    const list = document.querySelector("#adminPlayerList");
    list.innerHTML = "";

    this.data.players.forEach(player => {
      const item = document.createElement("article");
      item.className = "admin-list-item";
      item.innerHTML = `
        <div><h4>${this.escape(player.name)}</h4><span>Current handicap ${player.currentHandicap}</span></div>
        <button class="small-button danger" type="button">Remove</button>
      `;
      item.querySelector("button").addEventListener("click", () =>
        this.confirm(`Remove ${player.name}?`, "This removes their scores from the demo data.", async () => {
          await this.dataService.removePlayer(player.id);
          await this.render();
          await this.onChanged();
        })
      );
      list.append(item);
    });
  }

  async addPlayer(event) {
    event.preventDefault();
    try {
      await this.dataService.addPlayer({
        name: document.querySelector("#newPlayerName").value,
        startingHandicap: Number(document.querySelector("#newPlayerHandicap").value)
      });
      event.target.reset();
      await this.render();
      await this.onChanged();
    } catch (error) {
      alert(error.message);
    }
  }

  async overrideHandicap() {
    const playerId = document.querySelector("#overridePlayer").value;
    const value = Number(document.querySelector("#overrideHandicap").value);
    if (!Number.isFinite(value) || value < 0) return alert("Enter a valid handicap");

    await this.dataService.updatePlayer(playerId, { currentHandicap: value });
    await this.render();
    await this.onChanged();
    alert("Handicap updated.");
  }

  exportCsv() {
    const rows = [["Player","Round","Event","Date","Handicap Used","Points","Adjustment","Next Handicap","DNP"]];
    this.data.rounds.forEach(round => round.results.forEach(result => {
      const player = this.data.players.find(item => item.id === result.playerId);
      rows.push([
        player?.name || "",
        round.name,
        round.eventName || "",
        round.date || "",
        result.handicapUsed,
        result.points ?? "",
        result.adjustment ?? "",
        result.nextHandicap,
        result.dnp ? "Yes" : "No"
      ]);
    }));

    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `barford-scores-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async importCsv(event) {
    alert("CSV import is available for future use. The current demo keeps data local.");
    event.target.value = "";
  }

  confirm(title, message, action) {
    document.querySelector("#confirmTitle").textContent = title;
    document.querySelector("#confirmMessage").textContent = message;
    this.pendingConfirm = action;
    this.confirmDialog.showModal();
  }

  escape(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    })[char]);
  }
}

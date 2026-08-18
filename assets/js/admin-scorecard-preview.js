(() => {
  "use strict";

  if ((location.pathname.split("/").pop() || "") !== "admin.html") return;

  const editor = document.getElementById("adminHoleEditor");
  if (!editor) return;

  const style = document.createElement("style");
  style.id = "adminScorecardPreviewStyles";
  style.textContent = `
    #adminHoleEditor.scorecard-preview-editor{display:grid;gap:10px;margin-top:14px}
    #adminHoleEditor .admin-hole-row.scorecard-hole{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px 14px;align-items:center;padding:13px 14px;border:1px solid #e1e6e2;border-radius:15px;background:#fff;box-shadow:0 3px 12px rgba(3,37,27,.035)}
    #adminHoleEditor .scorecard-hole-number{grid-row:1/3;display:flex;align-items:center;gap:7px;align-self:stretch;padding-right:12px;border-right:1px solid #e7ebe8;color:#123c2f}
    #adminHoleEditor .scorecard-hole-number span{font-size:.7rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#77827c}
    #adminHoleEditor .scorecard-hole-number strong{font-size:1.55rem;line-height:1}
    #adminHoleEditor .scorecard-tee-line{display:flex;align-items:center;gap:11px;min-width:0}
    #adminHoleEditor .scorecard-tee-name{display:inline-flex;align-items:center;justify-content:center;flex:0 0 68px;min-height:34px;padding:5px 9px;border-radius:9px;font-size:.78rem;font-weight:950;letter-spacing:.02em}
    #adminHoleEditor .scorecard-tee-name.yellow{background:#f6dc3c;color:#302900}
    #adminHoleEditor .scorecard-tee-name.red{background:#d94a43;color:#fff}
    #adminHoleEditor .scorecard-fact{display:flex;align-items:center;gap:5px;white-space:nowrap;color:#5d6862;font-size:.79rem;font-weight:800}
    #adminHoleEditor .scorecard-fact.yards{min-width:122px}
    #adminHoleEditor .scorecard-fact input{width:62px!important;min-width:0!important;min-height:38px!important;height:38px!important;padding:6px 7px!important;border:1px solid #d7ded9!important;border-radius:9px!important;background:#fbfcfb!important;color:#15211c!important;font-size:.96rem!important;font-weight:850!important;text-align:center!important;box-shadow:none!important}
    #adminHoleEditor .scorecard-fact.yards input{width:70px!important}
    #adminHoleEditor .scorecard-fact input:focus{border-color:#0b5a40!important;box-shadow:0 0 0 3px rgba(11,90,64,.1)!important;outline:0!important}
    #adminHoleEditor .scorecard-dot{color:#a1aaa5;font-weight:700}
    @media(max-width:700px){
      #adminHoleEditor.scorecard-preview-editor{gap:9px}
      #adminHoleEditor .admin-hole-row.scorecard-hole{grid-template-columns:1fr;gap:8px;padding:12px;border-radius:14px}
      #adminHoleEditor .scorecard-hole-number{grid-row:auto;border-right:0;border-bottom:1px solid #edf0ee;padding:0 0 9px;align-self:auto}
      #adminHoleEditor .scorecard-hole-number strong{font-size:1.35rem}
      #adminHoleEditor .scorecard-tee-line{display:grid;grid-template-columns:64px minmax(93px,1.25fr) minmax(70px,.8fr) minmax(58px,.7fr);gap:7px;align-items:center}
      #adminHoleEditor .scorecard-tee-name{flex:none;width:64px;min-height:36px;padding:5px 6px}
      #adminHoleEditor .scorecard-fact{justify-content:flex-start;gap:4px;font-size:.72rem}
      #adminHoleEditor .scorecard-fact.yards{min-width:0}
      #adminHoleEditor .scorecard-fact input,#adminHoleEditor .scorecard-fact.yards input{width:100%!important;max-width:58px!important;min-height:40px!important;height:40px!important;font-size:1rem!important}
      #adminHoleEditor .scorecard-fact.yards input{max-width:66px!important}
      #adminHoleEditor .scorecard-dot{display:none}
    }
    @media(max-width:390px){
      #adminHoleEditor .scorecard-tee-line{grid-template-columns:58px minmax(86px,1.25fr) minmax(64px,.8fr) minmax(54px,.7fr);gap:5px}
      #adminHoleEditor .scorecard-tee-name{width:58px;font-size:.7rem}
      #adminHoleEditor .scorecard-fact{font-size:.67rem}
    }
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const field = (row, name) => row.querySelector(`input[data-field="${name}"]`);

  const fact = (label, input, suffix = "", extraClass = "") => {
    const wrap = document.createElement("span");
    wrap.className = `scorecard-fact ${extraClass}`.trim();
    const text = document.createElement("span");
    text.textContent = label;
    wrap.append(text, input);
    if (suffix) {
      const end = document.createElement("span");
      end.textContent = suffix;
      wrap.append(end);
    }
    return wrap;
  };

  const dot = () => {
    const span = document.createElement("span");
    span.className = "scorecard-dot";
    span.textContent = "·";
    return span;
  };

  const teeLine = (name, tone, yards, par, si) => {
    const line = document.createElement("div");
    line.className = "scorecard-tee-line";
    const tee = document.createElement("span");
    tee.className = `scorecard-tee-name ${tone}`;
    tee.textContent = name;
    line.append(
      tee,
      fact("", yards, "yds", "yards"),
      dot(),
      fact("Par", par),
      dot(),
      fact("SI", si)
    );
    return line;
  };

  const refineRow = row => {
    if (!(row instanceof HTMLElement) || row.dataset.scorecardRefined === "1") return;
    const originalNumber = row.querySelector(":scope > strong");
    const yellowPar = field(row, "par");
    const yellowYards = field(row, "yards");
    const yellowSi = field(row, "stroke_index");
    const redPar = field(row, "red_par");
    const redYards = field(row, "red_yards");
    const redSi = field(row, "red_stroke_index");
    if (!originalNumber || !yellowPar || !yellowYards || !yellowSi || !redPar || !redYards || !redSi) return;

    const hole = originalNumber.textContent.trim();
    [yellowPar, yellowYards, yellowSi, redPar, redYards, redSi].forEach(input => {
      input.placeholder = "";
      input.inputMode = "numeric";
    });

    const number = document.createElement("div");
    number.className = "scorecard-hole-number";
    number.innerHTML = `<span>Hole</span><strong>${hole}</strong>`;

    row.textContent = "";
    row.classList.add("scorecard-hole");
    row.dataset.scorecardRefined = "1";
    row.append(
      number,
      teeLine("Yellow", "yellow", yellowYards, yellowPar, yellowSi),
      teeLine("Red", "red", redYards, redPar, redSi)
    );
  };

  const refine = () => {
    editor.classList.add("scorecard-preview-editor");
    editor.querySelectorAll(".admin-hole-row").forEach(refineRow);
  };

  refine();
  new MutationObserver(refine).observe(editor, { childList: true, subtree: false });
})();

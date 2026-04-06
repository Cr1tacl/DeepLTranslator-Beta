(function() {
  if (document.getElementById("translatorBetaWidget")) return;

  const LANGS = [
    { code:"auto", label:"Auto" }, { code:"EN", label:"English" },
    { code:"ES", label:"Spanish" }, { code:"FR", label:"French" },
    { code:"DE", label:"German" }, { code:"IT", label:"Italian" },
    { code:"PT", label:"Portuguese" }, { code:"RU", label:"Russian" },
    { code:"JA", label:"Japanese" }, { code:"ZH", label:"Chinese" },
    { code:"KO", label:"Korean" }, { code:"AR", label:"Arabic" },
  ];

  const MAX_USES = 10;
  const COUNTER_KEY = "translatorBetaCount";
  const WORKER_URL = "https://translator-api.your-subdomain.workers.dev"; // ← REPLACE after deploy

  // Restore saved position, count, and recents
  chrome.storage.local.get(["betaPosX", "betaPosY", "betaCount", "betaRecents"], data => {
    const savedX = data.betaPosX || 100;
    const savedY = data.betaPosY || 100;
    const savedCount = data.betaCount || 0;
    const savedRecents = data.betaRecents || [];
    buildWidget(savedX, savedY, savedCount, savedRecents);
  });

  function buildWidget(posX, posY, count, recents) {
    const widget = document.createElement("div");
    widget.id = "translatorBetaWidget";
    widget.style.cssText = `display:block;position:fixed;z-index:2147483647;width:320px;background:#fff;border:2px solid #4a90d9;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;left:${posX}px;top:${posY}px;`;

    widget.innerHTML = `
      <div id="bwHeader" style="cursor:move;background:#4a90d9;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;user-select:none;">
        <span>⚡ Translator Beta</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <span id="bwCount" style="font-size:10px;background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;">${MAX_USES - count} left</span>
          <button id="bwMin" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 2px;line-height:1;">−</button>
          <button id="bwClose" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0 2px;line-height:1;">×</button>
        </div>
      </div>
      <div id="bwBody">
        <div style="padding:12px 12px 0;">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
            <select id="bwSrc" style="flex:1;padding:5px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;"></select>
            <span style="color:#9ca3af;font-size:14px;">→</span>
            <select id="bwTgt" style="flex:1;padding:5px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;"></select>
          </div>
          <textarea id="bwInput" placeholder="Type or paste text…" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;" rows="2"></textarea>
          <button id="bwBtn" style="width:100%;margin-top:8px;padding:8px;background:#4a90d9;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s;">Translate</button>
        </div>
        <div id="bwOutput" style="margin:10px 12px;min-height:30px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px;font-size:13px;color:#1f2937;line-height:1.5;">
          <div id="bwResult" style="color:#9ca3af;">Translation will appear here</div>
          <div id="bwMeta" style="font-size:10px;color:#9ca3af;margin-top:4px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Populate selects
    const srcSel = widget.querySelector("#bwSrc");
    const tgtSel = widget.querySelector("#bwTgt");
    LANGS.forEach(l => srcSel.innerHTML += `<option value="${l.code}" ${l.code==="auto"?"selected":""}>${l.label}</option>`);
    LANGS.filter(l => l.code !== "auto").forEach(l => tgtSel.innerHTML += `<option value="${l.code}" ${l.code==="ES"?"selected":""}>${l.label}</option>`);

    // State
    let used = count;
    let minimized = false;

    function saveCount() { chrome.storage.local.set({ betaCount: used }); }
    function savePos() {
      chrome.storage.local.set({ betaPosX: widget.offsetLeft, betaPosY: widget.offsetTop });
    }

    function isExhausted() { return used >= MAX_USES; }

    const btn    = widget.querySelector("#bwBtn");
    const input  = widget.querySelector("#bwInput");
    const output = widget.querySelector("#bwOutput");
    const result = widget.querySelector("#bwResult");
    const meta   = widget.querySelector("#bwMeta");
    const countEl= widget.querySelector("#bwCount");

    function updateMeta() {
      const left = Math.max(0, MAX_USES - used);
      countEl.textContent = left + " left";
      meta.textContent = left > 0 ? `${left} free use${left===1?"":"s"} remaining` : "";
    }

    function showExhausted() {
      btn.disabled = true;
      btn.textContent = "No uses left";
      btn.style.background = "#9ca3af";
      result.innerHTML = 'Free trial expired. <a href="#" id="bwGetFull" style="color:#4a90d9;font-weight:700;">Get the full version</a>';
      meta.textContent = "";
      input.disabled = true;
      widget.querySelector("#bwGetFull").addEventListener("click", e => {
        e.preventDefault();
        window.open("https://Cr1tacl.github.io", "_blank");
      });
    }

    if (isExhausted()) showExhausted();
    else updateMeta();

    async function translate() {
      const text = input.value.trim();
      if (!text) return;
      if (isExhausted()) { showExhausted(); return; }

      btn.disabled = true;
      btn.textContent = "…";
      output.style.borderColor = "#d1d5db";
      result.style.color = "#9ca3af";
      result.textContent = "Translating…";
      meta.textContent = "";

      const src = srcSel.value === "auto" ? "auto" : srcSel.value;
      const tgt = tgtSel.value;

      try {
        const res = await fetch(WORKER_URL + "/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, source: src, target: tgt, provider: "mymemory" }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.error === "Free trial expired") {
            used = MAX_USES;
            saveCount();
            showExhausted();
            return;
          }
          throw new Error(data.error || "Server error");
        }

        used++;
        saveCount();
        result.style.color = "#1f2937";
        result.textContent = data.text;
        output.style.borderColor = "#e5e7eb";
        const left = data.uses_left !== null ? data.uses_left : Math.max(0, MAX_USES - used);
        countEl.textContent = left + " left";
        meta.textContent = left > 0 ? `${left} free use${left===1?"":"s"} remaining` : "";

        if (left <= 0) showExhausted();
      } catch(e) {
        result.style.color = "#dc2626";
        result.textContent = "Translation failed: " + e.message;
        output.style.borderColor = "#fca5a5";
      }

      btn.disabled = false;
      btn.textContent = "Translate";
    }

    btn.addEventListener("click", translate);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translate(); }
    });

    // Minimize / Close
    widget.querySelector("#bwMin").addEventListener("click", () => {
      minimized = !minimized;
      widget.querySelector("#bwBody").style.display = minimized ? "none" : "block";
      widget.querySelector("#bwMin").textContent = minimized ? "+" : "−";
    });

    widget.querySelector("#bwClose").addEventListener("click", () => {
      savePos();
      widget.style.display = "none";
    });

    // Restore on toggle (we listen via a small trick — since this is a content script,
    // the widget reappears when the page reloads, which is fine for now).

    // ── Drag ────────────────────────────────────────────────────────────
    const header = widget.querySelector("#bwHeader");
    let drag = false, ox, oy;
    header.addEventListener("mousedown", e => {
      drag = true;
      ox = e.clientX - widget.offsetLeft;
      oy = e.clientY - widget.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mouseup", () => { drag = false; savePos(); });
    document.addEventListener("mousemove", e => {
      if (!drag) return;
      widget.style.left = (e.clientX - ox) + "px";
      widget.style.top  = (e.clientY - oy) + "px";
    });
  }
})();

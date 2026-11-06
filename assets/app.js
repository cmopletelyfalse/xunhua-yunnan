// 寻花 · 云南 — 交互：花期/区域筛选、地图缩放拖动、花卡、对照滑动、图片放大
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const monthOf = (el) => (el.dataset.months || "").split(",").filter(Boolean).map(Number);

  /* ── 主视觉按钮平滑滚动 ─────────────────────────────── */
  $$("[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const el = document.getElementById(a.dataset.scroll);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ── 地图 ───────────────────────────────────────────── */
  const svg = document.getElementById("mapSvg");
  if (svg) {
    const obsList = $$(".obs", svg);
    const areaList = $$(".area", svg);
    const regionGroups = $$(".regions .region", svg);
    const listItems = $$(".flower");
    const card = document.getElementById("mapCard");
    const monthBtns = $$(".months button");
    const regionBtns = $$(".regions-filter button");
    const listCount = document.getElementById("listCount");
    const listMonth = document.getElementById("listMonth");

    let month = 0;      // 0 = 全部
    let region = "all";

    function applyFilters() {
      const seen = new Set();
      let visible = 0;
      obsList.forEach((o) => {
        const monOk = !month || monthOf(o).includes(month);
        const regOk = region === "all" || (o.dataset.region || "").split("/").includes(region);
        o.classList.toggle("off", !(monOk && regOk));
        if (monOk && regOk) { seen.add(o.dataset.flower); }
      });
      areaList.forEach((a) => {
        const f = a.dataset.flower;
        const src = obsList.find((o) => o.dataset.flower === f);
        const monOk = !month || monthOf(src).includes(month);
        const regOk = region === "all" || (a.dataset.region || "").split("/").includes(region);
        a.classList.toggle("off", !(monOk && regOk));
      });
      listItems.forEach((li) => {
        const monOk = !month || monthOf(li).includes(month);
        const regOk = region === "all" || (li.dataset.region || "").split("/").includes(region);
        li.classList.toggle("off", !(monOk && regOk));
      });
      regionGroups.forEach((g) => {
        g.classList.toggle("dim", region !== "all" && g.dataset.region !== region);
        g.classList.toggle("on", region !== "all" && g.dataset.region === region);
      });
      visible = seen.size;
      if (listCount) listCount.textContent = String(visible);
      if (listMonth) listMonth.textContent = month ? month + " 月" : "全年";
      updateSeasonal(month || new Date().getMonth() + 1);
    }

    monthBtns.forEach((b) =>
      b.addEventListener("click", () => {
        const m = Number(b.dataset.m);
        month = month === m ? 0 : m;
        monthBtns.forEach((x) => x.classList.toggle("on", Number(x.dataset.m) === month));
        applyFilters();
      })
    );

    regionBtns.forEach((b) =>
      b.addEventListener("click", () => {
        region = b.dataset.region;
        regionBtns.forEach((x) => x.classList.toggle("on", x.dataset.region === region));
        applyFilters();
      })
    );

    /* 花卡 */
    function openCard(el) {
      if (!card) return;
      $("#cardPhoto").src = el.dataset.photo;
      $("#cardName").textContent = el.dataset.name;
      $("#cardLatin").textContent = el.dataset.latin;
      $("#cardMeta").innerHTML = el.dataset.season + " · " + el.dataset.regions;
      $("#cardLink").href = el.dataset.href;
      card.hidden = false;
      observeCardMove = true;
    }
    let observeCardMove = false;

    obsList.forEach((o) => {
      o.addEventListener("click", (e) => {
        if (suppressClick) return;
        e.preventDefault();
        openCard(o);
        focusFlower(o.dataset.flower);
      });
      o.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCard(o);
          focusFlower(o.dataset.flower);
        }
      });
      o.addEventListener("mouseenter", () => focusFlower(o.dataset.flower));
      o.addEventListener("mouseleave", () => clearFocus());
    });

    const cardClose = $(".card-close");
    if (cardClose) cardClose.addEventListener("click", () => { card.hidden = true; });

    function focusFlower(id) {
      obsList.forEach((o) => o.classList.toggle("hot", o.dataset.flower === id));
      areaList.forEach((a) => a.classList.toggle("hot", a.dataset.flower === id));
      listItems.forEach((li) => li.classList.toggle("active", li.dataset.id === id));
    }
    function clearFocus() {
      obsList.forEach((o) => o.classList.remove("hot"));
      areaList.forEach((a) => a.classList.remove("hot"));
      listItems.forEach((li) => li.classList.remove("active"));
    }

    listItems.forEach((li) => {
      li.addEventListener("mouseenter", () => focusFlower(li.dataset.id));
      li.addEventListener("mouseleave", () => clearFocus());
      li.addEventListener("focusin", () => focusFlower(li.dataset.id));
      li.addEventListener("focusout", () => clearFocus());
    });

    /* 缩放与拖动（改 viewBox） */
    const BASE = { x: 0, y: 0, w: 760, h: 700 };
    let vb = Object.assign({}, BASE);
    let dragging = false, moved = false, suppressClick = false;
    let start = null;

    function setVB() {
      svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    }
    function toSvg(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      return {
        x: vb.x + ((clientX - r.left) / r.width) * vb.w,
        y: vb.y + ((clientY - r.top) / r.height) * vb.h,
      };
    }
    function clamp() {
      const minW = 200;
      vb.w = Math.min(BASE.w, Math.max(minW, vb.w));
      vb.h = vb.w * (BASE.h / BASE.w);
      vb.x = Math.min(BASE.x + BASE.w - vb.w, Math.max(BASE.x, vb.x));
      vb.y = Math.min(BASE.y + BASE.h - vb.h, Math.max(BASE.y, vb.y));
    }
    function zoom(factor, cx, cy) {
      const p = cx == null ? { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 } : toSvg(cx, cy);
      const nw = vb.w * factor;
      vb.x = p.x - (p.x - vb.x) * (nw / vb.w);
      vb.y = p.y - (p.y - vb.y) * (nw / vb.w);
      vb.w = nw;
      clamp(); setVB();
    }

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.86 : 1.16, e.clientX, e.clientY);
    }, { passive: false });

    svg.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".obs")) return;
      dragging = true; moved = false;
      start = { cx: e.clientX, cy: e.clientY, vx: vb.x, vy: vb.y };
      svg.classList.add("dragging");
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = svg.getBoundingClientRect();
      const dx = (e.clientX - start.cx) / r.width * vb.w;
      const dy = (e.clientY - start.cy) / r.height * vb.h;
      if (Math.abs(e.clientX - start.cx) + Math.abs(e.clientY - start.cy) > 4) moved = true;
      vb.x = start.vx - dx; vb.y = start.vy - dy;
      clamp(); setVB();
    });
    svg.addEventListener("pointerup", (e) => {
      if (dragging && moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 60);
      }
      dragging = false;
      svg.classList.remove("dragging");
      if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    });

    $$(".zoom-tools button").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.zoom;
        if (k === "in") zoom(0.8);
        else if (k === "out") zoom(1.25);
        else { vb = Object.assign({}, BASE); setVB(); }
      })
    );

    /* 当季推荐 */
    const seasonalMain = document.getElementById("seasonalMain");
    const seasonalLink = document.getElementById("seasonalLink");
    function updateSeasonal(m) {
      if (!seasonalMain) return;
      const hits = window.__FLOWERS__.filter((f) => f.months.includes(m));
      if (!hits.length) {
        seasonalMain.textContent = m + " 月：高山尚在雪下，可看干热河谷与温室；建议从 2 月起规划。";
        seasonalLink.href = "#calendar";
        return;
      }
      const names = hits.map((f) => f.name).join("、");
      const regions = [];
      hits.forEach((f) => f.region_ids.forEach((r) => { if (!regions.includes(r)) regions.push(r); }));
      const first = hits[0];
      seasonalMain.textContent =
        m + " 月：推荐 " + regions.slice(0, 2).join("、") + "，可看 " + names + "。";
      seasonalLink.href = first.travel.product + ".html";
      seasonalLink.textContent = "看看「" + first.travel.product_title + "」→";
    }

    // 允许通过 ?m=3&r=滇西北 预设筛选，便于分享某一时段的视图
    const params = new URLSearchParams(location.search);
    const qm = Number(params.get("m"));
    const qr = params.get("r");
    if (qm >= 1 && qm <= 12) {
      month = qm;
      monthBtns.forEach((x) => x.classList.toggle("on", Number(x.dataset.m) === month));
    }
    if (qr && regionBtns.some((b) => b.dataset.region === qr)) {
      region = qr;
      regionBtns.forEach((x) => x.classList.toggle("on", x.dataset.region === region));
    }

    applyFilters();
  }

  /* ── 详情页：并排 / 滑动对照 ────────────────────────── */
  const compare = document.getElementById("compare");
  const cmpMode = document.getElementById("cmpMode");
  if (compare && cmpMode) {
    let pos = 50;

    function buildHandle() {
      let h = $(".cmp-handle", compare);
      if (!h) {
        h = document.createElement("div");
        h.className = "cmp-handle";
        compare.appendChild(h);
      }
      return h;
    }
    function setPos(p) {
      pos = Math.min(96, Math.max(4, p));
      compare.style.setProperty("--pos", pos + "%");
    }
    function enterSlider() {
      compare.classList.remove("split", "single");
      compare.classList.add("slider");
      const h = buildHandle();
      setPos(pos);
      let dragging = false;
      h.addEventListener("pointerdown", (e) => {
        dragging = true;
        h.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      h.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const r = compare.getBoundingClientRect();
        setPos(((e.clientX - r.left) / r.width) * 100);
      });
      h.addEventListener("pointerup", (e) => {
        dragging = false;
        if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId);
      });
    }
    function leaveSlider() {
      compare.classList.remove("slider");
      const h = $(".cmp-handle", compare);
      if (h) h.remove();
    }
    cmpMode.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("button", cmpMode).forEach((x) => x.classList.toggle("on", x === b));
      if (b.dataset.mode === "slider") enterSlider();
      else {
        leaveSlider();
        compare.classList.add(compare.classList.contains("single") ? "single" : "split");
      }
    });
  }

  /* ── 图片放大 ───────────────────────────────────────── */
  const lb = document.getElementById("lightbox");
  if (lb) {
    const lbImg = document.getElementById("lbImg");
    const lbCap = document.getElementById("lbCap");
    $$(".cmp-col img").forEach((img) => {
      img.addEventListener("click", () => {
        lbImg.src = img.src;
        lbCap.textContent = img.closest("figure").querySelector("figcaption")?.textContent || "";
        lb.hidden = false;
      });
    });
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.closest(".lb-close")) lb.hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") lb.hidden = true;
    });
  }


  /* ── 报名弹窗（演示：不发送） ───────────────────────── */
  const modal = document.getElementById("bookModal");
  const form = document.getElementById("bookForm");
  if (modal && form) {
    const depSel = document.getElementById("bmDep");
    const bmTitle = document.getElementById("bmTitle");
    const open = (depId) => {
      if (depId && depSel) {
        Array.from(depSel.options).forEach((o) => { o.selected = o.value === depId; });
      }
      modal.hidden = false;
      bmTitle.textContent = "留下联系方式";
      form.hidden = false;
      const f = form.querySelector("input[name=name]");
      if (f) setTimeout(() => f.focus(), 40);
    };
    const close = () => { modal.hidden = true; };

    document.addEventListener("click", (e) => {
      const b = e.target.closest(".js-book");
      if (b) { e.preventDefault(); open(b.dataset.dep); }
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.closest(".bm-close")) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const dep = depSel && depSel.selectedOptions[0] ? depSel.selectedOptions[0].textContent : "";
      const who = (data.get("name") || "").toString().trim() || "你";
      form.hidden = true;
      bmTitle.textContent = "已收到";
      const box = document.createElement("p");
      box.className = "bm-done";
      box.innerHTML = who + "，已记下你对「" + dep + "」的意向，24 小时内会与你联系。<br>" +
        "如需马上确认，可直接电话或微信。";
      form.parentNode.insertBefore(box, form.nextSibling);
    });
  }

  /* ── 档期行点击高亮 ─────────────────────────────────── */
  document.querySelectorAll(".dep-table .dep-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      document.querySelectorAll(".dep-table .dep-row").forEach((r) => r.classList.remove("on"));
      row.classList.add("on");
    });
  });



  /* ── 团价计算器 ─────────────────────────────────────── */
  const pc = document.getElementById("priceCalc");
  if (pc) {
    const price = Number(pc.dataset.price) || 0;
    const single = Number(pc.dataset.single) || 0;
    const tickets = { lt60: Number(pc.dataset.t60) || 0, "60": Number(pc.dataset.t69) || 0, "70": Number(pc.dataset.t70) || 0 };
    const adultsEl = document.getElementById("pcAdults");
    const ageEl = document.getElementById("pcAge");
    const roomEl = document.getElementById("pcRoom");
    const totalEl = document.getElementById("pcTotal");
    const perEl = document.getElementById("pcPer");
    const linesEl = document.getElementById("pcLines");

    function money(n) { return "¥ " + n.toLocaleString("zh-Hans-CN"); }

    function calc() {
      const n = Number(adultsEl.value) || 1;
      const ticket = tickets[ageEl.value] || 0;
      const room = roomEl.value === "single";
      const base = price * n;
      const tk = ticket * n;
      const extra = room ? single : 0;
      const total = base + tk + extra;
      totalEl.textContent = money(total);
      perEl.textContent = "／" + n + " 人合计";
      const rows = [
        `团费 ${money(price)} × ${n} 人 = ${money(base)}`,
        ticket ? `门票补差 ${money(ticket)} × ${n} 人 = ${money(tk)}` : "门票：已含在团费内",
        room ? `单房差（估算）= ${money(extra)}` : "房型：双人标间，无单房差",
      ];
      linesEl.innerHTML = rows.map((r) => `<li>${r}</li>`).join("");
    }
    [adultsEl, ageEl, roomEl].forEach((el) => el && el.addEventListener("change", calc));
    calc();
  }

  /* ── 悬浮咨询 + 复制微信号 ──────────────────────────── */
  const fcBtn = document.getElementById("fcBtn");
  const fcPanel = document.getElementById("fcPanel");
  if (fcBtn && fcPanel) {
    fcBtn.addEventListener("click", () => {
      fcPanel.hidden = !fcPanel.hidden;
    });
    document.addEventListener("click", (e) => {
      if (fcPanel.hidden) return;
      if (!e.target.closest("#floatContact")) fcPanel.hidden = true;
    });
  }
  function copyText(t) {
    const done = (ok) => {
      // 反馈：临时替换按钮文字
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => done(true)).catch(() => fallback(t));
    } else {
      fallback(t);
    }
    function fallback(t) {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".js-copy-wx, .fc-item, .inquiry-wx, .foot-wx");
    if (!b) return;
    const wx = b.dataset.wx;
    if (!wx) return;
    copyText(wx);
    const old = b.textContent;
    b.textContent = "已复制：" + wx;
    setTimeout(() => { b.textContent = old; }, 1600);
  });

  /* ── 跟团游筛选 ─────────────────────────────────────── */
  const filters = document.getElementById("tourFilters");
  const grid = document.getElementById("tourGrid");
  if (filters && grid) {
    const cards = Array.from(grid.querySelectorAll(".tour-card"));
    const state = { days: "all", price: "all", who: "all" };
    const countEl = document.getElementById("tourCount");

    function match(card) {
      const wrap = card.querySelector(".tour-body");
      const days = Number(wrap.dataset.days);
      const price = Number(wrap.dataset.price);
      const who = (wrap.dataset.who || "").split(",");
      if (state.days === "short" && days !== 6) return false;
      if (state.days === "long" && days < 10) return false;
      if (state.price === "low" && !(price > 0 && price < 2500)) return false;
      if (state.price === "mid" && !(price >= 2500 && price <= 3000)) return false;
      if (state.price === "high" && !(price > 3000)) return false;
      if (state.who !== "all" && !who.includes(state.who)) return false;
      return true;
    }
    function apply() {
      let shown = 0;
      cards.forEach((c) => {
        const ok = match(c);
        c.classList.toggle("hide", !ok);
        if (ok) shown += 1;
      });
      if (countEl) countEl.textContent = String(shown);
    }
    filters.querySelectorAll(".tf-group").forEach((group) => {
      group.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        group.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        state[group.dataset.key] = b.dataset.v;
        apply();
      });
    });
    apply();
  }

})();

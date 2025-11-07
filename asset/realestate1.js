// global chart registry
window.chartRegistry = {};

// helper to safely (re)create charts
function safeChart(id, config) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;

  // destroy existing
  if (window.chartRegistry[id]) {
    try {
      window.chartRegistry[id].destroy();
    } catch (e) {
      console.warn(`Failed to destroy chart ${id}:`, e);
    }
  }

  // create new
  window.chartRegistry[id] = new Chart(ctx, config);
  return window.chartRegistry[id];
}



/* ============ Config - set your Apps Script URL here ============ */
const API_URL = "https://script.google.com/macros/s/AKfycbykqz1XKaYf2ExIDVvLpEekAE3LpjejPZAN1YU-q_pZyPUkf0cVC3lArOAJVVZiFpuarg/exec";

// Utility function to always fetch the current environment from localStorage
function getCurrentEnv() {
  return localStorage.getItem("lastEnv") || "test";
}


document.addEventListener("DOMContentLoaded", async () => {
  const envSwitch = document.getElementById("envSwitch");
  const envLabel = document.getElementById("envLabel");

  const savedEnv = localStorage.getItem("lastEnv") || "test";
  CURRENT_ENV = savedEnv; // Optional for backward compatibility
  envSwitch.checked = (savedEnv === "live");
  envLabel.textContent = savedEnv.charAt(0).toUpperCase() + savedEnv.slice(1);

  try {
    const data = await remote.load();
    app.data = data;
    app.renderAll();
  } catch (err) {
    console.error("Initial env load failed", err);
    alert("Failed to load data for " + savedEnv);
  }

  if (envSwitch) {
    envSwitch.addEventListener("change", async () => {
      const newEnv = envSwitch.checked ? "live" : "test";
      console.log("🔄 [Env Switch] Changing environment to:", newEnv);

      localStorage.setItem("lastEnv", newEnv);
      CURRENT_ENV = newEnv;

      envLabel.textContent = newEnv.charAt(0).toUpperCase() + newEnv.slice(1);
      showToast(`Environment switched to ${newEnv}`, "info");

      try {
        const data = await remote.load();
        console.log("✅ [Env Switch] Data reloaded for", newEnv);
        app.data = data;
        app.renderAll();
      } catch (err) {
        console.error("❌ [Env Switch] Reload failed", err);
        alert("Failed to reload data for " + newEnv);
      }
    });
  }
});







/* ============ Utilities & Remote Storage ============ */
const UID = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => new Intl.NumberFormat('en-IN').format(n || 0);

/* Remote storage wrapper */
const remote = {
  async load() {
    showLoader();
    try {
      const env = getCurrentEnv(); // ✅ always get latest environment
      console.log("🔄 [Load] Using environment:", env);

      const res = await fetch(API_URL + "?action=load&env=" + env, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Load failed: ${res.status} — ${text}`);
      }
      const data = await res.json();
      console.log("✅ [Load] Data loaded successfully", data);
      return data;
    } catch (err) {
      console.error("❌ [Load] Error", err);
      alert("Failed to load data: " + err.message);
      throw err;
    } finally {
      hideLoader();
    }
  },

  async add(type, data) {
    showLoader();
    try {
      const env = getCurrentEnv();
      console.log("🔄 [Add] Using environment:", env);
      console.log("🔄 [Add] Data to add:", data);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'add', type, data, env })
      });
      if (!res.ok) throw new Error(`Add failed: ${res.status}`);
      const json = await res.json();
      console.log("✅ [Add] Added successfully", json);
      showToast(`${type} added successfully!`, "success");
      return json;
    } catch (err) {
      console.error("❌ [Add] Error", err);
      showToast(`Failed to add ${type}`, "error");
      throw err;
    } finally {
      hideLoader();
    }
  },

  async update(type, data) {
    showLoader();
    try {
      const env = getCurrentEnv();
      console.log("🔄 [Update] Using environment:", env);
      console.log("🔄 [Update] Data to update:", data);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'update', type, data, env })
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      const json = await res.json();
      console.log("✅ [Update] Updated successfully", json);
      showToast(`${type} updated successfully!`, "success");
      return json;
    } catch (err) {
      console.error("❌ [Update] Error", err);
      showToast(`Failed to update ${type}`, "error");
      throw err;
    } finally {
      hideLoader();
    }
  },


  async delete(type, id) {
    showLoader();
    try {
      const env = getCurrentEnv();
      console.log("Deleting using environment:", env); // ✅ debug log here

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', type, id, env: env })
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      const json = await res.json();
      showToast(`${type} deleted successfully!`, "success");
      return json;
    } catch (err) {
      console.error("Remote.delete error", err);
      showToast(`Failed to delete ${type}`, "error");
      throw err;
    } finally {
      hideLoader();
    }
  }


};



/* ============ Matching Helper ============ */
function findMatchesForLead(lead, properties) {
  return (properties || []).map(p => {
    let score = 0;

    // Type match
    if (p.Type && lead.PropertyType && p.Type.toLowerCase() === lead.PropertyType.toLowerCase()) {
      score += 40;
    }
    // Location match (substring)
    if (p.Location && lead.Location &&
      p.Location.toLowerCase().includes(lead.Location.toLowerCase())) {
      score += 30;
    }
    // Budget vs Price
    const budget = Number(lead.Budget || 0);
    const price = Number(p.Price || 0);
    if (budget && price && price <= budget * 1.1) {
      score += 30;
    }

    return { property: p, score };
  })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/* ============ App State & UI ============ */
const app = {
  data: { leads: [], properties: [], tasks: [], sellers: [], buyers: [], config: [] },
  currentView: 'dashboard',
  searchText: '',

  init: async function () {
    try {
      await this.reloadFromServer();
    } catch (err) {
      console.error('Failed to load remote data', err);
      alert('Failed to load data from server. Check API_URL and Apps Script deployment.');
    }
    this.show('dashboard');
    this.renderAll();
  },

  async reloadFromServer() {
    try {
      const env = getCurrentEnv();
      console.log("🔄 [reloadFromServer] Loading data using environment:", env);

      const remoteData = await remote.load();
      console.log("✅ [reloadFromServer] Remote data loaded:", remoteData);

      this.data = {
        leads: (remoteData.leads || []).map(normalizeRow),
        properties: (remoteData.properties || []).map(normalizeRow),
        tasks: (remoteData.tasks || []).map(normalizeRow),
        sellers: (remoteData.sellers || []).map(normalizeRow),
        buyers: (remoteData.buyers || []).map(normalizeRow),
        config: (remoteData.config || []).map(normalizeRow),
      };

      console.log("✅ [reloadFromServer] Data updated in app:", this.data);
    } catch (err) {
      console.error("❌ [reloadFromServer] Failed to load data:", err);
    }
  },


  /* UI navigation */
  show(view) {
    this.currentView = view;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === view));
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const page = document.getElementById('page-' + view);
    if (page) page.style.display = 'block';
    if (view === 'leads') this.renderLeads();
    if (view === 'properties') this.renderProperties();
    if (view === 'tasks') this.renderTasks();
    if (view === 'buyers') this.renderBuyers();
    if (view === 'sellers') this.renderSellers();
    if (view === 'sellers') this.renderSellers();
  },

  /* Rendering */
  renderAll() {
    // ----------------------
    // 1️⃣ Render main sections
    // ----------------------
    this.renderKPIs();
    this.renderLeads();
    this.renderProperties();
    this.renderTasks();
    this.renderCharts();
    this.renderUpcoming();

    if (window.lucide) lucide.createIcons();

    // ----------------------
    // 2️⃣ Destroy old charts before redrawing
    // ----------------------
    if (window.chartRegistry) {
      for (const id in window.chartRegistry) {
        if (window.chartRegistry[id]) {
          try { window.chartRegistry[id].destroy(); } catch (e) { console.warn(e); }
          window.chartRegistry[id] = null;
        }
      }
    }

    // ----------------------
    // 3️⃣ Render new dashboard reports (if available)
    // ----------------------
    if (typeof renderAllReports === "function") {
      renderAllReports(this.data);
    }

    // ----------------------
    // 4️⃣ Render enhanced charts (Monthly / Source / Forecast / Tasks)
    // ----------------------
    if (typeof renderEnhancedCharts === "function") {
      // Ensure the DOM container exists
      const container = document.getElementById("crmDash_enhanced-charts");
      if (container) {
        console.log("🚀 Rendering enhanced charts from renderAll()");
        renderEnhancedCharts(this.data);
      } else {
        console.warn("⚠️ Enhanced charts container not found. Skipping enhanced charts.");
      }
    }

    // ----------------------
    // 5️⃣ Update Sidebar Badge Counters
    // ----------------------
    document.getElementById('leads-badge').textContent =
      `${(this.data.leads || []).length} Leads`;
    document.getElementById('properties-badge').textContent =
      `${(this.data.properties || []).length} Properties`;
    document.getElementById('tasks-badge').textContent =
      `${(this.data.tasks || []).length} Tasks`;

    // ----------------------
    // 6️⃣ Task Reminders: Find due-soon tasks (within next 24 hours)
    // ----------------------
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueSoonTasks = (this.data.tasks || []).filter(t => {
      const dueDate = new Date(
        t.DueDate || t.dueDate || t.Due || t.due || now
      );
      return (
        dueDate >= now &&
        dueDate <= next24h &&
        (t.Status || t.status) === "Open"
      );
    });

    if (dueSoonTasks.length > 0) {
      showToast(
        `⚠️ You have ${dueSoonTasks.length} task(s) due within 24 hours.`,
        "warning"
      );
    }

    // ----------------------
    // 7️⃣ Ensure First Lead Is Selected After Data Load
    // ----------------------
    if (!this.selectedLeadId && (this.data.leads || []).length) {
      this.selectedLeadId =
        this.data.leads[0].ID || this.data.leads[0].id;
    }

    // ----------------------
    // 8️⃣ Refresh Interactive CRM Dashboard (V2)
    // ----------------------
    if (typeof crmDash_refresh === "function") {
      crmDash_refresh(this.data);
    }

    console.log("✅ renderAll completed successfully");
  },






  updateSidebarBadges() {
    document.getElementById('badge-leads').innerText = this.data.leads.length;
    document.getElementById('badge-properties').innerText = this.data.properties.length;

    const now = new Date();
    const dueSoonCount = (this.data.tasks || []).filter(t => {
      const dueDate = new Date(t.DueDate);
      const diffHours = (dueDate - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 24; // Due in next 24 hours
    }).length;

    document.getElementById('badge-tasks').innerText = this.data.tasks.length;

    if (dueSoonCount > 0) {
      this.showToast(`⚠️ You have ${dueSoonCount} tasks due in the next 24 hours.`, 'warning');
    }
  },




  renderKPIs() {
    const leads = this.data.leads || [];
    const tasks = this.data.tasks || [];

    // --- Animated counter helper (always starts from 0) ---
    const animateCounter = (el, target, duration = 1000) => {
      if (!el) return;
      el.textContent = "0"; // reset every time
      let start = 0;
      const step = Math.max(1, Math.ceil(target / (duration / 30)));
      const timer = setInterval(() => {
        start += step;
        if (start >= target) {
          start = target;
          clearInterval(timer);
        }
        el.textContent = start;
      }, 30);
    };

    // --- Helper: is a given date in the current week? ---
    const isThisWeek = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d)) return false;

      const now = new Date();
      const firstDay = new Date(now);
      firstDay.setDate(now.getDate() - now.getDay()); // Sunday
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      lastDay.setHours(23, 59, 59, 999);

      return d >= firstDay && d <= lastDay;
    };

    // --- Calculate lead KPIs ---
    // --- Calculate lead KPIs ---
    const total = leads.length;

// Hot (all time)
const hotAll = leads.filter(l =>
  ["Site Visit", "Negotiation"].includes(l.Status)
).length;

// Hot (this week, based on LeadDate)
const hotWeek = leads.filter(l =>
  ["Site Visit", "Negotiation"].includes(l.Status) &&
  isThisWeek(l.LeadDate)   // <-- now using LeadDate column from sheet
).length;

    const follow = tasks.filter(t => t.Status === 'Open').length;
    const closed = leads.filter(l => l.Status === "Closed").length;

    // --- Animate numbers ---
    animateCounter(document.getElementById('kpi-total'), total);
    animateCounter(document.getElementById('kpi-hot'), hotAll);
    animateCounter(document.getElementById('kpi-follow'), follow);
    animateCounter(document.getElementById('kpi-closed'), closed);

    // --- Add sub-counter for Hot Leads ---
    document.getElementById('kpi-hot-sub').innerHTML = `
  Hot Leads <span style="color:#f97316;font-weight:600;">(${hotWeek} this week)</span>
`;

    // --- Open Tasks KPI ---
    const tasksOpen = tasks.filter(t => t.Status === 'Open');
    const totalOpenTasks = tasksOpen.length;
    animateCounter(document.getElementById('kpi-tasks-num'), totalOpenTasks);

    // --- Breakdown ---
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const classify = (t) => {
      const d = new Date(t.DueDate);
      if (isNaN(d)) return 'later';
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      if (diff < 0) return 'overdue';
      if (diff === 0) return 'today';
      if (diff <= 3) return 'soon';
      return 'later';
    };

    const counts = { overdue: 0, today: 0, soon: 0, later: 0 };
    tasksOpen.forEach(t => counts[classify(t)]++);

    document.getElementById('kpi-tasks-breakdown').innerHTML = `
    <span class="kpi-tasks-counter" title="Click to view overdue tasks"
      onclick="app.filterTasksByDueWindow('overdue')">🔴 Overdue: ${counts.overdue}</span><br>
    <span class="kpi-tasks-counter" title="Click to view today's tasks"
      onclick="app.filterTasksByDueWindow('today')">🟠 Today: ${counts.today}</span><br>
    <span class="kpi-tasks-counter" title="Click to view tasks due in the next 3 days"
      onclick="app.filterTasksByDueWindow('soon')">🟡 Soon: ${counts.soon}</span><br>
    <span class="kpi-tasks-counter" title="Click to view later tasks"
      onclick="app.filterTasksByDueWindow('later')">🟢 Later: ${counts.later}</span>
  `;

    // --- Render Sparklines ---
    const sparklineConfig = (data, color) => ({
      type: 'line',
      data: {
        labels: [...Array(data.length).keys()].map(i => i + 1),
        datasets: [{
          data,
          borderColor: color,
          fill: false,
          borderWidth: 2,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 0 },
        elements: { line: { tension: 0.3 }, point: { radius: 0 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });

    // Example: Generate simple data trends
    const dummyTrends = {
      total: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10 + 5)),
      hot: Array.from({ length: 7 }, () => Math.floor(Math.random() * 5 + 2)),
      follow: Array.from({ length: 7 }, () => Math.floor(Math.random() * 8 + 3)),
      closed: Array.from({ length: 7 }, () => Math.floor(Math.random() * 6 + 2)),
      tasks: Array.from({ length: 7 }, () => Math.floor(Math.random() * 7 + 1))
    };

    safeChart('sparkline-total', sparklineConfig(dummyTrends.total, '#7c3aed'));
    safeChart('sparkline-hot', sparklineConfig(dummyTrends.hot, '#06b6d4'));

    safeChart('sparkline-follow', sparklineConfig(dummyTrends.follow, '#f59e0b'));
    safeChart('sparkline-closed', sparklineConfig(dummyTrends.closed, '#10b981'));
    safeChart('sparkline-tasks', sparklineConfig(dummyTrends.tasks, '#3b82f6'));
  },




  /* LEADS */
  renderLeads() {
    console.log("🔄 [renderLeads] Rendering leads with data:", this.data.leads);
    const tbody = document.getElementById('leadsTable');
    const q = (this.searchText || '').toLowerCase();
    const fStatus = document.getElementById('f-status').value;
    const fSource = document.getElementById('f-source').value;
    const fBudgetMin = Number(document.getElementById('f-budget-min').value || 0);
    const fLoc = (document.getElementById('f-location').value || '').toLowerCase();

    let list = (this.data.leads || []).filter(l => {
      const hay = [
        l.Name, l.Phone, l.Email, l.Location, l.City, l.PropertyType, l.Budget,
        l.Purpose, l.Source, l.Remark, l.Status, l.Agent, l.Priority,
        l.FinancingType, l.BuyingWindow, l.Occupation, (this.propertyById(l.PropertyID) || {}).Title
      ].join(' ').toLowerCase();

      const matchesQ = !q || hay.includes(q);
      const okS = !fStatus || l.Status === fStatus;
      const okSo = !fSource || l.Source === fSource;
      const okB = !fBudgetMin || Number(l.Budget || 0) >= fBudgetMin;
      const okL = !fLoc || (l.Location || '').toLowerCase().includes(fLoc);

      return matchesQ && okS && okSo && okB && okL;
    });

    if (this.leadsSortKey) {
      const key = this.leadsSortKey;
      const ascending = this.leadsSortAsc;
      list.sort((a, b) => {
        let valA = (a[key] ?? '');
        let valB = (b[key] ?? '');
        if (key === 'Budget' || key === 'LeadScore') {
          valA = Number(valA || 0); valB = Number(valB || 0);
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }
        if (valA > valB) return ascending ? 1 : -1;
        if (valA < valB) return ascending ? -1 : 1;
        return 0;
      });
    }

    const pillSets = ["pill-alt1", "pill-alt2", "pill-alt3", "pill-alt4", "pill-alt5", "pill-alt6"];
    const pillWrap = (val, rowIndex, offset = 0) => {
      if (!val) return '<span class="small muted">—</span>';
      const cls = pillSets[(rowIndex + offset) % pillSets.length];
      return `<span class="pill ${cls}">${escapeHtml(val)}</span>`;
    };

    const fmtDate = d => {
      if (!d) return '<span class="small muted">—</span>';
      try {
        const dd = new Date(d);
        if (!isNaN(dd.getTime())) {
          return dd.toDateString() + " " + dd.toTimeString().split(" ")[0];
        }
      } catch (e) { }
      return escapeHtml(String(d).replace(/GMT.*$/, '').trim());
    };

    tbody.innerHTML = list.map((l, idx) => {
      const prop = this.propertyById ? this.propertyById(l.PropertyID) : null;

      // Source pill
      const src = (l.Source || "Unknown").toLowerCase();
      let pillClass = "pill-unknown";
      if (src === "website") pillClass = "pill-website";
      else if (src === "facebook") pillClass = "pill-facebook";
      else if (src === "referral") pillClass = "pill-referral";
      else if (src === "whatsapp") pillClass = "pill-whatsapp";
      const sourceCell = `<span class="pill ${pillClass}" 
      style="cursor:pointer" 
      title="Click to filter by ${escapeHtml(l.Source || 'Unknown')}" 
      onclick="document.getElementById('f-source').value='${escapeHtml(l.Source || '')}'; app.renderLeads();">
      ${escapeHtml(l.Source || "Unknown")}
    </span>`;

      // Status pill
      const status = (l.Status || "Unknown").toLowerCase();
      let statusClass = "status-new";
      if (status === "closed") statusClass = "status-closed";
      else if (status === "lost") statusClass = "status-lost";
      else if (status === "contacted") statusClass = "status-contacted";
      else if (status === "site visit") statusClass = "status-site";
      else if (status === "negotiation") statusClass = "status-negotiation";
      const statusCell = `<span class="pill ${statusClass}">${escapeHtml(l.Status || "-")}</span>`;

      // Budget pill
      const amount = Number(l.Budget || 0);
      let amountClass = 'pill-amount-low';
      if (amount >= 1000000) amountClass = 'pill-amount-high';
      else if (amount >= 500000) amountClass = 'pill-amount-mid';
      const amountCell = `<span class="pill ${amountClass}" title="₹ ${fmtCompactAmount(amount)}">₹ ${fmt(amount)}</span>`;

      // Priority pill
      const pr = (l.Priority || '').toString().toLowerCase();
      let prClass = '';
      if (pr === 'hot') prClass = 'pill-priority-hot';
      else if (pr === 'warm') prClass = 'pill-priority-warm';
      else if (pr === 'cold') prClass = 'pill-priority-cold';
      const priorityCell = l.Priority ? `<span class="pill ${prClass}">${escapeHtml(l.Priority)}</span>` : '<span class="small muted">—</span>';

      const agentCell = l.Agent ? escapeHtml(l.Agent) : '<span class="small muted">—</span>';

      // Alternating pills
      const cityCell = pillWrap(l.City, idx, 0);
      const purposeCell = pillWrap(l.Purpose, idx, 1);
      const propertyTypeCell = pillWrap(l.PropertyType, idx, 2);
      const propertyCell = prop ? pillWrap(prop.Title || prop.Ref || '-', idx, 3) : '<span class="small muted">—</span>';
      const financingCell = pillWrap(l.FinancingType, idx, 4);
      const scoreCell = pillWrap(l.LeadScore, idx, 5);

      return `<tr data-id="${l.ID}">
      <td>${escapeHtml(l.Name || '-')}</td>
      <td>${escapeHtml(l.Phone || '-')}</td>
      <td>${escapeHtml(l.Email || '-')}</td>
      <td>${cityCell}</td>
      <td>${escapeHtml(l.Location || '-')}</td>
      <td>${purposeCell}</td>
      <td>${propertyTypeCell}</td>
      <td>${amountCell}</td>
      <td>${priorityCell}</td>
      <td>${agentCell}</td>
      <td>${sourceCell}</td>
      <td>${statusCell}</td>
      <td>${propertyCell}</td>
      <td>${fmtDate(l.NextFollowupDate)}</td>
      <td>${fmtDate(l.LeadDate)}</td>
      <td>${financingCell}</td>
      <td>${escapeHtml(l.BuyingWindow || '-')}</td>
      <td>${escapeHtml(l.Occupation || '-')}</td>
      <td>${scoreCell}</td>
      <td>${escapeHtml(l.Remark || '-')}</td>
      <td class="actions">
        <button class="edit" title="View / Edit" onclick="app.openLeadModal('${l.ID}')"><i data-lucide="edit-3"></i></button>
        <button class="followup" title="Follow-ups" onclick="app.openFollowup('${l.ID}')"><i data-lucide="clock"></i></button>
        <button class="matches" title="Matches" onclick="app.openMatches('${l.ID}')"><i data-lucide="search"></i></button>
        <button class="delete" title="Delete" onclick="app.deleteLead('${l.ID}')"><i data-lucide="trash-2"></i></button>
        <button class="whatsapp" title="Send WhatsApp" onclick="app.sendWhatsappForLead('${l.ID}')"><i data-lucide="message-circle"></i></button>
      </td>
    </tr>`;
    }).join('');

    this.renderKPIs();
    this.renderCharts();
    this.renderUpcoming();

    const thead = tbody.closest('table').querySelector('thead');
    thead.querySelectorAll('th[data-key]').forEach(th => {
      th.style.cursor = 'pointer';
      th.onclick = () => {
        const key = th.dataset.key;
        if (this.leadsSortKey === key) this.leadsSortAsc = !this.leadsSortAsc;
        else { this.leadsSortKey = key; this.leadsSortAsc = true; }
        this.renderLeads();
      };
    });

    lucide.createIcons();
    // defer to let Lucide replace <i> → <svg>
    setTimeout(() => {
      applyContextMenuIconColorsLeads();
    }, 0);

    attachLeadContextMenu();

  },





  sendWhatsappForLead(id) {
    const lead = this.data.leads.find(l => l.ID === id);
    if (!lead) return alert('Lead not found');

    const message =
      `*🔔 New Lead Details:*

👤 Name: *${lead.Name || '-'}*
📞 Phone: *${lead.Phone || '-'}*
📍 Location: ${lead.City || '-'}, ${lead.Location || '-'}
🏠 Property: ${lead.PropertyType || '-'}
💰 Budget: ₹ ${fmt(lead.Budget)}

📝 Remark: _${lead.Remark || '-'}_

👉 Status: *${lead.Status || '-'}*
🔗 Source: ${lead.Source || '-'}`;

    const payload = {
      instance_id: "68761C38A48AC",
      access_token: "685b00ae77342",
      number: "91" + lead.Phone,  // Country code + number
      message: message
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    };

    try {
      const response = UrlFetchApp.fetch("https://bdwamaster.site/api/send", options);
      alert('✅ WhatsApp message sent successfully!');
    } catch (e) {
      alert('❌ Failed to send WhatsApp message');
    }
  },



  /* PROPERTIES */
  renderProperties() {
    const tbody = document.getElementById('propertiesTable');
    const q = (this.searchText || '').toLowerCase();
    const fType = (this.filterType || '').toLowerCase();
    const fMode = (this.filterMode || '').toLowerCase();

    const filterContainer = document.getElementById('propertyActiveFilters');
    if (filterContainer) filterContainer.innerHTML = '';

    if (this.filterType) {
      const typeLabel = this.filterType.charAt(0).toUpperCase() + this.filterType.slice(1);
      const typePill = document.createElement('span');
      typePill.className = 'pill pill-type-active';
      typePill.innerHTML = `${typeLabel} <span style="margin-left:4px;cursor:pointer;" onclick="app.filterType=''; app.renderProperties();">✕</span>`;
      filterContainer.appendChild(typePill);
    }

    if (this.filterMode) {
      const modeLabel = this.filterMode.charAt(0).toUpperCase() + this.filterMode.slice(1);
      const modePill = document.createElement('span');
      modePill.className = 'pill pill-mode-active';
      modePill.innerHTML = `${modeLabel} <span style="margin-left:4px;cursor:pointer;" onclick="app.filterMode=''; app.renderProperties();">✕</span>`;
      filterContainer.appendChild(modePill);
    }

    let list = this.data.properties.filter(p => {
      const matchesQ = !q || [
        p.Title, p.FullAddress, p.Location, p.City, p.Type, p.Mode,
        p.Size, p.Price, p.Bedrooms, p.Bathrooms, p.Owner, p.Remark
      ].join(' ').toLowerCase().includes(q);

      const matchesType = !fType || (p.Type || '').toLowerCase() === fType;
      const matchesMode = !fMode || (p.Mode || '').toLowerCase() === fMode;

      return matchesQ && matchesType && matchesMode;
    });

    if (this.propertiesSortKey) {
      const key = this.propertiesSortKey;
      const ascending = this.propertiesSortAsc;
      list.sort((a, b) => {
        let valA = a[key] ?? '';
        let valB = b[key] ?? '';
        if (['Price', 'Size', 'Bedrooms', 'Bathrooms', 'Age'].includes(key)) {
          valA = Number(valA || 0); valB = Number(valB || 0);
        } else if (key.toLowerCase().includes('date')) {
          valA = new Date(valA).getTime() || 0;
          valB = new Date(valB).getTime() || 0;
        } else {
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
        }
        if (valA > valB) return ascending ? 1 : -1;
        if (valA < valB) return ascending ? -1 : 1;
        return 0;
      });
    }

    const fmtDate = d => {
      if (!d) return '<span class="small muted">—</span>';
      try {
        const dd = new Date(d);
        if (!isNaN(dd.getTime())) {
          return dd.toDateString() + " " + dd.toTimeString().split(" ")[0];
        }
      } catch (e) { }
      return escapeHtml(String(d).replace(/GMT.*$/, '').trim());
    };

    const pillSets = ["pill-alt1", "pill-alt2", "pill-alt3", "pill-alt4", "pill-alt5", "pill-alt6"];
    const pillWrap = (val, rowIndex, offset = 0) => {
      if (!val) return '<span class="small muted">—</span>';
      const cls = pillSets[(rowIndex + offset) % pillSets.length];
      return `<span class="pill ${cls}">${escapeHtml(val)}</span>`;
    };

    tbody.innerHTML = list.map((p, idx) => {
      const seller = this.data.sellers.find(s => s.ID === p.Seller);
      const sellerName = seller ? seller.Name : '—';

      const mode = (p.Mode || "Unknown").toLowerCase();
      let modeClass = "pill-unknown";
      if (mode === "sale") modeClass = "pill-sale";
      else if (mode === "rent") modeClass = "pill-rent";
      const modeCell = `<span class="pill ${modeClass}" style="cursor:pointer"
      title="Click to filter by Mode: ${escapeHtml(p.Mode || '')}"
      onclick="app.filterMode='${mode}'; app.renderProperties();">
      ${escapeHtml(p.Mode || "-")}</span>`;

      const type = (p.Type || "Unknown").toLowerCase();
      let typeClass = "pill-unknown";
      if (type === "apartment" || type === "flat") typeClass = "pill-apartment";
      else if (type === "villa") typeClass = "pill-villa";
      else if (type === "plot") typeClass = "pill-plot";
      else if (type === "office") typeClass = "pill-office";
      else if (type === "shop") typeClass = "pill-shop";
      const typeCell = `<span class="pill ${typeClass}" style="cursor:pointer"
      title="Click to filter by Type: ${escapeHtml(p.Type || '')}"
      onclick="app.filterType='${type}'; app.renderProperties();">
      ${escapeHtml(p.Type || "-")}</span>`;

      const price = Number(p.Price || 0);
      let priceClass = 'pill-amount-low';
      if (price >= 10000000) priceClass = 'pill-amount-high';
      else if (price >= 5000000) priceClass = 'pill-amount-mid';
      const priceCell = `<span class="pill ${priceClass}" title="₹ ${fmtCompactAmount(price)}">₹ ${fmt(price)}</span>`;

      const avail = (p.Availability || '').toLowerCase();
      let availClass = 'pill-unknown';
      if (avail === 'available') availClass = 'pill-available';
      else if (avail === 'sold') availClass = 'pill-sold';
      else if (avail === 'rented') availClass = 'pill-rented';
      const availCell = `<span class="pill ${availClass}">${escapeHtml(p.Availability || "-")}</span>`;

      const cityCell = pillWrap(p.City, idx, 0);
      const furnishingCell = pillWrap(p.Furnishing, idx, 1);
      const constructionCell = pillWrap(p.ConstructionStatus, idx, 2);
      const ageCell = pillWrap(p.Age, idx, 3);

      const actions = `
      <div style="white-space:nowrap; display:flex; gap:4px;">
        <button class="action-btn edit" title="View / Edit" onclick="app.openPropertyModal('${p.ID}')"><i data-lucide="edit-3"></i></button>
        <button class="action-btn delete" title="Delete" onclick="app.deleteProperty('${p.ID}')"><i data-lucide="trash-2"></i></button>
        <button class="action-btn whatsapp" title="Send WhatsApp" onclick="app.sendWhatsappForProperty('${p.ID}')"><i data-lucide="message-circle"></i></button>
      </div>`;

      return `<tr data-id="${p.ID}">
      <td>${escapeHtml(p.Title || '-')}</td>
      <td>${escapeHtml(p.FullAddress || '-')}</td>
      <td>${escapeHtml(p.Location || '-')}</td>
      <td>${cityCell}</td>
      <td>${typeCell}</td>
      <td>${modeCell}</td>
      <td>${escapeHtml(p.Size || '-')}</td>
      <td>${priceCell}</td>
      <td>${escapeHtml(p.Bedrooms || '-')}</td>
      <td>${escapeHtml(p.Bathrooms || '-')}</td>
      <td>${furnishingCell}</td>
      <td>${escapeHtml(p.Amenities || '-')}</td>
      <td>${escapeHtml(p.Facing || '-')}</td>
      <td>${constructionCell}</td>
      <td>${ageCell}</td>
      <td>${availCell}</td>
      <td>${escapeHtml(p.AssignedTo || '-')}</td>
      <td>${escapeHtml(p.Owner || '-')}</td>
      <td>${escapeHtml(sellerName)}</td>
      <td>${fmtDate(p.ListedDate)}</td>
      <td>${escapeHtml(p.MediaURLs || '-')}</td>
      <td>${escapeHtml(p.Remark || '-')}</td>
      <td class="actions">${actions}</td>
    </tr>`;
    }).join('');

    const thead = tbody.closest('table').querySelector('thead');
    thead.querySelectorAll('th[data-key]').forEach(th => {
      const key = th.dataset.key;
      th.style.cursor = 'pointer';
      th.onclick = () => {
        if (this.propertiesSortKey === key) {
          this.propertiesSortAsc = !this.propertiesSortAsc;
        } else {
          this.propertiesSortKey = key;
          this.propertiesSortAsc = true;
        }
        this.renderProperties();
      };
    });

    lucide.createIcons();
    // defer again
    setTimeout(() => {
      applyContextMenuIconColorsProperties();
    }, 0);

    attachPropertyContextMenu();
  },






  sendWhatsappForProperty(id) {
    const prop = this.data.properties.find(p => p.ID === id);
    if (!prop) return alert('Property not found');

    const message =
      `*🏠 Property Details:*

🏷️ Title: *${prop.Title || '-'}*
📍 Location: ${prop.City || '-'}, ${prop.Location || '-'}
📐 Size: ${prop.Size || '-'}
💼 Type: ${prop.Type || '-'}
📊 Mode: ${prop.Mode || '-'}
💰 Price: ₹ ${fmt(prop.Price)}
👤 Owner: ${prop.Owner || '-'}

📝 Remark: _${prop.Remark || '-'}_`;

    const payload = {
      instance_id: "68761C38A48AC",
      access_token: "685b00ae77342",
      number: "91" + (prop.OwnerPhone || "0000000000"),  // Provide fallback or correct field for owner phone
      message: message
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    };

    try {
      const response = UrlFetchApp.fetch("https://bdwamaster.site/api/send", options);
      alert('✅ WhatsApp message sent successfully!');
    } catch (e) {
      alert('❌ Failed to send WhatsApp message');
    }
  },




  clearPropertyFilters() {
    this.filterType = '';
    this.filterMode = '';
    this.renderProperties();
  },





  renderUpcoming() {
    const wrap = document.getElementById('followList');

    // Format date + time (AM/PM)
    const fmtDateTime = (val) => {
      if (!val) return '-';
      const d = new Date(val);
      if (isNaN(d.getTime())) return escapeHtml(val); // fallback
      return d.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    // Badge colors by type
    const typeColors = {
      Call: '#4CAF50',        // green
      Visit: '#2196F3',       // blue
      Meeting: '#9C27B0',     // purple
      Negotiation: '#FF9800', // orange
      Closed: '#009688',      // teal
      Lost: '#F44336'         // red
    };

    // Helper: days left / overdue
    const daysLeft = (due) => {
      const d = new Date(due);
      if (isNaN(d)) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0); // normalize
      return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    };

    const items = (this.data.tasks || [])
      .filter(t => t.Status === 'Open')
      .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate))
      .slice(0, 6);

    wrap.innerHTML = items.map(t => {
      const lead = this.leadById(t.LeadID);

      // Type badge
      const color = typeColors[t.Type] || '#607D8B';
      const badgeType = `<span 
      class="badge" 
      style="background:${color}; color:#fff; padding:2px 6px; border-radius:6px; font-size:12px; margin-left:6px; cursor:pointer"
      onclick="app.filterTasksByType('${t.Type}')">
      ${escapeHtml(t.Type)}
    </span>`;

      // Days badge
      const dLeft = daysLeft(t.DueDate);
      let dayColor = '#4CAF50'; // green by default
      let dayLabel = '';
      if (dLeft !== null) {
        if (dLeft < 0) {
          dayColor = '#F44336'; // red
          dayLabel = `${Math.abs(dLeft)}d overdue`;
        } else if (dLeft === 0) {
          dayColor = '#FF5722'; // deep orange
          dayLabel = 'Due today';
        } else if (dLeft <= 3) {
          dayColor = '#FF9800'; // orange
          dayLabel = `${dLeft}d left`;
        } else {
          dayColor = '#4CAF50'; // green
          dayLabel = `${dLeft}d left`;
        }
      }
      const badgeDays = dLeft !== null
        ? `<span 
       class="badge" 
       style="background:${dayColor}; color:#fff; padding:2px 6px; border-radius:6px; font-size:12px; margin-left:4px; cursor:pointer"
       onclick="app.filterTasksByDueWindow('${dLeft < 0 ? 'overdue' : dLeft === 0 ? 'today' : dLeft <= 3 ? 'soon' : 'later'}')">
       ${dayLabel}
     </span>`
        : '';

      return `
      <div class="chip" style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin:6px 0; width:100%">
        <span>
          ${fmtDateTime(t.DueDate)}${t.LeadID ? (' • ' + (lead?.Name || '')) : ''} 
          ${badgeType} ${badgeDays}
        </span>
        <button class="btn" style="padding:4px 8px" onclick="app.openTaskModal('${t.ID}')">Open</button>
      </div>
    `;
    }).join('') || '<div class="small muted">No upcoming follow-ups.</div>';
  },

  filterTasksByDueWindow(window) {
    const container = document.getElementById('followList');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const classify = (t) => {
      const d = new Date(t.DueDate);
      if (isNaN(d)) return 'other';
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      if (diff < 0) return 'overdue';
      if (diff === 0) return 'today';
      if (diff <= 3) return 'soon';
      return 'later';
    };

    const list = (this.data.tasks || [])
      .filter(t => t.Status === 'Open' && classify(t) === window)
      .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate));

    if (list.length === 0) {
      container.innerHTML = `
      <div class="panel fade-in">
        <div class="small muted">No ${window} tasks found.</div>
        <div style="text-align:right; margin-top:8px">
          <button class="btn" onclick="app.clearTaskFilter()">Clear Filter</button>
        </div>
      </div>`;
      return;
    }

    const rows = list.slice(0, 5).map(t => {
      const lead = this.leadById(t.LeadID);
      const prop = this.propertyById(t.PropertyID);
      return `
      <tr>
        <td>${escapeHtml(t.DueDate || '-')}</td>
        <td>${escapeHtml(t.Type || '-')}</td>
        <td>${lead ? escapeHtml(lead.Name) : '—'}</td>
        <td>${prop ? escapeHtml(prop.Title) : '—'}</td>
        <td>${escapeHtml(t.Notes || '')}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="panel fade-in">
      <strong>Tasks — ${window.toUpperCase()} (preview)</strong>
      <table>
        <thead>
          <tr><th>Due</th><th>Type</th><th>Lead</th><th>Property</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px">
        <button class="btn" onclick="app.jumpToTasks()">View All →</button>
        <button class="btn" onclick="app.clearTaskFilter()">Clear Filter</button>
      </div>
    </div>
  `;
  },


  filterTasksByType(type) {
    const container = document.getElementById('followList');
    if (!container) return;

    const list = (this.data.tasks || [])
      .filter(t => t.Type === type && t.Status === 'Open')
      .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate));

    if (list.length === 0) {
      container.innerHTML = `
      <div class="panel fade-in">
        <div class="small muted">No ${escapeHtml(type)} tasks found.</div>
        <div style="text-align:right; margin-top:8px">
          <button class="btn" onclick="app.clearTaskFilter()">Clear Filter</button>
        </div>
      </div>`;
      return;
    }

    const rows = list.slice(0, 5).map(t => {
      const lead = this.leadById(t.LeadID);
      const prop = this.propertyById(t.PropertyID);
      return `
      <tr>
        <td>${escapeHtml(t.DueDate || '-')}</td>
        <td>${escapeHtml(t.Type || '-')}</td>
        <td>${lead ? escapeHtml(lead.Name) : '—'}</td>
        <td>${prop ? escapeHtml(prop.Title) : '—'}</td>
        <td>${escapeHtml(t.Notes || '')}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="panel fade-in">
      <strong>${escapeHtml(type)} Tasks (preview)</strong>
      <table>
        <thead>
          <tr><th>Due</th><th>Type</th><th>Lead</th><th>Property</th><th>Notes</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px">
        <button class="btn" onclick="app.jumpToTasks('${type}')">View All →</button>
        <button class="btn" onclick="app.clearTaskFilter()">Clear Filter</button>
      </div>
    </div>
  `;
  },

  clearTaskFilter() {
    const container = document.getElementById('followList');
    container.classList.add('fade-in');
    this.renderUpcoming();
  },


  /* Charts */
  _charts: {},
  _chartsState: {},   // track last state to avoid redundant updates

  renderCharts() {
    console.trace("🔄 renderCharts called");
    console.log("🔄 renderCharts called");

    const leads = this.data.leads || [];

    // --- Lead Source Counts ---
    const srcCounts = {};
    leads.forEach(l => {
      srcCounts[l.Source || 'Other'] = (srcCounts[l.Source || 'Other'] || 0) + 1;
    });

    // --- Lead Status Counts ---
    const statusCounts = {};
    leads.forEach(l => {
      statusCounts[l.Status || 'New'] = (statusCounts[l.Status || 'New'] || 0) + 1;
    });

    // --- Funnel Progress ---
    const closed = leads.filter(l => l.Status === 'Closed').length;
    const total = leads.length || 1;
    const funnelPct = Math.round((closed / total) * 100);
    const funnelBar = document.getElementById('funnelProgress');
    if (funnelBar) {
      funnelBar.style.width = funnelPct + '%';
      funnelBar.style.transition = 'width 600ms ease, background 400ms ease';

      if (funnelPct < 30) {
        funnelBar.style.background = "linear-gradient(90deg, #ef4444, #b91c1c)";
      } else if (funnelPct < 70) {
        funnelBar.style.background = "linear-gradient(90deg, #f59e0b, #b45309)";
      } else {
        funnelBar.style.background = "linear-gradient(90deg, #10b981, #047857)";
      }
    }

    // --- Contexts ---
    const srcCtx = document.getElementById('chartSource');
    const statCtx = document.getElementById('chartStatus');

    // --- Color palette ---
    const palette = [
      "#6366f1", "#06b6d4", "#10b981", "#f59e0b",
      "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"
    ];

    // --- Signatures to skip redundant updates ---
    const sigSrc = JSON.stringify(Object.entries(srcCounts).sort());
    const sigStat = JSON.stringify(Object.entries(statusCounts).sort());

    this._chartsState = this._chartsState || {};

    // --- Lead Source Donut ---
    if (srcCtx) {
      if (!this._charts.src) {
        this._charts.src = new Chart(srcCtx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(srcCounts),
            datasets: [{
              data: Object.values(srcCounts),
              backgroundColor: palette,
              borderWidth: 2,
              borderColor: "#111827"
            }]
          },
          options: {
            cutout: "60%",
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: "#9aa4b2" }
              }
            }
          }
        });
        console.log("🎨 Created chart: src");
      } else if (this._chartsState.srcSig !== sigSrc) {
        this._charts.src.data.labels = Object.keys(srcCounts);
        this._charts.src.data.datasets[0].data = Object.values(srcCounts);
        this._charts.src.update();
        console.log("♻️ Updated chart: src");
      }
      this._chartsState.srcSig = sigSrc;
    }

    // --- Lead Status Bar ---
    if (statCtx) {
      const colors = Object.keys(statusCounts).map((_, i) => palette[i % palette.length]);

      if (!this._charts.stat) {
        this._charts.stat = new Chart(statCtx, {
          type: 'bar',
          data: {
            labels: Object.keys(statusCounts),
            datasets: [{
              data: Object.values(statusCounts),
              backgroundColor: colors,
              borderRadius: 10
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: {
                ticks: { color: "#9aa4b2" },
                grid: { display: false }
              },
              y: {
                ticks: { color: "#9aa4b2" },
                grid: { color: "rgba(255,255,255,0.05)" }
              }
            }
          }
        });
        console.log("🎨 Created chart: stat");
      } else if (this._chartsState.statSig !== sigStat) {
        this._charts.stat.data.labels = Object.keys(statusCounts);
        this._charts.stat.data.datasets[0].data = Object.values(statusCounts);
        this._charts.stat.data.datasets[0].backgroundColor = colors;
        this._charts.stat.update();
        console.log("♻️ Updated chart: stat");
      }
      this._chartsState.statSig = sigStat;
    }

    // --- Leads (Last 7 Days) Line Chart ---
    // ⛔️ Removed from here (will be handled by app.renderReport_leadSourcePerformance)

    console.log("✅ renderCharts finished");
  },





  /* Search */
  onSearch() {
    this.searchText = document.getElementById('globalSearch').value || '';
    if (this.currentView === 'leads') this.renderLeads();
    if (this.currentView === 'properties') this.renderProperties();
    if (this.currentView === 'tasks') this.renderTasks();
  },

  /* ===== CRUD helpers that call remote API and then reload or refresh partials ===== */

  leadById(id) { return this.data.leads.find(l => l.ID === id); },
  propertyById(id) { return this.data.properties.find(p => p.ID === id); },
  leadIndexById(id) { return this.data.leads.findIndex(l => l.ID === id); },



  /* --- Leads CRUD --- */
  /* --- openLeadModal(id) --- */
  openLeadModal(id) {
    const l = id ? this.leadById(id) || {} : {
      ID: '', BuyerID: '', Name: '', Phone: '', Email: '', Location: '', City: '',
      PropertyType: 'Flat', Budget: '', Purpose: '', Source: 'Website',
      Remark: '', Status: 'New', PropertyID: '', "Followups (JSON)": '[]',
      Priority: '', Agent: '', BuyingWindow: '', Occupation: '', FinancingType: '',
      LeadDate: '', NextFollowupDate: '', LeadScore: 0
    };

    const propOptions = ['<option value="">— None —</option>']
      .concat((this.data.properties || []).map(p =>
        `<option value="${p.ID}" ${p.ID === l.PropertyID ? 'selected' : ''}>${escapeHtml(p.Title || p.Ref || p.ID)}</option>`
      )).join('');

    const html = `<h3>${id ? 'Edit Lead' : 'New Lead'}</h3>
  <div class="flex" style="flex-wrap:wrap; gap:10px;">
    <div style="flex:1; min-width:200px"><label>Name</label><input id="lead-name" value="${escapeHtml(l.Name || '')}" class="validate-required" /></div>
    <div style="flex:1; min-width:200px"><label>Phone</label><input id="lead-phone" value="${escapeHtml(l.Phone || '')}" class="validate-phone" /></div>
    <div style="flex:1; min-width:200px"><label>Email</label><input id="lead-email" value="${escapeHtml(l.Email || '')}" class="validate-email" /></div>
    <div style="flex:1; min-width:200px"><label>City</label><input id="lead-city" value="${escapeHtml(l.City || '')}" data-list-id="lead-city-list" /></div>
    <div style="flex:1; min-width:200px"><label>Location</label><input id="lead-location" value="${escapeHtml(l.Location || '')}" data-list-id="lead-location-list" /></div>
    <div style="flex:1; min-width:200px"><label>Purpose</label><input id="lead-purpose" value="${escapeHtml(l.Purpose || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Type</label>
      <select id="lead-type" data-list-id="lead-type-list">
        <option ${l.PropertyType === 'Flat' ? 'selected' : ''}>Flat</option>
        <option ${l.PropertyType === 'Office' ? 'selected' : ''}>Office</option>
        <option ${l.PropertyType === 'Shop' ? 'selected' : ''}>Shop</option>
        <option ${l.PropertyType === 'Plot' ? 'selected' : ''}>Plot</option>
      </select>
    </div>

    <div style="flex:1; min-width:200px">
      <label>Budget</label>
      <input type="number" id="lead-budget" value="${escapeHtml(l.Budget || '')}" />
      <div id="lead-budget-label" style="font-size:12px; color:red; margin-top:2px;"></div>
    </div>

    <div style="flex:1; min-width:200px"><label>Source</label>
      <select id="lead-source">
        <option ${l.Source === 'Website' ? 'selected' : ''}>Website</option>
        <option ${l.Source === 'Facebook' ? 'selected' : ''}>Facebook</option>
        <option ${l.Source === 'Referral' ? 'selected' : ''}>Referral</option>
        <option ${l.Source === 'WhatsApp' ? 'selected' : ''}>WhatsApp</option>
      </select>
    </div>

    <div style="flex:1; min-width:200px"><label>Priority</label>
      <select id="lead-priority">
        <option ${!l.Priority ? 'selected' : ''}></option>
        <option ${l.Priority === 'Hot' ? 'selected' : ''}>Hot</option>
        <option ${l.Priority === 'Warm' ? 'selected' : ''}>Warm</option>
        <option ${l.Priority === 'Cold' ? 'selected' : ''}>Cold</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Agent</label><input id="lead-agent" value="${escapeHtml(l.Agent || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Financing Type</label>
      <select id="lead-financing">
        <option ${!l.FinancingType ? 'selected' : ''}></option>
        <option ${l.FinancingType === 'Home Loan' ? 'selected' : ''}>Home Loan</option>
        <option ${l.FinancingType === 'Cash' ? 'selected' : ''}>Cash</option>
        <option ${l.FinancingType === 'Other' ? 'selected' : ''}>Other</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Buying Window</label>
      <select id="lead-buying">
        <option ${!l.BuyingWindow ? 'selected' : ''}></option>
        <option ${l.BuyingWindow === 'Immediate' ? 'selected' : ''}>Immediate</option>
        <option ${l.BuyingWindow === '3 months' ? 'selected' : ''}>3 months</option>
        <option ${l.BuyingWindow === '6 months' ? 'selected' : ''}>6 months</option>
        <option ${l.BuyingWindow === '1 year' ? 'selected' : ''}>1 year</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Occupation</label><input id="lead-occupation" value="${escapeHtml(l.Occupation || '')}" /></div>

    <div style="flex:1; min-width:200px"><label>Linked Property</label><select id="lead-prop">${propOptions}</select></div>
    <div style="flex:1; min-width:200px"><label>Next Follow-up</label><input type="date" id="lead-nextfollow" value="${escapeHtml(l.NextFollowupDate || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Lead Date</label><input type="date" id="lead-leaddate" value="${escapeHtml(l.LeadDate || '')}" /></div>

    <div style="flex:1; min-width:200px"><label>Lead Score</label><input id="lead-score" value="${escapeHtml(l.LeadScore || 0)}" readonly /></div>

    <div style="grid-column:span2"><label>Remark</label><input id="lead-remark" value="${escapeHtml(l.Remark || '')}" /></div>

    <!-- Bulk CSV upload -->
    <div style="flex:1; min-width:200px; margin-top:10px">
      <label>Bulk Upload CSV</label>
      <input type="file" class="bulk-upload" accept=".csv" />
    </div>
  </div>

  <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
    ${id ? `<button class="btn" onclick="app.openFollowup('${id}')">Follow-ups</button>` : ''}
    <button class="btn" onclick="app.saveLead('${id || ''}')">Save</button>
    <button class="btn" onclick="app.closeModal()">Close</button>
  </div>`;

    this.openModal(html);

    const modalRoot = document.getElementById('modalContent');

    // -------------------
    // Live Budget Label
    // -------------------
    const budgetInput = modalRoot.querySelector('#lead-budget');
    const budgetLabel = modalRoot.querySelector('#lead-budget-label');
    const formatBudgetLabel = (num) => {
      if (!num || isNaN(num)) return '';
      num = Number(num);
      if (num >= 10000000) return (num / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
      if (num >= 100000) return (num / 100000).toFixed(2).replace(/\.00$/, '') + ' Lac';
      if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.00$/, '') + ' K';
      return num.toString();
    };
    budgetInput.addEventListener('input', () => budgetLabel.textContent = formatBudgetLabel(budgetInput.value));
    budgetLabel.textContent = formatBudgetLabel(budgetInput.value);

    // -------------------
    // Apply Enhancements
    // -------------------
    ModalEnhancements.applyToModal(modalRoot, {
      locations: [...new Set(this.data.properties.map(p => p.Location).filter(Boolean))],
      cities: [...new Set(this.data.properties.map(p => p.City).filter(Boolean))],
      propertyTypes: ['Flat', 'Office', 'Shop', 'Plot']
    }, (rows) => {
      console.log('Imported CSV rows:', rows);
      // Optional: Map CSV data to modal fields or call saveLead()
    });
  },



  /* --- saveLead(id) --- */
  async saveLead(id) {
    const l = {
      ID: id || '',
      Name: document.getElementById('lead-name').value.trim(),
      Phone: document.getElementById('lead-phone').value.trim(),
      Email: document.getElementById('lead-email').value.trim(),
      Location: document.getElementById('lead-location').value.trim(),
      City: document.getElementById('lead-city').value.trim(),
      Purpose: document.getElementById('lead-purpose').value.trim(),
      PropertyType: document.getElementById('lead-type').value,
      Budget: document.getElementById('lead-budget').value.trim(),
      Source: document.getElementById('lead-source').value,
      Status: 'New',
      PropertyID: document.getElementById('lead-prop').value,
      Remark: document.getElementById('lead-remark').value.trim(),
      Priority: document.getElementById('lead-priority').value,
      Agent: document.getElementById('lead-agent').value.trim(),
      FinancingType: document.getElementById('lead-financing').value,
      BuyingWindow: document.getElementById('lead-buying').value,
      Occupation: document.getElementById('lead-occupation').value.trim(),
      NextFollowupDate: document.getElementById('lead-nextfollow').value,
      LeadDate: document.getElementById('lead-leaddate').value || new Date().toISOString().slice(0, 10),
      LeadScore: Number(document.getElementById('lead-score').value || 0),
    };

    try {
      if (id) {
        await remote.update('Leads', l);
      } else {
        const res = await remote.add('Leads', l);
        // Use extractId helper to get backend-assigned ID reliably
        l.ID = extractId(res) || l.ID;
      }

      await this.reloadFromServer();
      this.closeModal();
      this.renderLeads();
      safeNotify(`Lead "${l.Name || l.Phone || l.ID}" saved`, 'success');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to save lead', 'error');
      alert('Save failed: ' + (e.message || e));
    }
  },




  async deleteLead(id) {
    if (!confirm('Delete this lead?')) return;

    function safeNotify(msg, type = 'info') {
      try {
        if (typeof addNotification === 'function') {
          addNotification(msg, type);
          return;
        }
        if (window.app && window.app.notifications) {
          window.app.notifications.list.unshift({
            id: Date.now(),
            msg,
            type,
            read: false
          });
          window.app.notifications.unread =
            (window.app.notifications.unread || 0) + 1;
          if (typeof renderNotifications === 'function') renderNotifications();
          return;
        }
        console.info('Notification:', type, msg);
      } catch (e) {
        console.warn('safeNotify failed', e);
      }
    }

    try {
      // capture lead info before deleting
      const lead = this.leadById(id);
      const leadLabel = lead
        ? (lead.Name || lead.Phone || `ID ${id}`)
        : `ID ${id}`;

      await remote.delete('Leads', id);
      await this.reloadFromServer();
      this.renderLeads();
      this.renderTasks();

      // success notification with name/phone/id
      safeNotify(`Lead "${leadLabel}" deleted`, 'warn');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to delete lead', 'error');
      alert('Delete failed: ' + (e && e.message ? e.message : e));
    }
  },


  /* Follow-ups timeline */
  openFollowup(id) {
    const l = this.leadById(id);

    // ✅ Use the exact sheet header name
    const followups = (l["Followups (JSON)"] && l["Followups (JSON)"].trim())
      ? tryParseJSON(l["Followups (JSON)"])
      : [];

    const items = followups.map((f, i) => `
    <div class="panel" style="margin:8px 0">
      <div><strong>${escapeHtml(f.date)}</strong> • ${escapeHtml(f.outcome || '')}</div>
      <div class="small">${escapeHtml(f.note || '')}</div>
      <div style="text-align:right; margin-top:6px">
        <button class="btn" onclick="app.removeFollowup('${id}', ${i})">Remove</button>
      </div>
    </div>`
    ).join('') || '<div class="small muted">No follow-ups yet.</div>';

    const html = `
    <h3>Follow-ups — ${escapeHtml(l.Name)}</h3>
    ${items}
    <div class="panel">
      <div class="flex" style="flex-wrap:wrap">
        <div>
          <label>Date</label>
          <input type="date" id="fu-date" value="${today()}" />
        </div>
        <div>
          <label>Outcome</label>
          <select id="fu-outcome">
            <option>Contacted</option>
            <option>Planned</option>
            <option>Site Visit</option>
            <option>Negotiation</option>
            <option>Closed</option>
            <option>Lost</option>
          </select>
        </div>
      </div>
      <label>Notes</label>
      <textarea id="fu-note" placeholder="Call summary, next steps..."></textarea>
      <div style="text-align:right; margin-top:8px">
        <button class="btn" onclick="app.addFollowup('${id}')">Add</button>
      </div>
    </div>
    <div style="text-align:right">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>`;

    this.openModal(html);
  },

  async addFollowup(id) {
    const l = this.leadById(id);

    const entry = {
      date: document.getElementById('fu-date').value || today(),
      outcome: document.getElementById('fu-outcome').value,
      note: document.getElementById('fu-note').value.trim()
    };

    // ✅ Parse from correct key
    const followups = (l["Followups (JSON)"] && l["Followups (JSON)"].trim())
      ? tryParseJSON(l["Followups (JSON)"])
      : [];

    followups.unshift(entry);

    // ✅ Save back into the same key
    l["Followups (JSON)"] = JSON.stringify(followups);

    // optionally create a task for "Planned"
    if (entry.outcome === 'Planned') {
      const t = {
        ID: '',
        DueDate: entry.date,
        Type: 'Call',
        Status: 'Open',
        LeadID: id,
        PropertyID: l.PropertyID || '',
        Notes: entry.note
      };
      await remote.add('Tasks', t);
    }

    await remote.update('Leads', l);
    await this.reloadFromServer();
    this.openFollowup(id);
    this.renderLeads();
    this.renderTasks();
  },


  async removeFollowup(id, idx) {
    const l = this.leadById(id);
    if (!l) {
      console.error('Lead not found', id);
      return;
    }

    // Try to read followups from the correct column name; also tolerate older key if present
    let followups = [];
    try {
      followups = tryParseJSON(l["Followups (JSON)"] || l.Followups || "[]");
    } catch (e) {
      followups = [];
    }

    if (!Array.isArray(followups) || followups.length === 0) {
      showToast('No follow-ups to remove.', 'warning');
      this.openFollowup(id);
      return;
    }

    if (idx < 0 || idx >= followups.length) {
      showToast('Invalid follow-up index.', 'error');
      return;
    }

    followups.splice(idx, 1);

    // Write back into the exact header key
    l["Followups (JSON)"] = JSON.stringify(followups);

    try {
      await remote.update('Leads', l);
      await this.reloadFromServer();
      this.openFollowup(id);
      this.renderLeads();
    } catch (err) {
      console.error('removeFollowup failed', err);
      alert('Failed to remove follow-up: ' + err.message);
    }
  },


  /* --- Properties CRUD --- */

  openPropertyModal(id) {
    const p = id ? this.propertyById(id) : {
      ID: '', Seller: '', Title: '', FullAddress: '', Location: '', City: '',
      Type: 'Flat', Mode: 'Sale', Size: '', Price: '', Bedrooms: '', Bathrooms: '',
      Furnishing: '', Amenities: '', Facing: '', ConstructionStatus: '',
      Age: '', Availability: 'Available', AssignedTo: '', Owner: '',
      ListedDate: new Date().toISOString().slice(0, 10), MediaURLs: '', Remark: ''
    };

    const sellerOptions = this.data.sellers.map(s =>
      `<option value="${s.ID}" ${p.Seller === s.ID ? 'selected' : ''}>
      ${escapeHtml(s.Name)} (${escapeHtml(s.Phone)})
    </option>`
    ).join('');

    const html = `<h3>${id ? 'Edit Property' : 'New Property'}</h3>
  <div class="flex" style="flex-wrap:wrap">
    <div style="flex:1; min-width:200px"><label>Title</label><input id="p-title" value="${escapeHtml(p.Title || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Full Address</label><input id="p-address" value="${escapeHtml(p.FullAddress || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Location</label><input id="p-location" value="${escapeHtml(p.Location || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>City</label><input id="p-city" value="${escapeHtml(p.City || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Type</label>
      <select id="p-type">
        <option ${p.Type === 'Flat' ? 'selected' : ''}>Flat</option>
        <option ${p.Type === 'Villa' ? 'selected' : ''}>Villa</option>
        <option ${p.Type === 'Office' ? 'selected' : ''}>Office</option>
        <option ${p.Type === 'Shop' ? 'selected' : ''}>Shop</option>
        <option ${p.Type === 'Plot' ? 'selected' : ''}>Plot</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Mode</label>
      <select id="p-mode">
        <option ${p.Mode === 'Sale' ? 'selected' : ''}>Sale</option>
        <option ${p.Mode === 'Rent' ? 'selected' : ''}>Rent</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Size</label><input id="p-size" value="${escapeHtml(p.Size || '')}" /></div>

    <!-- Price with formatted label -->
    <div style="flex:1; min-width:200px">
      <label>Price</label>
      <input type="number" id="p-price" value="${escapeHtml(p.Price || '')}" />
      <div id="p-price-label" style="font-size:12px; color:red; margin-top:2px;"></div>
    </div>

    <div style="flex:1; min-width:200px"><label>Bedrooms</label><input type="number" id="p-bedrooms" value="${escapeHtml(p.Bedrooms || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Bathrooms</label><input type="number" id="p-bathrooms" value="${escapeHtml(p.Bathrooms || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Furnishing</label>
      <select id="p-furnishing">
        <option ${p.Furnishing === 'Furnished' ? 'selected' : ''}>Furnished</option>
        <option ${p.Furnishing === 'Semi' ? 'selected' : ''}>Semi</option>
        <option ${p.Furnishing === 'Unfurnished' ? 'selected' : ''}>Unfurnished</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Amenities</label><input id="p-amenities" value="${escapeHtml(p.Amenities || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Facing</label><input id="p-facing" value="${escapeHtml(p.Facing || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Construction Status</label><input id="p-const" value="${escapeHtml(p.ConstructionStatus || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Age (years)</label><input id="p-age" value="${escapeHtml(p.Age || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Availability</label>
      <select id="p-availability">
        <option ${p.Availability === 'Available' ? 'selected' : ''}>Available</option>
        <option ${p.Availability === 'Sold' ? 'selected' : ''}>Sold</option>
        <option ${p.Availability === 'Rented' ? 'selected' : ''}>Rented</option>
      </select>
    </div>
    <div style="flex:1; min-width:200px"><label>Assigned To</label><input id="p-assigned" value="${escapeHtml(p.AssignedTo || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Owner</label><input id="p-owner" value="${escapeHtml(p.Owner || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Seller</label><select id="p-seller">${sellerOptions}</select></div>
    <div style="flex:1; min-width:200px"><label>Listed Date</label><input type="date" id="p-listed" value="${escapeHtml(p.ListedDate || new Date().toISOString().slice(0, 10))}" /></div>
    <div style="flex:1; min-width:200px"><label>Media URLs</label><input id="p-media" value="${escapeHtml(p.MediaURLs || '')}" /></div>
    <div style="flex:1; min-width:200px"><label>Remark</label><input id="p-remark" value="${escapeHtml(p.Remark || '')}" /></div>
  </div>
  <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
    <button class="btn" onclick="app.saveProperty('${id || ''}')">Save</button>
    <button class="btn" onclick="app.closeModal()">Close</button>
  </div>`;
    this.openModal(html);

    // 🔹 helper for formatted numbers
    const formatPriceLabel = (num) => {
      if (!num || isNaN(num)) return '';
      num = Number(num);
      if (num >= 10000000) return (num / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
      if (num >= 100000) return (num / 100000).toFixed(2).replace(/\.00$/, '') + ' Lac';
      if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.00$/, '') + ' K';
      return num.toString();
    };

    // 🔹 live update
    const priceInput = document.getElementById('p-price');
    const priceLabel = document.getElementById('p-price-label');
    const updateLabel = () => { priceLabel.textContent = formatPriceLabel(priceInput.value); };
    priceInput.addEventListener('input', updateLabel);
    updateLabel(); // run once for prefilled values
  },







  async saveProperty(id) {
    const p = {
      ID: id || '',
      Seller: document.getElementById('p-seller').value || '',
      Title: document.getElementById('p-title').value.trim(),
      FullAddress: document.getElementById('p-address').value.trim(),
      Location: document.getElementById('p-location').value.trim(),
      City: document.getElementById('p-city').value.trim(),
      Type: document.getElementById('p-type').value,
      Mode: document.getElementById('p-mode').value,
      Size: document.getElementById('p-size').value.trim(),
      Price: document.getElementById('p-price').value.trim(),
      Bedrooms: document.getElementById('p-bedrooms').value || '',
      Bathrooms: document.getElementById('p-bathrooms').value || '',
      Furnishing: document.getElementById('p-furnishing').value,
      Amenities: document.getElementById('p-amenities').value.trim(),
      Facing: document.getElementById('p-facing').value.trim(),
      ConstructionStatus: document.getElementById('p-const').value.trim(),
      Age: document.getElementById('p-age').value || '',
      Availability: document.getElementById('p-availability').value,
      AssignedTo: document.getElementById('p-assigned').value.trim(),
      Owner: document.getElementById('p-owner').value.trim(),
      ListedDate: document.getElementById('p-listed').value || new Date().toISOString().slice(0, 10),
      MediaURLs: document.getElementById('p-media').value.trim(),
      Remark: document.getElementById('p-remark').value.trim()
    };

    try {
      if (id) {
        await remote.update('Properties', p);
      } else {
        const res = await remote.add('Properties', p);
        p.ID = extractId(res) || p.ID;
      }
      await this.reloadFromServer();
      this.closeModal();
      this.renderProperties();
      safeNotify(`Property "${formatLabel(p, p.ID)}" saved`, 'success');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to save property', 'error');
      alert('Save failed: ' + (e.message || e));
    }
  },






  async deleteProperty(id) {
    if (!confirm('Delete this property?')) return;
    try {
      const prop = this.propertyById ? this.propertyById(id) : null;
      await remote.delete('Properties', id);
      await this.reloadFromServer();
      this.renderProperties();
      this.renderLeads();

      safeNotify(`Property "${formatLabel(prop, id)}" deleted`, 'warn');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to delete property', 'error');
      alert('Delete failed: ' + (e.message || e));
    }
  },




  /* ---------- openTaskModal ---------- */
  openTaskModal(id) {
    const getField = (obj, keys) => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
          return obj[k];
        }
      }
      return '';
    };

    const existing = id ? (this.data.tasks.find(x => x.ID === id) || {}) : {};
    const t = {
      ID: existing.ID || '',
      DueDate: getField(existing, ['DueDate', 'Due']) || today(),
      Type: getField(existing, ['Type', 'TaskType']) || '',   // 🔑 don’t force Call here
      Status: getField(existing, ['Status', 'TaskStatus']) || '',
      Priority: getField(existing, ['Priority']) || '',
      LeadID: getField(existing, ['LeadID']) || '',
      PropertyID: getField(existing, ['PropertyID']) || '',
      AssignedTo: getField(existing, ['AssignedTo']) || '',
      CreatedBy: getField(existing, ['CreatedBy']) || '',
      ReminderTime: getField(existing, ['ReminderTime']) || '',
      Outcome: getField(existing, ['Outcome']) || '',
      NextAction: getField(existing, ['NextAction']) || '',
      Category: getField(existing, ['Category']) || '',
      Attachments: getField(existing, ['Attachments']) || '',
      Notes: getField(existing, ['Notes']) || ''
    };

    const leadOpts = ['<option value="">—</option>']
      .concat((this.data.leads || []).map(l =>
        `<option value="${l.ID}">${escapeHtml(l.Name || l.Phone || l.ID)}</option>`))
      .join('');

    const propOpts = ['<option value="">—</option>']
      .concat((this.data.properties || []).map(p =>
        `<option value="${p.ID}">${escapeHtml(p.Title || p.Ref || p.ID)}</option>`))
      .join('');

    const html = `<h3>${id ? 'Edit Task' : 'New Task'}</h3>
  <div class="flex" style="flex-wrap:wrap; gap:8px;">
    <div style="flex:1; min-width:160px"><label>Due</label><input type="date" id="t-due" /></div>

    <div style="flex:1; min-width:160px"><label>Type</label>
      <select id="t-type">
        <option value="">—</option>
        <option value="Call">Call</option>
        <option value="Meeting">Meeting</option>
        <option value="Site Visit">Site Visit</option>
        <option value="Note">Note</option>
      </select>
    </div>

    <div style="flex:1; min-width:160px"><label>Status</label>
      <select id="t-status">
        <option value="">—</option>
        <option value="Open">Open</option>
        <option value="Done">Done</option>
        <option value="Rescheduled">Rescheduled</option>
        <option value="Closed">Closed</option>
      </select>
    </div>

    <div style="flex:1; min-width:160px"><label>Priority</label>
      <select id="t-priority">
        <option value="">—</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
    </div>

    <div style="flex:1; min-width:160px"><label>Lead</label><select id="t-lead">${leadOpts}</select></div>
    <div style="flex:1; min-width:160px"><label>Property</label><select id="t-prop">${propOpts}</select></div>

    <div style="flex:1; min-width:160px"><label>Assigned To</label><input id="t-assigned" value="${escapeHtml(t.AssignedTo)}" /></div>
    <div style="flex:1; min-width:160px"><label>Created By</label><input id="t-created" value="${escapeHtml(t.CreatedBy)}" /></div>
    <div style="flex:1; min-width:160px"><label>Reminder</label><input id="t-reminder" value="${escapeHtml(t.ReminderTime)}" /></div>
    <div style="flex:1; min-width:160px"><label>Category</label><input id="t-category" value="${escapeHtml(t.Category)}" /></div>
    <div style="flex:1; min-width:160px"><label>Outcome</label><input id="t-outcome" value="${escapeHtml(t.Outcome)}" /></div>
    <div style="flex:1; min-width:160px"><label>Next Action</label><input id="t-next" value="${escapeHtml(t.NextAction)}" /></div>
    <div style="flex:1; min-width:160px"><label>Attachments</label><input id="t-attach" value="${escapeHtml(t.Attachments)}" /></div>
  </div>

  <label>Notes</label><textarea id="t-notes">${escapeHtml(t.Notes)}</textarea>

  <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
    <button class="btn" id="btn-save">Save</button>
    <button class="btn" id="btn-close">Close</button>
  </div>`;

    this.openModal(html);

    const modalRoot = document.getElementById('modalContent');
    const $ = sel => modalRoot.querySelector(sel);

    if ($('#t-due')) $('#t-due').value = formatDateForInput(t.DueDate) || today();
    if ($('#t-type')) $('#t-type').value = t.Type || '';
    if ($('#t-status')) $('#t-status').value = t.Status || '';
    if ($('#t-priority')) $('#t-priority').value = t.Priority || '';

    if ($('#t-lead')) $('#t-lead').value = t.LeadID || '';
    if ($('#t-prop')) $('#t-prop').value = t.PropertyID || '';

    if ($('#t-assigned')) $('#t-assigned').value = t.AssignedTo || '';
    if ($('#t-created')) $('#t-created').value = t.CreatedBy || '';
    if ($('#t-reminder')) $('#t-reminder').value = t.ReminderTime || '';
    if ($('#t-category')) $('#t-category').value = t.Category || '';
    if ($('#t-outcome')) $('#t-outcome').value = t.Outcome || '';
    if ($('#t-next')) $('#t-next').value = t.NextAction || '';
    if ($('#t-attach')) $('#t-attach').value = t.Attachments || '';
    if ($('#t-notes')) $('#t-notes').value = t.Notes || '';

    const saveBtn = $('#btn-save'); const closeBtn = $('#btn-close');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveTask(t.ID));
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
  },




  /* ---------- saveTask ---------- */
  renderTasks() {
    console.log("🔎 renderTasks() called, tasks length =", (this.data.tasks || []).length);

    const tbody = document.getElementById('tasksTable');
    const tStatus = (document.getElementById('t-status')?.value) || this.filterTaskStatus || '';
    const tType = (document.getElementById('t-type')?.value) || this.filterTaskType || '';
    const q = (this.searchText || '').toLowerCase();

    const getField = (obj, keys) => {
      for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
          return obj[k];
        }
      }
      return '';
    };

    const fmtDateTime = (val) => {
      if (!val) return '—';
      const d = new Date(val);
      if (isNaN(d.getTime())) return escapeHtml(val);
      return d.toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    };

    // pill filters
    const filterContainer = document.getElementById('taskActiveFilters');
    if (filterContainer) filterContainer.innerHTML = '';
    if (tStatus) {
      const pill = document.createElement('span');
      pill.className = 'pill pill-status-active';
      pill.innerHTML = `${escapeHtml(tStatus)} <span style="margin-left:4px;cursor:pointer;" onclick="document.getElementById('t-status').value=''; app.renderTasks();">✕</span>`;
      filterContainer.appendChild(pill);
    }
    if (tType) {
      const pill = document.createElement('span');
      pill.className = 'pill pill-type-active';
      pill.innerHTML = `${escapeHtml(tType)} <span style="margin-left:4px;cursor:pointer;" onclick="document.getElementById('t-type').value=''; app.renderTasks();">✕</span>`;
      filterContainer.appendChild(pill);
    }

    // filter list
    let list = (this.data.tasks || []).filter(task => {
      const statusVal = getField(task, ['Status', 'TaskStatus', 'task_status']);
      const typeVal = getField(task, ['Type', 'TaskType', 'type']);
      const okStatus = !tStatus || String(statusVal) === String(tStatus);
      const okType = !tType || String(typeVal) === String(tType);

      const hay = [
        getField(task, ['Notes', 'notes']),
        getField(task, ['AssignedTo']),
        getField(task, ['CreatedBy']),
        getField(task, ['Category']),
        getField(task, ['Outcome']),
        getField(task, ['NextAction']),
        getField(task, ['Attachments'])
      ].join(' ').toLowerCase();

      const okQ = !q || hay.includes(q) || (getField(task, ['LeadID']) + ' ' + getField(task, ['PropertyID'])).toLowerCase().includes(q);
      return okStatus && okType && okQ;
    });

    // sort
    if (this.tasksSortKey) {
      const key = this.tasksSortKey;
      const asc = !!this.tasksSortAsc;
      list.sort((a, b) => {
        let va = a[key] ?? '';
        let vb = b[key] ?? '';
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('due')) {
          va = new Date(va).getTime() || 0;
          vb = new Date(vb).getTime() || 0;
        } else {
          va = String(va).toLowerCase();
          vb = String(vb).toLowerCase();
        }
        if (va > vb) return asc ? 1 : -1;
        if (va < vb) return asc ? -1 : 1;
        return 0;
      });
    }

    // ✅ pill helper
    const pillSets = ["pill-alt1", "pill-alt2", "pill-alt3", "pill-alt4", "pill-alt5", "pill-alt6"];
    const pillWrap = (val, rowIndex, offset = 0) => {
      if (!val || val === '—') return '<span class="small muted">—</span>';
      const cls = pillSets[(rowIndex + offset) % pillSets.length];
      return `<span class="pill ${cls}">${escapeHtml(val)}</span>`;
    };

    tbody.innerHTML = list.map((t, idx) => {
      const lead = this.leadById ? this.leadById(getField(t, ['LeadID'])) : null;
      const prop = this.propertyById ? this.propertyById(getField(t, ['PropertyID'])) : null;

      const typeVal = getField(t, ['Type', 'TaskType']) || '—';
      const statusVal = getField(t, ['Status', 'TaskStatus']) || '—';
      const priority = getField(t, ['Priority']) || '—';
      const category = getField(t, ['Category']) || '—';
      const outcome = getField(t, ['Outcome']) || '—';
      const nextAct = getField(t, ['NextAction']) || '—';

      const statusClass = (String(statusVal).toLowerCase() === 'open') ? 'pill-open' :
        (String(statusVal).toLowerCase() === 'done') ? 'pill-done' : 'pill-unknown';
      const statusCell = `<span class="pill ${statusClass}" style="cursor:pointer" 
      title="Click to filter by Status: ${escapeHtml(statusVal)}"
      onclick="document.getElementById('t-status').value='${escapeHtml(statusVal)}'; app.renderTasks();">${escapeHtml(statusVal)}</span>`;

      const typeCell = pillWrap(typeVal, idx, 0);
      const priorityCell = pillWrap(priority, idx, 1);
      const propertyCell = prop ? pillWrap(prop.Title || prop.Ref || prop.ID, idx, 2) : '<span class="small muted">—</span>';
      const categoryCell = pillWrap(category, idx, 3);
      const outcomeCell = pillWrap(outcome, idx, 4);
      const nextActionCell = pillWrap(nextAct, idx, 5);

      const taskId = String(t.ID || '').replace(/'/g, "\\'");
      const isOpen = String(statusVal).toLowerCase() === 'open';
      const toggleIcon = isOpen ? 'check-square' : 'rotate-ccw';

      const actions = `
      <div style="white-space:nowrap; display:flex; gap:4px;">
        <button class="action-btn toggle" title="Toggle" onclick="app.toggleTask('${taskId}')">
          <i data-lucide="${toggleIcon}"></i>
        </button>
        <button class="action-btn edit" title="Edit" onclick="app.openTaskModal('${taskId}')">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="action-btn delete" title="Delete" onclick="app.deleteTask('${taskId}')">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;

      // ✅ add data-id for context menu
      return `<tr data-id="${taskId}">
      <td>${fmtDateTime(getField(t, ['DueDate', 'Due']))}</td>
      <td>${typeCell}</td>
      <td>${priorityCell}</td>
      <td>${escapeHtml(lead ? (lead.Name || lead.Phone || lead.ID) : '—')}</td>
      <td>${propertyCell}</td>
      <td>${escapeHtml(getField(t, ['AssignedTo']))}</td>
      <td>${escapeHtml(getField(t, ['CreatedBy']))}</td>
      <td>${escapeHtml(getField(t, ['ReminderTime']))}</td>
      <td>${categoryCell}</td>
      <td>${escapeHtml(getField(t, ['Notes']))}</td>
      <td>${outcomeCell}</td>
      <td>${nextActionCell}</td>
      <td>${escapeHtml(getField(t, ['Attachments']))}</td>
      <td>${statusCell}</td>
      <td class="actions">${actions}</td>
    </tr>`;
    }).join('');

    // sorting handlers
    const thead = tbody.closest('table').querySelector('thead');
    thead.querySelectorAll('th[data-key]').forEach(th => {
      const key = th.dataset.key;
      th.style.cursor = 'pointer';
      th.onclick = () => {
        if (this.tasksSortKey === key) this.tasksSortAsc = !this.tasksSortAsc;
        else { this.tasksSortKey = key; this.tasksSortAsc = true; }
        this.renderTasks();
      };
    });

    // refresh Lucide icons
    if (window.lucide) {
      console.log("Refreshing Lucide icons in Tasks…");
      lucide.createIcons();
      applyContextMenuIconColors(); // call right after icons are created
    }

    // ✅ Re-bind context menu every render
    if (typeof attachTaskContextMenu === "function") {
      attachTaskContextMenu();
    }
  },


  async saveTask(id) {
    const safeNotify = (msg, type = 'info') => {
      try {
        if (typeof addNotification === 'function') return addNotification(msg, type);
        if (window.app && window.app.notifications) {
          window.app.notifications.list.unshift({ id: Date.now(), msg, type, read: false });
          window.app.notifications.unread = (window.app.notifications.unread || 0) + 1;
          if (typeof renderNotifications === 'function') renderNotifications();
          return;
        }
        console.info('Notification:', type, msg);
      } catch (e) { console.warn('safeNotify failed', e); }
    };

    // 👇 Scope all lookups to the modal
    const modalRoot = document.getElementById('modalContent');
    const $ = sel => modalRoot.querySelector(sel);

    const typeVal = $('#t-type')?.value?.trim() || 'Call';
    const statusVal = $('#t-status')?.value?.trim() || 'Open';

    const t = {
      ID: id || '',
      DueDate: $('#t-due')?.value || today(),
      Type: typeVal,
      Status: statusVal,
      Priority: $('#t-priority')?.value || 'Medium',
      LeadID: $('#t-lead')?.value || '',
      PropertyID: $('#t-prop')?.value || '',
      AssignedTo: $('#t-assigned')?.value.trim() || '',
      CreatedBy: $('#t-created')?.value.trim() || '',
      ReminderTime: $('#t-reminder')?.value.trim() || '',
      Outcome: $('#t-outcome')?.value.trim() || '',
      NextAction: $('#t-next')?.value.trim() || '',
      Category: $('#t-category')?.value.trim() || '',
      Attachments: $('#t-attach')?.value.trim() || '',
      Notes: $('#t-notes')?.value.trim() || ''
    };

    console.log("🔎 saveTask payload:", JSON.stringify(t));

    try {
      const res = id ? await remote.update('Tasks', t) : await remote.add('Tasks', t);
      console.log("📤 saveTask result:", res);
      if (!id && res && (res.id || res.ID)) t.ID = res.id || res.ID;
      await this.reloadFromServer();
      this.closeModal();
      this.renderTasks();
      safeNotify(`Task saved`, 'success');
    } catch (e) {
      console.error("❌ saveTask error:", e);
      safeNotify('Failed to save task', 'error');
      alert('Save failed: ' + (e?.message || e));
    }
  },



  /* === Buyers === */
  renderBuyers() {
    const tbody = document.getElementById('buyersTable');
    const list = this.data.buyers || [];

    // --- Render table rows ---
    tbody.innerHTML = list
      .map(b => `
        <tr>
            <td>${escapeHtml(b.Name || '-')}</td>
            <td>${escapeHtml(b.Phone || '-')}</td>
            <td>${escapeHtml(b.Email || '-')}</td>
            <td class="actions">
                <button title="View / Edit" onclick="app.openBuyerModal('${b.ID}')">✏️</button>
                <button title="Delete" onclick="app.deleteBuyer('${b.ID}')">🗑️</button>
            </td>
        </tr>
        `).join('');

    // --- Setup sortable columns ---
    const thead = tbody.closest('table').querySelector('thead');
    thead.querySelectorAll('th').forEach((th, index) => {
      if (index === 3) return; // Skip actions column
      const key = th.innerText.replace(/\s+/g, ''); // e.g., Name, Phone, Email
      th.style.cursor = 'pointer';
      th.onclick = () => {
        if (this.buyersSortKey === key) {
          this.buyersSortAsc = !this.buyersSortAsc;
        } else {
          this.buyersSortKey = key;
          this.buyersSortAsc = true;
        }

        list.sort((a, b) => {
          let valA = a[key] ?? '';
          let valB = b[key] ?? '';
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
          if (valA > valB) return this.buyersSortAsc ? 1 : -1;
          if (valA < valB) return this.buyersSortAsc ? -1 : 1;
          return 0;
        });
        this.renderBuyers();
      };
    });
  },


  openBuyerModal(id) {
    const b = id ? this.data.buyers.find(x => x.ID === id) : { ID: '', Name: '', Phone: '', Email: '' };
    const html = `<h3>${id ? 'Edit Buyer' : 'New Buyer'}</h3>
    <div class="flex" style="flex-wrap:wrap">
      <div><label>Name</label><input id="buyer-name" value="${escapeHtml(b.Name || '')}" /></div>
      <div><label>Phone</label><input id="buyer-phone" value="${escapeHtml(b.Phone || '')}" /></div>
      <div><label>Email</label><input id="buyer-email" value="${escapeHtml(b.Email || '')}" /></div>
    </div>
    <div style="text-align:right; margin-top:12px">
      <button class="btn" onclick="app.saveBuyer('${id || ''}')">Save</button>
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>`;
    this.openModal(html);
  },

  async saveBuyer(id) {
    const b = {
      ID: id || '',
      Name: document.getElementById('buyer-name').value.trim(),
      Phone: document.getElementById('buyer-phone').value.trim(),
      Email: document.getElementById('buyer-email').value.trim()
    };

    function safeNotify(msg, type = 'info') {
      try {
        if (typeof addNotification === 'function') return addNotification(msg, type);
        if (window.app && window.app.notifications) {
          window.app.notifications.list.unshift({
            id: Date.now(),
            msg,
            type,
            read: false
          });
          window.app.notifications.unread =
            (window.app.notifications.unread || 0) + 1;
          if (typeof renderNotifications === 'function') renderNotifications();
        } else {
          console.info('Notification:', type, msg);
        }
      } catch (e) {
        console.warn('safeNotify failed', e);
      }
    }

    try {
      if (id) {
        await remote.update('Buyers', b);
      } else {
        const res = await remote.add('Buyers', b);
        b.ID = extractId(res) || b.ID;
      }
      await this.reloadFromServer();
      this.closeModal();
      this.renderBuyers();

      safeNotify(`Buyer "${formatLabel(b, b.ID)}" saved`, 'success');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to save buyer', 'error');
      alert('Save failed: ' + (e.message || e));
    }
  },


  async deleteBuyer(id) {
    if (!confirm('Delete this buyer?')) return;
    try {
      const buyer = this.buyerById ? this.buyerById(id) : null;
      await remote.delete('Buyers', id);
      await this.reloadFromServer();
      this.renderBuyers();

      safeNotify(`Buyer "${formatLabel(buyer, id)}" deleted`, 'warn');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to delete buyer', 'error');
      alert('Delete failed: ' + (e.message || e));
    }
  },



  /* === Sellers === */
  renderSellers() {
    const tbody = document.getElementById('sellersTable');
    const list = this.data.sellers || [];

    // --- Render table rows ---
    tbody.innerHTML = list
      .map(s => `
        <tr>
            <td>${escapeHtml(s.Name || '-')}</td>
            <td>${escapeHtml(s.Phone || '-')}</td>
            <td>${escapeHtml(s.Email || '-')}</td>
            <td class="actions">
                <button title="View / Edit" onclick="app.openSellerModal('${s.ID}')">✏️</button>
                <button title="Delete" onclick="app.deleteSeller('${s.ID}')">🗑️</button>
            </td>
        </tr>
        `).join('');

    // --- Setup sortable columns ---
    const thead = tbody.closest('table').querySelector('thead');
    thead.querySelectorAll('th').forEach((th, index) => {
      if (index === 3) return; // Skip actions column
      const key = th.innerText.replace(/\s+/g, ''); // e.g., Name, Phone, Email
      th.style.cursor = 'pointer';
      th.onclick = () => {
        if (this.sellersSortKey === key) {
          this.sellersSortAsc = !this.sellersSortAsc;
        } else {
          this.sellersSortKey = key;
          this.sellersSortAsc = true;
        }

        list.sort((a, b) => {
          let valA = a[key] ?? '';
          let valB = b[key] ?? '';
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
          if (valA > valB) return this.sellersSortAsc ? 1 : -1;
          if (valA < valB) return this.sellersSortAsc ? -1 : 1;
          return 0;
        });
        this.renderSellers();
      };
    });
  },


  openSellerModal(id) {
    const s = id ? this.data.sellers.find(x => x.ID === id) : { ID: '', Name: '', Phone: '', Email: '' };
    const html = `<h3>${id ? 'Edit Seller' : 'New Seller'}</h3>
    <div class="flex" style="flex-wrap:wrap">
      <div><label>Name</label><input id="seller-name" value="${escapeHtml(s.Name || '')}" /></div>
      <div><label>Phone</label><input id="seller-phone" value="${escapeHtml(s.Phone || '')}" /></div>
      <div><label>Email</label><input id="seller-email" value="${escapeHtml(s.Email || '')}" /></div>
    </div>
    <div style="text-align:right; margin-top:12px">
      <button class="btn" onclick="app.saveSeller('${id || ''}')">Save</button>
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>`;
    this.openModal(html);
  },

  async saveSeller(id) {
    const s = {
      ID: id || '',
      Name: document.getElementById('seller-name').value.trim(),
      Phone: document.getElementById('seller-phone').value.trim(),
      Email: document.getElementById('seller-email').value.trim()
    };

    function safeNotify(msg, type = 'info') {
      try {
        if (typeof addNotification === 'function') return addNotification(msg, type);
        if (window.app && window.app.notifications) {
          window.app.notifications.list.unshift({
            id: Date.now(),
            msg,
            type,
            read: false
          });
          window.app.notifications.unread =
            (window.app.notifications.unread || 0) + 1;
          if (typeof renderNotifications === 'function') renderNotifications();
        } else {
          console.info('Notification:', type, msg);
        }
      } catch (e) {
        console.warn('safeNotify failed', e);
      }
    }

    try {
      if (id) {
        await remote.update('Sellers', s);
      } else {
        const res = await remote.add('Sellers', s);
        s.ID = extractId(res) || s.ID;
      }
      await this.reloadFromServer();
      this.closeModal();
      this.renderSellers();

      safeNotify(`Seller "${formatLabel(s, s.ID)}" saved`, 'success');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to save seller', 'error');
      alert('Save failed: ' + (e.message || e));
    }
  },



  async deleteSeller(id) {
    if (!confirm('Delete this seller?')) return;
    try {
      const seller = this.sellerById ? this.sellerById(id) : null;
      await remote.delete('Sellers', id);
      await this.reloadFromServer();
      this.renderSellers();

      safeNotify(`Seller "${formatLabel(seller, id)}" deleted`, 'warn');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to delete seller', 'error');
      alert('Delete failed: ' + (e.message || e));
    }
  },




  async toggleTask(id) {
    const t = this.data.tasks.find(x => x.ID === id);
    if (!t) return;
    t.Status = (t.Status === 'Open') ? 'Done' : 'Open';
    await remote.update('Tasks', t);
    await this.reloadFromServer();
    this.renderTasks();
  },

  async deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
      const task = this.taskById ? this.taskById(id) : null;
      await remote.delete('Tasks', id);
      await this.reloadFromServer();
      this.renderTasks();

      safeNotify(`Task "${formatLabel(task, id)}" deleted`, 'warn');
    } catch (e) {
      console.error(e);
      safeNotify('Failed to delete task', 'error');
      alert('Delete failed: ' + (e.message || e));
    }
  },



  /* === Modal helpers === */
  /* === Modal helpers === */
  openModal(innerHTML) {
    const modal = document.getElementById('modal');
    document.getElementById('modalContent').innerHTML = innerHTML;
    modal.classList.remove('hidden');
  },
  closeModal() { document.getElementById('modal').classList.add('hidden'); },

  /* === Matches Feature === */
  openMatches(id) {
    const lead = this.data.leads.find(l => l.ID === id);
    if (!lead) return;

    const matches = findMatchesForLead(lead, this.data.properties || []);
    let html = "";

    if (matches.length === 0) {
      html = "<p>No good matches found for this lead.</p>";
    } else {
      html = "<ul style='list-style:none;padding:0'>";
      matches.forEach(m => {
        html += `<li class="card" style="margin:6px 0;padding:8px">
          <strong>${escapeHtml(m.property.Title || "Untitled")}</strong>
          <br/>Location: ${escapeHtml(m.property.Location || "")}
          <br/>Type: ${escapeHtml(m.property.Type || "")}
          <br/>Price: ₹ ${escapeHtml(m.property.Price || "")}
          <br/><span class="muted">Match Score: ${m.score}%</span>
        </li>`;
      });
      html += "</ul>";
    }

    document.getElementById("matchesContent").innerHTML = html;
    document.getElementById("matchesModal").classList.remove("hidden");
  },

  closeMatches() {
    document.getElementById("matchesModal").classList.add("hidden");
  }
};


/* ===== Utilities ===== */
function normalizeRow(r) {
  // ensures keys are consistent between server and frontend (server returns string values)
  const o = {};
  Object.keys(r).forEach(k => o[k] = r[k]);
  return o;
}
function tryParseJSON(s) { try { return JSON.parse(s); } catch (e) { return []; } }
function escapeHtml(s) { if (s === null || s === undefined) return ''; return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ===== Start ===== */
window.addEventListener('DOMContentLoaded', () => app.init());


document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebarToggle");

  // ✅ Restore sidebar pinned/collapsed state
  const pinned = localStorage.getItem('sidebarPinned') === 'true';
  if (pinned) {
    sidebar.classList.remove('collapsed');
  } else {
    sidebar.classList.add('collapsed');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.toggle("collapsed");

      // ✅ Save pinned state to localStorage
      localStorage.setItem('sidebarPinned', !isCollapsed);

      // ⏳ Fix ALL Leaflet maps after sidebar resize
      setTimeout(() => {
        document.querySelectorAll(".leaflet-container").forEach(el => {
          if (el._leaflet_map) {
            el._leaflet_map.invalidateSize();
            console.log("✅ Leaflet map resized after sidebar toggle:", el.id);
          }
        });
      }, 400); // match sidebar CSS transition
    });
  }
});


function showLoader() {
  const el = document.getElementById("loader");
  if (el) el.classList.remove("hidden");
}

function hideLoader() {
  const el = document.getElementById("loader");
  if (el) el.classList.add("hidden");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  // Map toast types to icons + colors + badges
  const config = {
    success: { icon: "✅", badge: '<span class="badge badge-done">DONE</span>' },
    warning: { icon: "⚠️", badge: '<span class="badge badge-pending">PENDING</span>' },
    error: { icon: "❌", badge: '<span class="badge badge-urgent">URGENT</span>' },
    info: { icon: "ℹ️", badge: '<span class="badge">INFO</span>' }
  };

  const { icon, badge } = config[type] || config.info;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: #222;
    color: #fff;
    padding: 12px 16px;
    margin-top: 8px;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    animation: fadeIn 0.3s ease;
  `;

  toast.innerHTML = `${badge}<span>${icon}</span><span>${escapeHtml(message)}</span>`;

  // Dismiss on click
  toast.onclick = () => toast.remove();

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => toast.remove(), 5000);
}





// 1. Lead Conversion Funnel
function renderFunnelChart(leads) {
  const ctx = document.getElementById("chartFunnel");
  if (!ctx) return;

  // ✅ Destroy existing chart if it exists
  if (window.chartRegistry["chartFunnel"]) {
    window.chartRegistry["chartFunnel"].destroy();
  }

  const stages = ["New", "Contacted", "Site Visit", "Negotiation", "Closed"];
  const counts = stages.map(s => leads.filter(l => l.Status === s).length);

  // ✅ Save new chart instance
  window.chartRegistry["chartFunnel"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: stages,
      datasets: [{
        label: "Leads",
        data: counts,
        borderRadius: 10,
        backgroundColor: ["#2196F3", "#9C27B0", "#FF9800", "#4CAF50", "#009688"]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}



// 2. Monthly Trends (Leads & Closures)
function renderMonthlyTrendsChart(leads) {
  const months = {};
  leads.forEach(l => {
    const d = new Date(l.Date || l.CreatedAt || Date.now());
    if (isNaN(d)) return;
    const key = d.toLocaleString("default", { month: "short", year: "numeric" });
    months[key] = months[key] || { leads: 0, closed: 0 };
    months[key].leads++;
    if (l.Status === "Closed") months[key].closed++;
  });

  const labels = Object.keys(months);
  const leadsData = Object.values(months).map(m => m.leads);
  const closedData = Object.values(months).map(m => m.closed);

  safeChart("chartMonthlyTrends", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Leads", data: leadsData, borderColor: "#2196F3", fill: false },
        { label: "Closed", data: closedData, borderColor: "#4CAF50", fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}


// 3. Properties Pipeline
function renderPipelineChart(properties) {
  const categories = ["Sale", "Rent", "Booked", "Sold"];
  const counts = { "Sale": 0, "Rent": 0, "Booked": 0, "Sold": 0 };

  properties.forEach(p => {
    const mode = (p.Mode || "").toLowerCase();
    if (mode === "sale") counts["Sale"]++;
    else if (mode === "rent") counts["Rent"]++;
    else if (mode === "booked") counts["Booked"]++;
    else if (mode === "sold") counts["Sold"]++;
  });

  safeChart("chartPipeline", {
    type: "bar",
    data: {
      labels: categories,
      datasets: [{
        label: "Properties",
        data: categories.map(c => counts[c]),
        borderRadius: 10,
        backgroundColor: ["#2196F3", "#FF9800", "#9C27B0", "#4CAF50"]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}





// 4. Leads by Location (Leaflet)
function renderLeadsByLocation(leads) {
  const cityCounts = {};
  leads.forEach(l => {
    const city = l.City || l.Location || "Unknown";
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  // 🎨 Define a color palette
  const colors = [
    "#4CAF50", "#2196F3", "#FF9800", "#9C27B0",
    "#009688", "#F44336", "#795548", "#3F51B5"
  ];

  // Assign alternating colors
  const bgColors = Object.keys(cityCounts).map((_, i) =>
    colors[i % colors.length]
  );

  safeChart("chartLeadLocation", {
    type: "bar",
    data: {
      labels: Object.keys(cityCounts),
      datasets: [{
        label: "Leads",
        data: Object.values(cityCounts),
        borderRadius: 10,
        backgroundColor: bgColors
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.formattedValue} leads`
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}






// 5. Agent/Team Performance
function renderAgentsChart(leads) {
  const agents = {};
  leads.forEach(l => {
    const a = l.Agent || "Unassigned";
    agents[a] = agents[a] || { total: 0, closed: 0 };
    agents[a].total++;
    if (l.Status === "Closed") agents[a].closed++;
  });

  safeChart("chartAgents", {
    type: "bar",
    data: {
      labels: Object.keys(agents),
      datasets: [
        {
          label: "Total Leads",
          data: Object.values(agents).map(a => a.total),
          borderRadius: 10,
          backgroundColor: "#2196F3"
        },
        {
          label: "Closed Deals",
          data: Object.values(agents).map(a => a.closed),
          backgroundColor: "#4CAF50"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`
          }
        }
      },
      scales: {
        x: { stacked: false },
        y: { beginAtZero: true }
      }
    }
  });
}


// 6. Follow-up Status Aging
function renderAgingChart(tasks) {
  const buckets = { "0–3 days": 0, "4–7 days": 0, ">7 days": 0 };

  tasks.filter(t => t.Status === "Open").forEach(t => {
    const due = new Date(t.DueDate);
    if (isNaN(due)) return;
    const diffDays = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) buckets["0–3 days"]++;
    else if (diffDays <= 7) buckets["4–7 days"]++;
    else buckets[">7 days"]++;
  });

  safeChart("chartAging", {
    type: "doughnut",
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        data: Object.values(buckets),
        backgroundColor: ["#4CAF50", "#FF9800", "#F44336"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}


// 7. Revenue Projection
function renderRevenueChart(leads) {
  const months = {};

  leads.forEach(l => {
    // no Date column, so fallback to ID order (not ideal)
    const d = new Date(l.Date || l.CreatedAt || Date.now());
    if (isNaN(d)) return;
    const key = d.toLocaleString("default", { month: "short", year: "numeric" });
    months[key] = months[key] || { expected: 0, actual: 0 };

    const expected = Number(l.Budget || 0);
    months[key].expected += expected;

    if (l.Status === "Closed") {
      months[key].actual += expected; // no DealValue, use Budget
    }
  });

  safeChart("chartRevenue", {
    type: "line",
    data: {
      labels: Object.keys(months),
      datasets: [
        {
          label: "Expected",
          data: Object.values(months).map(m => m.expected),
          borderColor: "#FF9800",
          fill: false
        },
        {
          label: "Actual",
          data: Object.values(months).map(m => m.actual),
          borderColor: "#4CAF50",
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ₹${ctx.formattedValue}`
          }
        }
      }
    }
  });
}




// 8. Lead Source Effectiveness
function renderLeadSourceChart(leads) {
  const sources = {};
  leads.forEach(l => {
    const s = l.Source || "Unknown";
    sources[s] = sources[s] || { total: 0, closed: 0 };
    sources[s].total++;
    if (l.Status === "Closed") sources[s].closed++;
  });

  safeChart("chartLeadSourceEffectiveness", {
    type: "bar",
    data: {
      labels: Object.keys(sources),
      datasets: [
        {
          label: "Total Leads",
          data: Object.values(sources).map(s => s.total),
          borderRadius: 10,
          backgroundColor: "#2196F3"
        },
        {
          label: "Closed Deals",
          data: Object.values(sources).map(s => s.closed),
          backgroundColor: "#4CAF50"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} leads`
          }
        },
        legend: { position: "bottom" }
      }
    }
  });
}


function clearAllCharts() {
  for (const id in window.chartRegistry) {
    if (window.chartRegistry[id]) {
      try {
        window.chartRegistry[id].destroy();
      } catch (e) {
        console.warn("Failed to destroy chart", id, e);
      }
      window.chartRegistry[id] = null;
    }
  }
}


/* ===========================
   REPORTS EXTENSIONS (SAFE)
   =========================== */

// Ensure chart store
app._charts = app._charts || {};

app.renderReport_leads7 = function () {
  const weeklyDiv = document.getElementById('chartLeads7');
  if (!weeklyDiv) {
    console.warn("⚠️ chartLeads7 container not found");
    return;
  }

  if (this._charts.week) {
    this._charts.week.destroy();
    this._charts.week = null;
  }

  const leads = this.data.leads || [];

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = [3, 5, 2, 6, 4, 7, leads.length];

  // Define colors for each marker
  const markerColors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#d946ef", "#3b82f6"];

  // Prepare series with data points as objects to assign individual colors
  const seriesData = counts.map((value, index) => {
    return {
      x: labels[index],
      y: value,
      fillColor: markerColors[index]
    };
  });

  const options = {
    chart: {
      type: 'line',
      height: '300px',
      toolbar: { show: false },
      animations: { enabled: false }
    },
    series: [{
      name: 'Leads',
      data: seriesData
    }],
    xaxis: {
      categories: labels,
      labels: { style: { colors: "#9aa4b2" } }
    },
    yaxis: {
      labels: { style: { colors: "#9aa4b2" } },
      min: 0
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark'
    },
    markers: {
      size: 6,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 8
      }
    }
  };

  this._charts.week = new ApexCharts(weeklyDiv, options);
  this._charts.week.render();

  console.log("✅ ApexCharts chartLeads7 rendered with individual marker colors");
};






/** 2. Lead Source Performance (Pie/Donut) */
app.renderReport_leadSourcePerformance = function () {
  const ctx = document.getElementById('chartLeadSourcePerf');
  if (!ctx) return null;

  if (app._charts["leadSourcePerf"]) {
    app._charts["leadSourcePerf"].destroy();
    delete app._charts["leadSourcePerf"];
  }

  const counts = {};
  (this.data.leads || []).forEach(l => {
    const src = l.Source || 'Other';
    counts[src] = (counts[src] || 0) + 1;
  });

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#42a5f5', '#66bb6a', '#ffca28', '#ef5350', '#ab47bc']
      }]
    },
    options: {
      responsive: true,              // enable responsiveness
      maintainAspectRatio: false,    // allow CSS-based sizing
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });

  app._charts["leadSourcePerf"] = chart;
  return chart;
};


/** 3. Revenue by Property Type (Bar) */
app.renderReport_revenueByType = function () {
  const ctx = document.getElementById('chartRevenueType');
  if (!ctx) return null;

  // Compute revenue totals per property type
  const totals = {};
  (this.data.properties || []).forEach(p => {
    const type = p.Type || 'Other';
    totals[type] = (totals[type] || 0) + (parseFloat(p.Price) || 0);
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);

  // Define a color palette (cycled if more types than colors)
  const palette = [
    '#42a5f5', // blue
    '#66bb6a', // green
    '#ffa726', // orange
    '#ab47bc', // purple
    '#26c6da', // cyan
    '#ef5350', // red
    '#8d6e63', // brown
    '#ffd54f', // yellow
  ];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  // If chart already exists, update it instead of destroying
  if (app._charts["revenueByType"]) {
    const chart = app._charts["revenueByType"];
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update(); // smooth update, no flicker
    return chart;
  }

  // Otherwise, create new chart
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        borderRadius: 10,
        backgroundColor: colors
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  app._charts["revenueByType"] = chart;
  return chart;
};


/** 4. Upcoming Tasks Heatmap (weekly counts) */
app.renderReport_taskHeatmap = function () {
  const ctx = document.getElementById('chartTaskHeatmap');
  if (!ctx) return null;

  // Prepare task counts per weekday
  const counts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  (this.data.tasks || []).forEach(t => {
    const d = new Date(t.DueDate);
    if (!isNaN(d)) {
      const day = d.toLocaleString('en-US', { weekday: 'short' });
      counts[day] = (counts[day] || 0) + 1;
    }
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);

  // Define color palette (alternative colors)
  const colors = [
    '#42a5f5', // Sun - blue
    '#66bb6a', // Mon - green
    '#ffa726', // Tue - orange
    '#ab47bc', // Wed - purple
    '#26c6da', // Thu - cyan
    '#ef5350', // Fri - red
    '#8d6e63'  // Sat - brown
  ];

  // If chart already exists, just update it
  if (app._charts["taskHeatmap"]) {
    const chart = app._charts["taskHeatmap"];
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update(); // smooth update, no destroy flicker
    return chart;
  }

  // Otherwise, create new chart
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tasks',
        data: values,
        borderRadius: 10,
        backgroundColor: colors
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  app._charts["taskHeatmap"] = chart;
  return chart;
};


/** 5. Top Performing Agents / Sellers */
app.renderReport_topSellers = function () {
  const tbody = document.getElementById('tableTopSellers');
  if (!tbody) return;

  const perf = {};
  (this.data.sellers || []).forEach(s => {
    perf[s.Name] = {
      count: (perf[s.Name]?.count || 0) + 1,
      value: (perf[s.Name]?.value || 0) + (parseFloat(s.TotalSales) || 0)
    };
  });

  const sorted = Object.entries(perf).sort((a, b) => b[1].value - a[1].value);
  tbody.innerHTML = sorted.map(([name, stats], i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${name}</td>
      <td>${stats.count}</td>
      <td>${stats.value.toLocaleString()}</td>
      <td>${(stats.value / stats.count).toFixed(2)}</td>
    </tr>`).join('');
};

/** 6. Buyer Interest Trends (Line over time) */
app.renderReport_buyerTrends = function () {
  const ctx = document.getElementById('chartBuyerTrends');
  if (!ctx) return null;

  if (app._charts["buyerTrends"]) {
    app._charts["buyerTrends"].destroy();
    delete app._charts["buyerTrends"];
  }

  const monthly = {};
  (this.data.buyers || []).forEach(b => {
    const d = new Date(b.CreatedAt || b.Date || Date.now());
    if (!isNaN(d)) {
      const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthly[key] = (monthly[key] || 0) + 1;
    }
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(monthly),
      datasets: [{
        label: 'Buyer Inquiries',
        data: Object.values(monthly),
        borderColor: '#66bb6a',
        fill: false
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });

  app._charts["buyerTrends"] = chart;
  return chart;
};

/** 7. Average Deal Closure Time (KPI card) */
app.renderReport_avgClosure = function () {
  const el = document.getElementById('kpiAvgClosure');
  if (!el) return;

  const leads = this.data.leads || [];
  console.log("🔎 Leads loaded:", leads.length);

  // Find closed deals with dates
  const deals = leads.filter(l =>
    (l.Status || '').toLowerCase() === 'closed' &&
    l.CreatedAt && l.ClosedAt
  );

  if (deals.length) {
    const days = deals.map(l => {
      const created = new Date(l.CreatedAt);
      const closed = new Date(l.ClosedAt);
      if (isNaN(created) || isNaN(closed)) return null;
      return (closed - created) / (1000 * 60 * 60 * 24);
    }).filter(v => v !== null && v >= 0);

    if (days.length) {
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      el.textContent = `${avg.toFixed(1)} days`;
      return;
    }
  }

  // Fallback: show count of closed deals if no dates
  const closedDeals = leads.filter(l => (l.Status || '').toLowerCase() === 'closed');
  if (closedDeals.length) {
    el.textContent = `${closedDeals.length} closed (no dates)`;
    return;
  }

  // Nothing to show
  el.textContent = '—';
};



/** 8. Inventory Status (Donut) */
app.renderReport_inventoryStatus = function () {
  const ctx = document.getElementById('chartInventoryStatus');
  if (!ctx) return null;

  if (app._charts["inventoryStatus"]) {
    app._charts["inventoryStatus"].destroy();
    delete app._charts["inventoryStatus"];
  }

  const counts = { Available: 0, Booked: 0, Sold: 0 };
  (this.data.properties || []).forEach(p => {
    counts[p.Status] = (counts[p.Status] || 0) + 1;
  });

  const chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts), backgroundColor: ['#42a5f5', '#ffca28', '#ef5350'] }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  app._charts["inventoryStatus"] = chart;
  return chart;
};

/** 9. Revenue Forecast (Line projection) */
app.renderReport_revenueForecast = function () {
  const ctx = document.getElementById('chartRevenueForecast');
  if (!ctx) return null;

  if (app._charts["revenueForecast"]) {
    app._charts["revenueForecast"].destroy();
    delete app._charts["revenueForecast"];
  }

  const monthly = {};
  (this.data.properties || []).forEach(p => {
    if (p.SoldDate && p.Price) {
      const d = new Date(p.SoldDate);
      if (!isNaN(d)) {
        const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        monthly[key] = (monthly[key] || 0) + (parseFloat(p.Price) || 0);
      }
    }
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: Object.keys(monthly), datasets: [{ label: 'Revenue', data: Object.values(monthly), borderColor: '#ab47bc', fill: false }] },
    options: { scales: { y: { beginAtZero: true } } }
  });

  app._charts["revenueForecast"] = chart;
  return chart;
};

/** 10. Geo Heatmap (safe) */
// 🌍 Helper: auto-geocode using OpenStreetMap (Nominatim)
async function geocodeCity(cityOrLocation) {
  if (!cityOrLocation) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityOrLocation)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (err) {
    console.warn("⚠️ Geocode failed:", cityOrLocation, err);
  }
  return null;
}

// 🔔 Enhance: Show toast alerts for due-soon tasks + update sidebar badge (safe version)
app.checkDueSoonTasks = function () {
  try {
    const tasks = this.data?.tasks || [];
    console.log("🔍 checkDueSoonTasks - total tasks:", tasks.length);

    if (!tasks.length) return;

    const now = new Date();
    const DUE_SOON_DAYS = 3;

    const getDueDate = (task) =>
      task.dueDate ||
      task.DueDate ||
      task["Due Date"] ||
      task.deadline ||
      task.Deadline ||
      null;

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const d = new Date(val);
      if (!isNaN(d)) return d;
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(val)) {
        const [dd, mm, yyyy] = val.split(/[-/]/);
        return new Date(`${yyyy}-${mm}-${dd}`);
      }
      return null;
    };

    let dueSoonCount = 0;
    let overdueCount = 0;

    tasks.forEach((t) => {
      t._deadlineTag = null; // reset

      const raw = getDueDate(t);
      const due = parseDate(raw);
      if (!due) return;

      const diffDays = (due - now) / (1000 * 60 * 60 * 24);

      if (diffDays < 0 && t.Status !== "Done") {
        t._deadlineTag = "Overdue";
        overdueCount++;
      } else if (diffDays >= 0 && diffDays <= DUE_SOON_DAYS && t.Status !== "Done") {
        t._deadlineTag = "Due Soon";
        dueSoonCount++;
      }
    });

    console.log(`🔍 Due soon: ${dueSoonCount}, Overdue: ${overdueCount}`);

    // Toasts
    tasks.filter(t => t._deadlineTag === "Due Soon").forEach(t => {
      showToast(`⏰ Task "${t.Notes || t.ID}" is due soon!`, "warning");
    });
    tasks.filter(t => t._deadlineTag === "Overdue").forEach(t => {
      showToast(`⚠️ Task "${t.Notes || t.ID}" is overdue!`, "error");
    });

    // Badge update
    const badgeEl = document.getElementById("tasks-badge");
    if (badgeEl) {
      const totalTasks = tasks.length;
      badgeEl.textContent =
        overdueCount > 0 || dueSoonCount > 0
          ? `${totalTasks} (${dueSoonCount} due soon, ${overdueCount} overdue)`
          : `${totalTasks}`;
    }
  } catch (err) {
    console.error("❌ checkDueSoonTasks error:", err);
  }
};






app.renderReport_geoHeatmap = async function () {
  const mapEl = document.getElementById("mapGeoHeat");
  if (!mapEl) return;

  if (typeof L === "undefined" || !L.map) {
    console.warn("⚠️ Leaflet.js not loaded, skipping geo heatmap");
    return;
  }

  // Clean-up previous map instance
  if (mapEl._leaflet_map) {
    try { mapEl._leaflet_map.remove(); } catch (e) { /* ignore */ }
    mapEl._leaflet_map = null;
    mapEl.innerHTML = "";
  }

  // Ensure container size is ready
  await new Promise(resolve => {
    const checkSize = () => {
      const { width, height } = mapEl.getBoundingClientRect();
      if (width > 0 && height > 0) resolve();
      else requestAnimationFrame(checkSize);
    };
    checkSize();
  });

  // Create map
  const map = L.map(mapEl, { maxZoom: 19 }).setView([20.5937, 78.9629], 5);
  mapEl._leaflet_map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
    minZoom: 2
  }).addTo(map);

  const points = [];
  const latlngs = [];

  const markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: function (cluster) {
      const childMarkers = cluster.getAllChildMarkers();

      // Extract city colors from child markers
      const cityColorsInCluster = new Set();
      let cityNamesInCluster = new Set();
      childMarkers.forEach(marker => {
        if (marker.options.icon && marker.options.icon.options.html.includes('fill="#')) {
          const match = marker.options.icon.options.html.match(/fill="(#\w{6})"/);
          if (match && match[1]) cityColorsInCluster.add(match[1]);
        }
        if (marker.getTooltip) {
          const tooltip = marker.getTooltip();
          if (tooltip) cityNamesInCluster.add(tooltip.getContent());
        }
      });

      let background;
      if (cityColorsInCluster.size === 1) {
        background = [...cityColorsInCluster][0];
      } else {
        background = `linear-gradient(135deg, ${[...cityColorsInCluster].join(', ')})`;
      }

      return L.divIcon({
        html: `<div class="cluster-badge" style="background: ${background};">${cluster.getChildCount()}</div>`,
        className: 'cluster-icon',
        iconSize: [40, 40]
      });
    }
  });

  // Add cluster tooltip functionality
  markers.on('clustermouseover', function (event) {
    const cluster = event.layer;
    const cityNames = cluster.getAllChildMarkers()
      .map(m => m.getTooltip().getContent())
      .join(', ');
    cluster.bindTooltip(cityNames, { direction: 'top', offset: [0, -10] }).openTooltip();
  });

  markers.on('clustermouseout', function (event) {
    const cluster = event.layer;
    cluster.closeTooltip();
  });


  const cityColors = {};
  const cityMarkers = {};
  const palette = ["#7c3aed", "#ec4899", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#3b82f6"];
  let paletteIndex = 0;

  const getCustomIcon = (color = "#06b6d4", size = 32) => {
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
      </svg>
    `;
    return L.divIcon({
      className: "custom-pin-wrapper",
      html: `<div class="custom-pin">${svg}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size + 6]
    });
  };

  for (const p of (this.data.properties || [])) {
    let lat = parseFloat(p.Lat);
    let lng = parseFloat(p.Lng);

    if ((isNaN(lat) || isNaN(lng)) && (p.City || p.Location)) {
      try {
        const geo = await geocodeCity(`${p.Location || ""}, ${p.City || ""}`);
        if (geo) {
          lat = geo.lat; lng = geo.lng;
          p.Lat = lat; p.Lng = lng;
        }
      } catch (e) { console.warn("Geocode error:", e); }
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      points.push([lat, lng, 1]);
      latlngs.push([lat, lng]);

      const cityKey = (p.City || "Other").trim().toLowerCase();
      if (!cityColors[cityKey]) {
        cityColors[cityKey] = palette[paletteIndex % palette.length];
        paletteIndex++;
      }
      const color = cityColors[cityKey];

      const marker = L.marker([lat, lng], { icon: getCustomIcon(color), riseOnHover: true });
      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${escapeHtml(p.Title || "Unnamed Property")}</strong><br>
          <small class="muted">${escapeHtml(p.City || "")}${p.Location ? " • " + escapeHtml(p.Location) : ""}</small><br>
          ${p.Price ? "<div style='margin-top:6px;font-weight:600'>₹ " + Number(p.Price).toLocaleString() + "</div>" : ""}
        </div>
      `);
      marker.bindTooltip(
        `${escapeHtml(p.City || "")}${p.Title ? " • " + escapeHtml(p.Title) : ""}`,
        { direction: "top", offset: [0, -10] }
      );

      if (!cityMarkers[cityKey]) cityMarkers[cityKey] = [];
      cityMarkers[cityKey].push(marker);

      markers.addLayer(marker);
    }
  }

  map.addLayer(markers);

  requestAnimationFrame(() => {
    if (points.length > 0 && typeof L.heatLayer === "function") {
      L.heatLayer(points, {
        radius: 25,
        blur: 18,
        maxZoom: 19,
        gradient: { 0.0: "#06b6d4", 0.35: "#3b82f6", 0.65: "#7c3aed", 1.0: "#ef4444" }
      }).addTo(map);
    }
    if (latlngs.length > 0) map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    setTimeout(() => map.invalidateSize(), 150);
    setTimeout(() => map.invalidateSize(), 600);
  });

  try {
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend leaflet-bar");
      div.innerHTML = `<div class="legend-title">Cities</div>`;
      Object.entries(cityColors).forEach(([cityKey, color]) => {
        const label = cityKey ? (cityKey.charAt(0).toUpperCase() + cityKey.slice(1)) : "Other";
        div.innerHTML += `
          <div class="legend-row">
            <button class="legend-btn" data-city="${cityKey}" aria-pressed="true">
              <span class="swatch" style="background:${color}"></span>
              <span>${label}</span>
            </button>
          </div>`;
      });
      return div;
    };
    legend.addTo(map);

    setTimeout(() => {
      const container = document.querySelector(".map-legend");
      if (!container) return;

      container.querySelectorAll(".legend-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const cityKey = btn.dataset.city;
          const isActive = btn.getAttribute("aria-pressed") === "true";
          const list = cityMarkers[cityKey] || [];

          if (isActive) {
            list.forEach(m => { try { markers.removeLayer(m); } catch (e) { } });
            btn.setAttribute("aria-pressed", "false");
            btn.classList.add("muted");
          } else {
            list.forEach(m => { try { markers.addLayer(m); } catch (e) { } });
            btn.setAttribute("aria-pressed", "true");
            btn.classList.remove("muted");
          }
        });
      });
    }, 100);
  } catch (e) {
    console.warn("Legend add failed", e);
  }
};



async function renderAllReports(data) {
  const leads = data.leads || [];
  const tasks = data.tasks || [];
  const properties = data.properties || [];
  const buyers = data.buyers || [];
  const sellers = data.sellers || [];

  // --- Reports ---
  renderFunnelChart(leads);
  renderMonthlyTrendsChart(leads);
  renderPipelineChart(properties);
  renderLeadsByLocation(leads);
  renderAgentsChart(leads);
  renderAgingChart(tasks);
  renderRevenueChart(leads);
  renderLeadSourceChart(leads);

  // --- New Reports ---
  app.renderReport_leads7();
  app.renderReport_leadSourcePerformance();
  app.renderReport_revenueByType();
  app.renderReport_taskHeatmap();
  app.renderReport_topSellers();
  app.renderReport_buyerTrends();
  app.renderReport_avgClosure();
  app.renderReport_inventoryStatus();
  app.renderReport_revenueForecast();

  // ✅ Delay Geo Heatmap so container is sized
  setTimeout(async () => {
    await app.renderReport_geoHeatmap();
  }, 500);

  // --- Helper: Format tooltip names line by line ---
  function formatTooltipNamesLine(items, key = "Name", limit = 5) {
    const names = items.map(i => i[key] || i.ID);
    if (names.length > limit) {
      const firstNames = names.slice(0, limit).join("\n");
      const remaining = names.length - limit;
      return `${firstNames}\nand ${remaining} more`;
    }
    return names.join("\n");
  }

  // --- Helper: Create custom tooltip badge ---
  function createTooltipBadge(element, badgeText, tooltipContent, badgeClass = "") {
    if (!element) return;

    // Clear existing content
    element.innerHTML = "";
    element.textContent = badgeText;
    element.className = "badge " + badgeClass;

    // Remove existing tooltip if any
    const existingTooltip = element.querySelector(".tooltip-text");
    if (existingTooltip) existingTooltip.remove();

    // Create tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip-text";
    tooltip.textContent = tooltipContent;

    // Append tooltip inside the badge
    element.classList.add("custom-tooltip");
    element.appendChild(tooltip);
  }


  // ✅ Sidebar Badge Updates
  setTimeout(() => {
    app.data = app.data || {};
    app.data.tasks = tasks;
    app.data.leads = leads;
    app.data.properties = properties;

    // --- Tasks Badge Function ---
    if (typeof app.checkDueSoonTasks === "function") {
      app.checkDueSoonTasks();
    }

    // --- Leads Badge ---
    const leadsBadge = document.getElementById("leads-badge");
    const dueLeads = leads.filter(l => isLeadDue(l));
    if (leadsBadge) {
      const totalLeads = leads.length;
      const badgeText = dueLeads.length > 0 ? `${totalLeads} (${dueLeads.length} due)` : `${totalLeads}`;
      const tooltipContent = dueLeads.length > 0
        ? `${dueLeads.length} leads with follow-ups due:\n${formatTooltipNamesLine(dueLeads)}`
        : "No leads due today";

      createTooltipBadge(leadsBadge, badgeText, tooltipContent, dueLeads.length > 0 ? "badge-due" : "");
    }

    // --- Properties Badge ---
    const propertiesBadge = document.getElementById("properties-badge");
    if (propertiesBadge) {
      const totalProps = properties.length;
      const badgeText = `${totalProps}`; // always show total
      const tooltipContent = getPropertyModeSummary(properties); // summary by mode
      createTooltipBadge(propertiesBadge, badgeText, tooltipContent, ""); // optional badge-due class
    }





    // --- Tasks Badge ---
    const tasksBadge = document.getElementById("tasks-badge");
    const dueSoonTasks = tasks.filter(t => t._deadlineTag === "Due Soon");
    const overdueTasks = tasks.filter(t => t._deadlineTag === "Overdue");

    if (tasksBadge) {
      const totalTasks = tasks.length;
      if (overdueTasks.length > 0) {
        const badgeText = `${totalTasks} (${overdueTasks.length} overdue)`;
        const tooltipContent = `${overdueTasks.length} tasks overdue:\n${formatTooltipNamesLine(overdueTasks, "Notes")}`;
        createTooltipBadge(tasksBadge, badgeText, tooltipContent, "badge-overdue");
      } else if (dueSoonTasks.length > 0) {
        const badgeText = `${totalTasks} (${dueSoonTasks.length} due soon)`;
        const tooltipContent = `${dueSoonTasks.length} tasks due soon:\n${formatTooltipNamesLine(dueSoonTasks, "Notes")}`;
        createTooltipBadge(tasksBadge, badgeText, tooltipContent, "badge-due");
      } else {
        createTooltipBadge(tasksBadge, `${totalTasks}`, "No urgent tasks", "");
      }
    }
  }, 0);
}






document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById('mapGeoHeat');
  const btn = document.getElementById('mapFullscreenToggle');

  if (btn && mapEl) {
    let isFullscreen = false;

    const updateButtonLabel = () => {
      btn.innerHTML = isFullscreen ? '📄 Return to Report' : '⛶ Fullscreen Map';
    };

    btn.addEventListener('click', () => {
      isFullscreen = !isFullscreen;
      mapEl.classList.toggle('fullscreen', isFullscreen);
      updateButtonLabel();

      if (mapEl._leaflet_map) {
        setTimeout(() => mapEl._leaflet_map.invalidateSize(), 300);
      }
    });

    // Initial label
    updateButtonLabel();
  }
});

function fmtCompactAmount(value) {
  if (value >= 1e7) return (value / 1e7).toFixed(2) + 'CR';
  if (value >= 1e5) return (value / 1e5).toFixed(2) + 'L';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value;
}

// ----------------- Notifications -----------------
if (!app.notifications) {
  app.notifications = { list: [], unread: 0 };
}

function addNotification(msg, type = "info") {
  const id = Date.now();
  app.notifications.list.unshift({ id, msg, type, read: false });
  app.notifications.unread++;
  renderNotifications();
  showToast(msg, type);
}

function renderNotifications() {
  const count = document.getElementById("notificationCount");
  const panel = document.getElementById("notificationPanel");

  // unread badge on bell
  if (app.notifications.unread > 0) {
    count.textContent = app.notifications.unread;
    count.style.display = "inline-block";
  } else {
    count.style.display = "none";
  }

  // clear panel
  panel.innerHTML = "";

  if (!app.notifications.list.length) {
    panel.innerHTML = `<p style="text-align:center;color:#aaa;">No notifications</p>`;
    return;
  }

  // category badges
  const catBadges = {
    lead: '<span class="badge badge-lead">LEAD</span>',
    property: '<span class="badge badge-property">PROPERTY</span>',
    task: '<span class="badge badge-task">TASK</span>',
    client: '<span class="badge badge-client">CLIENT</span>',
    info: '<span class="badge">INFO</span>'
  };

  // action badges (inline replacements)
  const actBadges = {
    deleted: '<span class="badge badge-deleted">DELETED</span>',
    saved: '<span class="badge badge-saved">SAVED</span>',
    updated: '<span class="badge badge-updated">UPDATED</span>',
    assigned: '<span class="badge badge-assigned">ASSIGNED</span>',
    completed: '<span class="badge badge-completed">COMPLETED</span>'
  };

  app.notifications.list.forEach(n => {
    const item = document.createElement("div");
    item.className = "notif-item " + (n.read ? "read" : "unread");

    // detect category by keyword
    let category = "info";
    if (/lead/i.test(n.msg)) category = "lead";
    else if (/property/i.test(n.msg)) category = "property";
    else if (/task/i.test(n.msg)) category = "task";
    else if (/buyer|seller/i.test(n.msg)) category = "client";

    // replace keywords in message with badges (case-insensitive)
    let msgHtml = n.msg;
    Object.keys(actBadges).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, "ig");
      msgHtml = msgHtml.replace(regex, actBadges[key]);
    });

    item.innerHTML = `
      ${catBadges[category] || catBadges.info}
      <span style="flex:1; margin-left:8px;">${msgHtml}</span>
      <span class="dismiss" onclick="markNotificationRead(${n.id}); event.stopPropagation();">✖</span>
    `;

    item.onclick = () => markNotificationRead(n.id);
    panel.appendChild(item);
  });

  // mark all read
  const markAll = document.createElement("button");
  markAll.textContent = "Mark All Read";
  markAll.className = "notif-markall";
  markAll.onclick = markAllRead;
  panel.appendChild(markAll);
}





function toggleNotificationPanel() {
  document.getElementById("notificationPanel").classList.toggle("show");
}

function markNotificationRead(id) {
  const n = app.notifications.list.find(x => x.id === id);
  if (n && !n.read) {
    n.read = true;
    app.notifications.unread--;
    renderNotifications();
  }
}

function markAllRead() {
  app.notifications.list.forEach(n => (n.read = true));
  app.notifications.unread = 0;
  renderNotifications();
}



// ----------------- Universal Helpers -----------------

/**
 * Extract a clean ID string from any API response
 */
function extractId(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (res.id) return res.id;
  if (res.ID) return res.ID;
  if (res.result && (res.result.id || res.result.ID)) return res.result.id || res.result.ID;
  return '';
}

/**
 * Build a nice display label for entities
 * Falls back in priority: Name > Title > Notes > Type > Phone > Location > #ID
 */
function formatLabel(entity, fallbackId) {
  if (!entity) return `#${fallbackId}`;
  if (entity.Name) return entity.Name;
  if (entity.Title) return entity.Title;
  if (entity.Notes) return entity.Notes;
  if (entity.Type) return entity.Type;
  if (entity.Phone) return entity.Phone;
  if (entity.Location) return entity.Location;
  return `#${entity.ID || fallbackId}`;
}

/**
 * Safe notification wrapper
 */
function safeNotify(msg, type = 'info') {
  try {
    if (typeof addNotification === 'function') {
      return addNotification(msg, type);
    }
    if (window.app && window.app.notifications) {
      window.app.notifications.list.unshift({
        id: Date.now(),
        msg,
        type,
        read: false
      });
      window.app.notifications.unread =
        (window.app.notifications.unread || 0) + 1;
      if (typeof renderNotifications === 'function') renderNotifications();
    } else {
      console.info('Notification:', type, msg);
    }
  } catch (e) {
    console.warn('safeNotify failed', e);
  }
}


function isLeadDue(lead) {
  try {
    if (!lead || !lead["Followups (JSON)"]) return false;

    let followups = [];
    if (typeof lead["Followups (JSON)"] === "string") {
      followups = JSON.parse(lead["Followups (JSON)"] || "[]");
    } else if (Array.isArray(lead["Followups (JSON)"])) {
      followups = lead["Followups (JSON)"];
    }
    if (!followups.length) return false;

    const last = followups[followups.length - 1];
    if (!last.date) return false;

    const dueDate = new Date(last.date);
    if (isNaN(dueDate)) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate <= today && lead.Status !== "Closed";
  } catch (err) {
    console.error("isLeadDue error:", err);
    return false;
  }
}

function isPropertyExpiringSoon(prop) {
  if (!prop || !prop.ExpiryDate) return false;
  const due = new Date(prop.ExpiryDate);
  if (isNaN(due)) return false;

  const now = new Date();
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7; // configurable window
}

function getPropertyModeSummary(properties) {
  const summary = {};
  properties.forEach(p => {
    const mode = (p.Mode || "Unknown").trim();
    if (!summary[mode]) summary[mode] = 0;
    summary[mode]++;
  });

  // Convert to multi-line string
  return Object.entries(summary)
    .map(([mode, count]) => `${mode} = ${count}`)
    .join("\n");
}

function formatDateForInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toISOString().slice(0, 10); // "yyyy-MM-dd"
}

/* ---------- Interactive CRM Dashboard (drop into realestate.js) ---------- */

/* ================= CRM Dashboard Integration (Fixed + Revenue Badge + Toggle + Breakdown) ================= */
(function () {
  function crmDash_formatTooltip(items, key = "Name") {
    try { return items.map(i => i[key] || i.Notes || i.Mode).join("\n"); }
    catch (e) { return ""; }
  }

  function crmDash_createTooltipBadge(element, badgeText, tooltipContent, badgeClass = "") {
    if (!element) return;
    element.textContent = badgeText;
    element.className = "crmDash_badge " + badgeClass;
    const existing = element.querySelector(".crmDash_tooltip-text");
    if (existing) existing.remove();
    const tooltip = document.createElement("div");
    tooltip.className = "crmDash_tooltip-text";
    tooltip.textContent = tooltipContent;
    element.classList.add("crmDash_custom-tooltip");
    element.appendChild(tooltip);
  }

  /* ================= Timeline ================= */
  function crmDash_updateTimeline(data, leadId) {
    const container = document.getElementById("crmDash_timeline");
    if (!container) return;
    container.innerHTML = "";

    let activities = [];
    const lead = (data.leads || []).find(l => l.ID === leadId);

    // Build activities from Followups
    if (lead && lead["Followups (JSON)"]) {
      try {
        const followups = JSON.parse(lead["Followups (JSON)"]);
        followups.forEach(f => {
          activities.push({
            date: f.date,
            type: "Follow-up",
            description: f.note || "",
            status: f.outcome || "Planned"
          });
        });
      } catch (e) { console.warn("Bad followups JSON", e); }
    }

    // Build activities from Tasks
    (data.tasks || []).filter(t => t.LeadID === leadId).forEach(t => {
      activities.push({
        date: t.DueDate,
        type: t.Type,
        description: t.Notes || "",
        status: t.Status
      });
    });

    // Sort activities newest first
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById("crmDash_timeline-count").textContent = `${activities.length} Activities`;

    if (activities.length === 0) {
      container.innerHTML = `<div class="crmDash_timeline-item">No activities for this lead.</div>`;
      return;
    }

    // Type → color & icon mapping
    const typeMap = {
      "Follow-up": { color: "#1e90ff", icon: "repeat" },
      "Call": { color: "#4caf50", icon: "phone" },
      "Meeting": { color: "#ff9800", icon: "calendar" },
      "Site Visit": { color: "#e91e63", icon: "map-pin" }
    };

    activities.forEach((act, index) => {
      const div = document.createElement("div");
      div.className = "crmDash_timeline-item";

      const typeInfo = typeMap[act.type] || { color: "#777", icon: "circle" };

      div.innerHTML = `
      <span class="crmDash_time">${new Date(act.date).toLocaleDateString()}</span>
      <span class="crmDash_dot" style="background-color: rgba(255,255,255,0.1)">
        <i data-lucide="${typeInfo.icon}" class="crmDash_icon" style="color:${typeInfo.color}"></i>
      </span>
      <span class="crmDash_type">${act.type}</span>
      <span class="crmDash_description">${act.description}</span>
      <span class="crmDash_status crmDash_status-${(act.status || "").toLowerCase()}">${act.status}</span>
    `;

      // Alternate row shading
      if (index % 2 === 0) div.classList.add("crmDash_row-even");

      container.appendChild(div);
    });

    // Properly initialize Lucide icons
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }



  /* ================= Properties ================= */
  function crmDash_updateProperties(data, leadId) {
    const lead = (data.leads || []).find(l => l.ID === leadId);
    if (!lead) return;

    const filtered = (data.properties || []).filter(p => p.ID === lead.PropertyID);
    const summary = {};
    filtered.forEach(p => { summary[p.Mode] = (summary[p.Mode] || 0) + 1; });

    crmDash_createTooltipBadge(
      document.getElementById("crmDash_properties-badge"),
      `${filtered.length} Properties`,
      Object.entries(summary).map(([k, v]) => `${k}=${v}`).join("\n")
    );

    const table = document.getElementById("crmDash_properties-table-body");
    if (table) table.innerHTML = "";
    filtered.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.Title}</td><td>${p.Mode}</td><td>${p.Status || ""}</td>`;
      table.appendChild(tr);
    });

    const ctx = document.getElementById("crmDash_properties-chart")?.getContext("2d");
    if (ctx) {
      if (window.crmDash_propChart) window.crmDash_propChart.destroy();
      window.crmDash_propChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: Object.keys(summary),
          datasets: [{ data: Object.values(summary), backgroundColor: ["#1e90ff", "#ff9933", "#52c41a"] }]
        },
        options: { responsive: true }
      });
    }
  }

  /* ================= Tasks ================= */
  function crmDash_updateTasks(data, leadId) {
    const filtered = (data.tasks || []).filter(t => t.LeadID === leadId);
    crmDash_createTooltipBadge(
      document.getElementById("crmDash_tasks-badge"),
      `${filtered.length} Tasks`,
      crmDash_formatTooltip(filtered, "Notes")
    );

    const table = document.getElementById("crmDash_tasks-table-body");
    if (table) table.innerHTML = "";
    filtered.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${t.Notes || t.Type}</td><td>${t.Status}</td>`;
      table.appendChild(tr);
    });

    const counts = {
      Overdue: filtered.filter(t => t.Status === "Overdue").length,
      Open: filtered.filter(t => t.Status === "Open").length,
      Done: filtered.filter(t => t.Status === "Done").length,
      Rescheduled: filtered.filter(t => t.Status === "Rescheduled").length
    };

    const ctx = document.getElementById("crmDash_tasks-chart")?.getContext("2d");
    if (ctx) {
      if (window.crmDash_taskChart) window.crmDash_taskChart.destroy();
      window.crmDash_taskChart = new Chart(ctx, {
        type: "bar",
        data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ["#ff4d4f", "#1e90ff", "#52c41a", "#ff9933"] }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  /* ================= Buyers & Sellers ================= */
  function crmDash_updateBuyersSellers(data, leadId) {
    const lead = (data.leads || []).find(l => l.ID === leadId);
    if (!lead) return;

    const buyersFiltered = (data.buyers || []).filter(b => b.ID === lead.BuyerID);
    const prop = (data.properties || []).find(p => p.ID === lead.PropertyID);
    const sellersFiltered = (data.sellers || []).filter(s => s.ID === prop?.Seller);

    crmDash_createTooltipBadge(document.getElementById("crmDash_buyers-badge"), `${buyersFiltered.length} Buyers`, crmDash_formatTooltip(buyersFiltered));
    crmDash_createTooltipBadge(document.getElementById("crmDash_sellers-badge"), `${sellersFiltered.length} Sellers`, crmDash_formatTooltip(sellersFiltered));

    const buyersTable = document.getElementById("crmDash_buyers-table-body");
    if (buyersTable) buyersTable.innerHTML = "";
    buyersFiltered.forEach(b => { buyersTable.innerHTML += `<tr><td>${b.Name}</td></tr>`; });

    const sellersTable = document.getElementById("crmDash_sellers-table-body");
    if (sellersTable) sellersTable.innerHTML = "";
    sellersFiltered.forEach(s => { sellersTable.innerHTML += `<tr><td>${s.Name}</td></tr>`; });
  }

  /* ================= Revenue ================= */
  function crmDash_updateRevenue(data, leadId) {
    // Simulated dataset fallback
    let dataset = [];
    const lead = (data.leads || []).find(l => l.ID === leadId);
    const prop = (data.properties || []).find(p => p.ID === lead?.PropertyID);

    const toggle = document.getElementById("crmDash_revenue-toggle");
    const actualMode = toggle?.checked;

    if (actualMode) {
      // Hardcoded demo values until actual sheet is available
      dataset = [0, 2000000, 0, 8500000, 0, 4200000, 0];
    } else if (prop?.Price) {
      const price = parseInt(prop.Price, 10);
      dataset = [
        price * 0.1,
        price * 0.05,
        price * 0.15,
        price * 0.2,
        price * 0.1,
        price * 0.25,
        price * 0.15
      ];
    }

    // 🆕 Ensure breakdown div exists
    const badge = document.getElementById("crmDash_revenue-total");
    let breakdown = document.getElementById("crmDash_revenue-breakdown");
    if (badge && !breakdown) {
      breakdown = document.createElement("div");
      breakdown.id = "crmDash_revenue-breakdown";
      breakdown.className = "crmDash_tooltip-text";
      badge.appendChild(breakdown);
    }

    // 🆕 Update Revenue Badge + Breakdown
    const total = dataset.reduce((a, b) => a + b, 0);
    if (badge) {
      badge.firstChild.textContent = "₹" + total.toLocaleString("en-IN"); // keeps number
      badge.style.background = actualMode ? "#52c41a" : "#1e90ff";
    }
    if (breakdown) {
      breakdown.textContent = dataset
        .map((val, idx) =>
          `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"][idx]}: ₹${val.toLocaleString("en-IN")}`
        )
        .join("\n");
    }

    // Chart
    const ctx = document.getElementById("crmDash_revenue-chart")?.getContext("2d");
    if (ctx) {
      if (window.crmDash_revenueChart) window.crmDash_revenueChart.destroy();
      window.crmDash_revenueChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"],
          datasets: [{
            label: actualMode ? "Actual Revenue" : "Simulated Revenue",
            data: dataset,
            borderColor: actualMode ? "#52c41a" : "#1e90ff",
            backgroundColor: actualMode ? "rgba(82,196,26,0.2)" : "rgba(30,144,255,0.2)",
            fill: true,
            tension: 0.3
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  /* ================= Summary ================= */
  function crmDash_updateSummaryCards(data) {
    document.getElementById("crmDash_summary-leads-value").textContent = (data.leads || []).length;
    document.getElementById("crmDash_summary-properties-value").textContent = (data.properties || []).length;
    document.getElementById("crmDash_summary-tasks-value").textContent = (data.tasks || []).length;
    document.getElementById("crmDash_summary-buyers-value").textContent = (data.buyers || []).length;
    document.getElementById("crmDash_summary-sellers-value").textContent = (data.sellers || []).length;
  }

  /* ================= Refresh Entry ================= */
  window.crmDash_refresh = function (data) {
    if (!data || !data.leads) return;

    const leadsTable = document.getElementById("crmDash_leads-table-body");
    if (leadsTable) leadsTable.innerHTML = "";

    (data.leads || []).forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="crmDash_lead-clickable" data-leadid="${l.ID}">${l.Name}</td><td>${l.Status}</td>`;
      leadsTable.appendChild(tr);
    });

    let selectedLeadId = (data.leads || [])[0]?.ID || null;

    document.querySelectorAll(".crmDash_lead-clickable").forEach(el => {
      el.addEventListener("click", e => {
        selectedLeadId = e.target.dataset.leadid;
        crmDash_updateTimeline(data, selectedLeadId);
        crmDash_updateProperties(data, selectedLeadId);
        crmDash_updateTasks(data, selectedLeadId);
        crmDash_updateBuyersSellers(data, selectedLeadId);
        crmDash_updateRevenue(data, selectedLeadId);
        document.getElementById("crmDash_leads-badge").textContent =
          `Selected Lead: ${(data.leads || []).find(l => l.ID === selectedLeadId)?.Name || ""}`;
      });
    });

    if (selectedLeadId) {
      crmDash_updateTimeline(data, selectedLeadId);
      crmDash_updateProperties(data, selectedLeadId);
      crmDash_updateTasks(data, selectedLeadId);
      crmDash_updateBuyersSellers(data, selectedLeadId);
      crmDash_updateRevenue(data, selectedLeadId);
      document.getElementById("crmDash_leads-badge").textContent =
        `Selected Lead: ${(data.leads || []).find(l => l.ID === selectedLeadId)?.Name || ""}`;
    }

    // Bind toggle switch once
    const toggle = document.getElementById("crmDash_revenue-toggle");
    if (toggle && !toggle._bound) {
      toggle.addEventListener("change", () => crmDash_updateRevenue(data, selectedLeadId));
      toggle._bound = true;
    }

    crmDash_updateSummaryCards(data);
  };
})();

function positionMenu(menu, clickEvent) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const menuRect = menu.getBoundingClientRect();

  let left = clickEvent.pageX;
  let top = clickEvent.pageY;

  // Adjust if overflowing right
  if (left + menuRect.width > viewportWidth) {
    left = viewportWidth - menuRect.width - 10;
  }

  // Adjust if overflowing bottom
  if (top + menuRect.height > viewportHeight) {
    top = viewportHeight - menuRect.height - 10;
  }

  menu.style.left = left + "px";
  menu.style.top = top + "px";
  menu.style.display = "flex";
}


// Context Menu logic
function attachTaskContextMenu() {
  const menu = document.getElementById("taskContextMenu");
  const tbody = document.getElementById("tasksTable");
  let currentTaskId = null;

  tbody.oncontextmenu = null;

  tbody.addEventListener("contextmenu", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const taskId = row.getAttribute("data-id");
    if (!taskId) return console.warn("⚠️ Row has no data-id!");

    e.preventDefault();
    currentTaskId = taskId;

    // highlight row
    tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    row.classList.add("selected-row");

    // position and show menu
    positionMenu(menu, e);

    console.log("Right-clicked row ID:", currentTaskId);
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = "none";
      currentTaskId = null;
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    }
  });

  menu.querySelector('[data-action="edit"]').onclick = () => {
    if (currentTaskId) app.openTaskModal(currentTaskId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="delete"]').onclick = () => {
    if (currentTaskId) app.deleteTask(currentTaskId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="toggle"]').onclick = () => {
    if (currentTaskId) app.toggleTask(currentTaskId);
    menu.style.display = "none";
  };
}


function applyContextMenuIconColors() {
  const map = {
    toggle: '#22c55e', // green
    edit: '#3b82f6', // blue
    delete: '#ef4444'  // red
  };

  Object.entries(map).forEach(([action, color]) => {
    const btn = document.querySelector(`#taskContextMenu [data-action="${action}"]`);
    if (!btn) return;

    // Button text color (currentColor for hover transitions)
    btn.style.color = color;

    // SVG inside (Lucide replaces <i> with <svg>)
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.stroke = color;
      svg.style.fill = "none";   // keep transparent interior
      svg.setAttribute('stroke', color);
    }
  });
}

// 🔹 Apply custom colors for Leads actions
function applyContextMenuIconColorsLeads() {
  const map = {
    edit: '#3b82f6',  // blue
    followup: '#f59e0b',  // amber
    matches: '#8b5cf6',  // violet
    delete: '#ef4444',  // red
    whatsapp: '#22c55e'   // green
  };

  Object.entries(map).forEach(([action, color]) => {
    const btn = document.querySelector(`#leadContextMenu [data-action="${action}"]`);
    if (!btn) return;

    // set base color (applies to text and icons via currentColor)
    btn.style.color = color;

    // update Lucide svg
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.stroke = color;
      svg.style.fill = "none";   // keep transparent interior
      svg.setAttribute('stroke', color);
    }

    // add hover effect
    btn.onmouseenter = () => {
      btn.style.color = darkenColor(color, 0.2);
      if (svg) svg.style.stroke = darkenColor(color, 0.2);
    };
    btn.onmouseleave = () => {
      btn.style.color = color;
      if (svg) svg.style.stroke = color;
    };
  });
}



// 🔹 Apply custom colors for Properties actions
function applyContextMenuIconColorsProperties() {
  const map = {
    edit: '#3b82f6',  // blue
    delete: '#ef4444',  // red
    whatsapp: '#22c55e'   // green
  };

  Object.entries(map).forEach(([action, color]) => {
    const btn = document.querySelector(`#propertyContextMenu [data-action="${action}"]`);
    if (!btn) return;

    btn.style.color = color;

    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.stroke = color;
      svg.style.fill = "none";   // keep transparent interior
      svg.setAttribute('stroke', color);
    }

    btn.onmouseenter = () => {
      btn.style.color = darkenColor(color, 0.2);
      if (svg) svg.style.stroke = darkenColor(color, 0.2);
    };
    btn.onmouseleave = () => {
      btn.style.color = color;
      if (svg) svg.style.stroke = color;
    };
  });
}

function darkenColor(hex, amt = 0.2) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const num = parseInt(c, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - amt))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - amt))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - amt))));
  return `rgb(${r},${g},${b})`;
}


function attachLeadContextMenu() {
  const menu = document.getElementById("leadContextMenu");
  const tbody = document.getElementById("leadsTable");
  let currentId = null;

  tbody.oncontextmenu = null;

  tbody.addEventListener("contextmenu", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;

    e.preventDefault();
    currentId = id;

    tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    row.classList.add("selected-row");

    positionMenu(menu, e);
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = "none";
      currentId = null;
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    }
  });

  menu.querySelector('[data-action="edit"]').onclick = () => {
    if (currentId) app.openLeadModal(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="followup"]').onclick = () => {
    if (currentId) app.openFollowup(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="matches"]').onclick = () => {
    if (currentId) app.openMatches(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="delete"]').onclick = () => {
    if (currentId) app.deleteLead(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="whatsapp"]').onclick = () => {
    if (currentId) app.sendWhatsappForLead(currentId);
    menu.style.display = "none";
  };
}


function attachPropertyContextMenu() {
  const menu = document.getElementById("propertyContextMenu");
  const tbody = document.getElementById("propertiesTable");
  let currentId = null;

  tbody.oncontextmenu = null;

  tbody.addEventListener("contextmenu", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (!id) return;

    e.preventDefault();
    currentId = id;

    tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    row.classList.add("selected-row");

    positionMenu(menu, e);
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = "none";
      currentId = null;
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-row"));
    }
  });

  menu.querySelector('[data-action="edit"]').onclick = () => {
    if (currentId) app.openPropertyModal(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="delete"]').onclick = () => {
    if (currentId) app.deleteProperty(currentId);
    menu.style.display = "none";
  };
  menu.querySelector('[data-action="whatsapp"]').onclick = () => {
    if (currentId) app.sendWhatsappForProperty(currentId);
    menu.style.display = "none";
  };
}




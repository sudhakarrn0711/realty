// asset/dashboard-insights.js

document.addEventListener("DOMContentLoaded", () => {
    initTooltips();
    initInsightMessages();
    initChartDrilldowns();
});

function initTooltips() {
    const tooltip = createTooltipElement();
    document.body.appendChild(tooltip);

    document.querySelectorAll('[data-insight="true"]').forEach(elem => {
        elem.addEventListener("mouseenter", () => {
            const text = elem.getAttribute("data-insight-tooltip");
            if (text) showTooltip(tooltip, elem, text);
        });
    });
}

function createTooltipElement() {
    const div = document.createElement("div");
    div.className = "ua-tooltip";
    div.setAttribute("role", "tooltip");
    div.setAttribute("aria-hidden", "true");
    return div;
}

function showTooltip(tooltip, target, text) {
    tooltip.textContent = text;
    tooltip.setAttribute("aria-hidden", "false");

    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
    tooltip.classList.add("show");

    target.addEventListener("mouseleave", () => {
        tooltip.classList.remove("show");
        tooltip.setAttribute("aria-hidden", "true");
    }, { once: true });
}

// Store the last message to avoid duplicates
// Store the last message to avoid duplicates
let lastMessage = '';

function initInsightMessages() {
    setInterval(() => {
        showInsightsBasedOnData();
    }, 5000); // Check every 5 seconds
}

function showInsightsBasedOnData() {
    const hotEl = document.getElementById('kpi-hot');
    const totalEl = document.getElementById('kpi-total');

    if (!hotEl || !totalEl) {
        console.warn("KPI elements not found.");
        return;
    }

    const hotLeads = parseInt(hotEl.dataset.value || extractNumber(hotEl.textContent), 10) || 0;
    const totalLeads = parseInt(totalEl.dataset.value || extractNumber(totalEl.textContent), 10) || 0;

    console.log("Hot Leads:", hotLeads, "Total Leads:", totalLeads);

    // 🚨 Prevent showing useless messages when values are still 0
    if (hotLeads === 0 && totalLeads === 0) {
        return;
    }

    let message = '';
    if (hotLeads > 50) {
        message = `🔥 Hot leads increased by ${hotLeads}% this week.`;
    } else if (totalLeads < 10) {
        message = `📢 Only ${totalLeads} leads available. Consider expanding outreach.`;
    } else {
        message = `📊 Leads are tracking well. Keep up the engagement! (Hot: ${hotLeads}, Total: ${totalLeads})`;
    }

    if (message !== lastMessage) {
        showInsightMessage(message);
        lastMessage = message;
    }
}

function extractNumber(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9]/g, '');
    console.log("Extracted number from text:", text, "=>", cleaned);
    return parseInt(cleaned, 10) || 0;
}

function showInsightMessage(message) {
    const div = document.createElement("div");
    div.className = "ua-insight-message";
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 5000);
}

// Hook: after leads/charts are rendered, reset lastMessage so fresh message shows
if (window.app) {
    const origRenderLeads = app.renderLeads.bind(app);
    app.renderLeads = function () {
        origRenderLeads();
        lastMessage = ''; // reset so valid message will show again
        showInsightsBasedOnData();
    };
}


function initChartDrilldowns() {
    document.querySelectorAll('canvas[data-drilldown]').forEach(canvas => {
        canvas.addEventListener("click", () => {
            const type = canvas.getAttribute("data-drilldown");
            handleDrilldown(type);
        });
    });
}

function handleDrilldown(type) {
    if (type === "source") {
        if (typeof app.openLeadModal === "function") {
            app.openLeadModal();
        }
    } else if (type === "status") {
        if (typeof app.openTaskModal === "function") {
            app.openTaskModal();
        }
    }
}

// enhancements.js
(function () {
  const Enhancements = {};

  // ---------------------------
  // 1️⃣ Real-time Validation
  // ---------------------------
  Enhancements.initValidation = function (modalRoot) {
    if (!modalRoot) return;

    const showError = (el, msg) => {
      el.classList.add('input-error');
      let errorEl = el.nextElementSibling;
      if (!errorEl || !errorEl.classList.contains('error-msg')) {
        errorEl = document.createElement('div');
        errorEl.className = 'error-msg';
        errorEl.style.color = 'red';
        errorEl.style.fontSize = '12px';
        errorEl.style.marginTop = '2px';
        el.parentNode.appendChild(errorEl);
      }
      errorEl.textContent = msg;
    };

    const clearError = el => {
      el.classList.remove('input-error');
      const errorEl = el.nextElementSibling;
      if (errorEl && errorEl.classList.contains('error-msg')) errorEl.textContent = '';
    };

    modalRoot.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => {
        if (el.id.includes('name') && !el.value.trim()) showError(el, 'This field is required');
        else if (el.id.includes('phone') && !/^\d{7,15}$/.test(el.value.trim())) showError(el, 'Invalid phone');
        else if (el.id.includes('email') && el.value && !/^[^@]+@[^@]+\.[^@]+$/.test(el.value.trim())) showError(el, 'Invalid email');
        else if (el.id.includes('budget') || el.id.includes('price')) {
          if (el.value && isNaN(el.value)) showError(el, 'Must be a number');
          else clearError(el);
        } else clearError(el);
      });
    });
  };

  // ---------------------------
  // 2️⃣ Autocomplete / Smart Suggestions
  // ---------------------------
  Enhancements.initAutocomplete = function (modalRoot, liveData) {
    if (!modalRoot) return;

    const autocompleteList = (input, list) => {
      input.addEventListener('input', () => {
        let value = input.value.toLowerCase();
        let suggestions = list.filter(x => x.toLowerCase().includes(value));
        let datalistId = input.dataset.listId || (input.id + '-list');
        let datalist = document.getElementById(datalistId);
        if (!datalist) {
          datalist = document.createElement('datalist');
          datalist.id = datalistId;
          document.body.appendChild(datalist);
          input.setAttribute('list', datalistId);
        }
        datalist.innerHTML = '';
        suggestions.forEach(x => {
          let option = document.createElement('option');
          option.value = x;
          datalist.appendChild(option);
        });
      });
    };

    const locationInput = modalRoot.querySelector('#lead-location, #p-location');
    if (locationInput && liveData.locations) autocompleteList(locationInput, liveData.locations);

    const cityInput = modalRoot.querySelector('#lead-city, #p-city');
    if (cityInput && liveData.cities) autocompleteList(cityInput, liveData.cities);

    const propTypeInput = modalRoot.querySelector('#lead-type, #p-type');
    if (propTypeInput && liveData.propertyTypes) autocompleteList(propTypeInput, liveData.propertyTypes);
  };

  // ---------------------------
  // 3️⃣ Bulk Entry / CSV Upload
  // ---------------------------
Enhancements.initBulkUpload = function (modalRoot, callback) {
  if (!modalRoot) return;

  const fileInput = modalRoot.querySelector('.bulk-upload');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Split into rows and clean empty lines
      const lines = text.split(/\r?\n/).filter(r => r.trim());
      if (lines.length < 2) {
        alert("CSV must have header + at least 1 row");
        return;
      }

      // First row = header
      const headers = lines[0].split(',').map(h => h.trim());

      // Remaining rows → objects
      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        let obj = {};
        headers.forEach((h, i) => obj[h] = values[i] || '');
        return obj;
      });

      if (callback && typeof callback === 'function') callback(rows);

      alert(`Imported ${rows.length} rows successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to read CSV: " + err.message);
    }
  });
};


  // ---------------------------
  // 4️⃣ Initialize Enhancements on Modal Open
  // ---------------------------
  Enhancements.applyToModal = function (modalRoot, liveData = {}, bulkCallback) {
    Enhancements.initValidation(modalRoot);
    Enhancements.initAutocomplete(modalRoot, liveData);
    Enhancements.initBulkUpload(modalRoot, bulkCallback);
  };

  // ---------------------------
  // 5️⃣ Export for app usage
  // ---------------------------
  window.ModalEnhancements = Enhancements;
})();

function renderEnhancedCharts(data) {
  console.log("🚀 Rendering enhanced charts from renderEnhancedCharts()");

  const container = document.getElementById("crmDash_enhanced-charts");
  const toggles = document.getElementById("crmDash_chart-toggles");
  if (!container || !toggles) return console.warn("Chart container or toggles not found!");

  container.innerHTML = "";
  toggles.innerHTML = "";

  const neonColors = ["#00fff7", "#ff00ff", "#fffc00", "#ff3c00", "#00ff92"];
  const neonLabelColor = "#00fff7";
  const glassBackground = "rgba(0,0,0,0.5)";

  const chartIds = ["chart_monthly_leads", "chart_leads_source", "chart_properties_forecast", "chart_tasks_status"];

  const createChartDiv = (id) => {
    const div = document.createElement("div");
    div.id = id;
    div.style.flex = "1 1 300px";
    div.style.minWidth = "300px";
    div.style.height = "300px";
    div.style.background = glassBackground;
    div.style.borderRadius = "16px";
    div.style.backdropFilter = "blur(10px)";
    div.style.padding = "10px";
    div.style.boxShadow = "0 0 12px rgba(0,255,255,0.3)";
    div.style.display = "none"; // hide initially
    return div;
  };

  // Create chart divs
  chartIds.forEach(id => container.appendChild(createChartDiv(id)));

  // --- 1️⃣ Monthly Leads Chart ---
  const monthlyLeads = Array(12).fill(0);
  data.leads.forEach(lead => {
    const month = new Date(lead.DOB || lead.Date || new Date()).getMonth();
    monthlyLeads[month]++;
  });
  new ApexCharts(document.getElementById("chart_monthly_leads"), {
    chart: { type: 'bar', height: 300, background: glassBackground, foreColor: neonLabelColor },
    series: [{ name: "Leads", data: monthlyLeads }],
    plotOptions: { bar: { borderRadius: 8, columnWidth: '50%' } },
    xaxis: { categories: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], labels: { style: { colors: neonColors } } },
    yaxis: { labels: { style: { colors: neonColors } } },
    tooltip: { theme: "dark" },
    colors: [neonColors[0]],
    fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: [neonColors[0]], opacityFrom: 0.7, opacityTo: 0.3 } }
  }).render();

  // --- 2️⃣ Leads by Source (Donut) ---
  const sourceCounts = {};
  data.leads.forEach(l => sourceCounts[l.Source || l.source] = (sourceCounts[l.Source || l.source] || 0)+1);
  new ApexCharts(document.getElementById("chart_leads_source"), {
    chart: { type: 'donut', height: 300, background: glassBackground, foreColor: neonLabelColor },
    series: Object.values(sourceCounts),
    labels: Object.keys(sourceCounts),
    colors: neonColors,
    plotOptions: { pie: { donut: { size: '50%', labels: { show: true, name: { color: neonLabelColor }, value: { color: neonLabelColor } } } } },
    tooltip: { theme: 'dark' }
  }).render();

  // --- 3️⃣ Properties Forecast (Line) ---
  const forecastData = data.properties.map(p => Number(p.Budget || p.budget || 0));
  new ApexCharts(document.getElementById("chart_properties_forecast"), {
    chart: { type: 'line', height: 300, background: glassBackground, foreColor: neonLabelColor },
    series: [{ name: "Forecast", data: forecastData }],
    stroke: { curve: 'smooth', width: 4, colors: [neonColors[1]] },
    markers: { size: 6, colors: neonColors[1], strokeColors: '#000', strokeWidth: 2 },
    xaxis: { labels: { style: { colors: neonColors } } },
    yaxis: { labels: { style: { colors: neonColors } } },
    grid: { borderColor: 'rgba(255,255,255,0.1)' },
    fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: [neonColors[1]], opacityFrom: 0.4, opacityTo: 0 } },
    tooltip: { theme: 'dark' }
  }).render();

  // --- 4️⃣ Tasks by Status (Pie) ---
  const statusCounts = {};
  data.tasks.forEach(t => statusCounts[t.Status || t.status] = (statusCounts[t.Status || t.status] || 0)+1);
  new ApexCharts(document.getElementById("chart_tasks_status"), {
    chart: { type: 'pie', height: 300, background: glassBackground, foreColor: neonLabelColor },
    series: Object.values(statusCounts),
    labels: Object.keys(statusCounts),
    colors: neonColors,
    tooltip: { theme: 'dark' }
  }).render();

  // --- Create toggle buttons ---
  chartIds.forEach((id, index) => {
    const btn = document.createElement("button");
    btn.textContent = id.replace("chart_", "").replace(/_/g, " ").toUpperCase();
    btn.style.background = glassBackground;
    btn.style.color = neonLabelColor;
    btn.style.border = "1px solid " + neonLabelColor;
    btn.style.padding = "6px 14px";
    btn.style.borderRadius = "8px";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 0 8px " + neonColors[index % neonColors.length];
    btn.style.transition = "all 0.3s";
    btn.addEventListener("click", () => {
      // Hide all charts
      chartIds.forEach(cid => document.getElementById(cid).style.display = "none");
      // Show selected chart
      document.getElementById(id).style.display = "block";
      // Update active button glow
      Array.from(toggles.children).forEach(b => b.style.boxShadow = "0 0 8px rgba(0,0,0,0.2)");
      btn.style.boxShadow = "0 0 16px " + neonColors[index % neonColors.length];
    });
    toggles.appendChild(btn);
  });

  // Show first chart by default
  document.getElementById(chartIds[0]).style.display = "block";
  toggles.children[0].style.boxShadow = "0 0 16px " + neonColors[0];

  console.log("✅ Enhanced charts rendered with toggles!");
}

app.openBulkUpload = function() {
  const html = `
    <h3>Bulk Upload Leads</h3>
    <p>Upload an Excel file (.xlsx) with headers matching your Leads sheet. 
       <br/>⚠️ <b>ID</b>, <b>BuyerID</b> and <b>Followups (JSON)</b> will be auto-generated/ignored.</p>
    <input type="file" id="bulk-file" accept=".xlsx" />
    <a href="sample_leads.xlsx" download style="font-size:12px; display:block; margin-top:5px; color:blue; text-decoration:underline;">
      Download Sample Excel
    </a>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>
  `;
  this.openModal(html);

  const fileInput = document.getElementById('bulk-file');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed Excel rows:", rows);

      if (!rows.length) {
        alert("Excel is empty!");
        return;
      }

      let success = 0, failed = 0;

      for (const r of rows) {
        try {
          const l = {
            ID: '',            // auto
            BuyerID: '',       // auto
            Name: r.Name || '',
            Phone: r.Phone || '',
            Email: r.Email || '',
            City: r.City || '',
            Location: r.Location || '',
            Purpose: r.Purpose || '',
            PropertyType: r.PropertyType || 'Flat',
            Budget: r.Budget || '',
            Priority: r.Priority || '',
            Agent: r.Agent || '',
            FinancingType: r.FinancingType || '',
            BuyingWindow: r.BuyingWindow || '',
            Occupation: r.Occupation || '',
            Source: r.Source || 'Website',
            Status: r.Status || 'New',
            PropertyID: r.PropertyID || '',
            NextFollowupDate: r.NextFollowupDate || '',
            LeadDate: r.LeadDate || new Date().toISOString().slice(0,10),
            LeadScore: Number(r.LeadScore || 0),
            "Followups (JSON)": "[]",  // keep empty
            Remark: r.Remark || ''
          };

          const res = await remote.add('Leads', l);
          l.ID = extractId(res) || l.ID;
          success++;
        } catch (err) {
          console.error("❌ Failed row:", r, err);
          failed++;
        }
      }

      await this.reloadFromServer();
      this.renderLeads();
      this.closeModal();
      safeNotify(`✅ Imported ${success} leads, ❌ Failed: ${failed}`, failed ? 'warning' : 'success');

    } catch (err) {
      console.error(err);
      alert("Failed to read Excel: " + err.message);
    }
  });
};

app.openBulkUploadProperties = function() {
  const html = `
    <h3>Bulk Upload Properties</h3>
    <p>Upload an Excel file (.xlsx) with headers matching your Properties sheet.
       <br/>⚠️ <b>ID</b> and <b>Seller</b> will be auto-generated/ignored.</p>
    <input type="file" id="bulk-property-file" accept=".xlsx" />
    <a href="sample_properties.xlsx" download style="font-size:12px; display:block; margin-top:5px; color:blue; text-decoration:underline;">
      Download Sample Excel
    </a>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>
  `;
  this.openModal(html);

  const fileInput = document.getElementById('bulk-property-file');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // First sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed property rows:", rows);

      if (!rows.length) {
        alert("Excel is empty!");
        return;
      }

      let success = 0, failed = 0;

      for (const r of rows) {
        try {
          const p = {
            ID: '',          // auto
            Seller: '',      // auto
            Title: r.Title || '',
            FullAddress: r.FullAddress || '',
            City: r.City || '',
            Location: r.Location || '',
            Type: r.Type || '',
            Mode: r.Mode || '', // e.g., Sale / Rent
            Size: r.Size || '',
            Price: r.Price || '',
            Bedrooms: r.Bedrooms || '',
            Bathrooms: r.Bathrooms || '',
            Furnishing: r.Furnishing || '',
            Amenities: r.Amenities || '',
            Facing: r.Facing || '',
            ConstructionStatus: r.ConstructionStatus || '',
            Age: r.Age || '',
            Availability: r.Availability || '',
            AssignedTo: r.AssignedTo || '',
            Owner: r.Owner || '',
            ListedDate: r.ListedDate || new Date().toISOString().slice(0,10),
            MediaURLs: r.MediaURLs || '',
            Remark: r.Remark || ''
          };

          const res = await remote.add('Properties', p);
          p.ID = extractId(res) || p.ID;
          success++;
        } catch (err) {
          console.error("❌ Failed row:", r, err);
          failed++;
        }
      }

      await this.reloadFromServer();
      this.renderProperties();
      this.closeModal();
      safeNotify(`✅ Imported ${success} properties, ❌ Failed: ${failed}`, failed ? 'warning' : 'success');

    } catch (err) {
      console.error(err);
      alert("Failed to read Excel: " + err.message);
    }
  });
};

app.openBulkUploadTasks = function() {
  const html = `
    <h3>Bulk Upload Tasks</h3>
    <p>Upload an Excel file (.xlsx) with headers matching your Tasks sheet.
       <br/>⚠️ <b>ID</b> will be auto-generated by the script.</p>
    <input type="file" id="bulk-task-file" accept=".xlsx" />
    <a href="sample_tasks.xlsx" download style="font-size:12px; display:block; margin-top:5px; color:blue; text-decoration:underline;">
      Download Sample Excel
    </a>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>
  `;
  this.openModal(html);

  const fileInput = document.getElementById('bulk-task-file');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // First sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed task rows:", rows);

      if (!rows.length) {
        alert("Excel is empty!");
        return;
      }

      let success = 0, failed = 0;

      for (const r of rows) {
        try {
          const t = {
            ID: '',  // auto
            DueDate: r.DueDate || '',
            Type: r.Type || '',
            Status: r.Status || '',
            Priority: r.Priority || '',
            LeadID: r.LeadID || '',
            PropertyID: r.PropertyID || '',
            AssignedTo: r.AssignedTo || '',
            CreatedBy: r.CreatedBy || '',
            ReminderTime: r.ReminderTime || '',
            Outcome: r.Outcome || '',
            NextAction: r.NextAction || '',
            Category: r.Category || '',
            Attachments: r.Attachments || '',
            Notes: r.Notes || '',
            CreatedAt: r.CreatedAt || new Date().toISOString(),
            UpdatedAt: r.UpdatedAt || new Date().toISOString()
          };

          const res = await remote.add('Tasks', t);
          t.ID = extractId(res) || t.ID;
          success++;
        } catch (err) {
          console.error("❌ Failed row:", r, err);
          failed++;
        }
      }

      await this.reloadFromServer();
      this.renderTasks();
      this.closeModal();
      safeNotify(`✅ Imported ${success} tasks, ❌ Failed: ${failed}`, failed ? 'warning' : 'success');

    } catch (err) {
      console.error(err);
      alert("Failed to read Excel: " + err.message);
    }
  });
};

app.openBulkUploadBuyers = function () {
  const html = `
    <h3>Bulk Upload Buyers</h3>
    <p>Upload an Excel file (.xlsx) with headers matching your <b>Buyers</b> sheet.
       <br/>⚠️ <b>ID</b> will be auto-generated by the script.</p>
    <input type="file" id="bulk-buyer-file" accept=".xlsx" />
    <a href="sample_buyers.xlsx" download style="font-size:12px; display:block; margin-top:5px; color:blue; text-decoration:underline;">
      Download Sample Excel
    </a>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>
  `;
  this.openModal(html);

  const fileInput = document.getElementById("bulk-buyer-file");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // First sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed buyer rows:", rows);

      if (!rows.length) {
        alert("Excel is empty!");
        return;
      }

      let success = 0,
        failed = 0;

      for (const r of rows) {
        try {
          const b = {
            ID: "", // auto
            Name: r.Name || "",
            Phone: r.Phone || "",
            Email: r.Email || "",
          };

          const res = await remote.add("Buyers", b);
          b.ID = extractId(res) || b.ID;
          success++;
        } catch (err) {
          console.error("❌ Failed row:", r, err);
          failed++;
        }
      }

      await this.reloadFromServer();
      this.renderBuyers();
      this.closeModal();
      safeNotify(
        `✅ Imported ${success} buyers, ❌ Failed: ${failed}`,
        failed ? "warning" : "success"
      );
    } catch (err) {
      console.error(err);
      alert("Failed to read Excel: " + err.message);
    }
  });
};

app.openBulkUploadSellers = function () {
  const html = `
    <h3>Bulk Upload Sellers</h3>
    <p>Upload an Excel file (.xlsx) with headers matching your <b>Sellers</b> sheet.
       <br/>⚠️ <b>ID</b> will be auto-generated by the script.</p>
    <input type="file" id="bulk-seller-file" accept=".xlsx" />
    <a href="sample_sellers.xlsx" download style="font-size:12px; display:block; margin-top:5px; color:blue; text-decoration:underline;">
      Download Sample Excel
    </a>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
      <button class="btn" onclick="app.closeModal()">Close</button>
    </div>
  `;
  this.openModal(html);

  const fileInput = document.getElementById("bulk-seller-file");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });

      // First sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      console.log("Parsed seller rows:", rows);

      if (!rows.length) {
        alert("Excel is empty!");
        return;
      }

      let success = 0,
        failed = 0;

      for (const r of rows) {
        try {
          const s = {
            ID: "", // auto
            Name: r.Name || "",
            Phone: r.Phone || "",
            Email: r.Email || "",
          };

          const res = await remote.add("Sellers", s);
          s.ID = extractId(res) || s.ID;
          success++;
        } catch (err) {
          console.error("❌ Failed row:", r, err);
          failed++;
        }
      }

      await this.reloadFromServer();
      this.renderSellers();
      this.closeModal();
      safeNotify(
        `✅ Imported ${success} sellers, ❌ Failed: ${failed}`,
        failed ? "warning" : "success"
      );
    } catch (err) {
      console.error(err);
      alert("Failed to read Excel: " + err.message);
    }
  });
};

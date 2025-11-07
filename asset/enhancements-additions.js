// enhancements-additions.js - Full updated version (non-invasive)
// Namespace: enhance2 to avoid collisions
window.enhance2 = (function(){
  const ns = {};

  /* ---------- Utilities ---------- */
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function noop(){}

  /* ---------- Split view: show leads and property matches side-by-side ---------- */
  ns.initSplitView = function(toggleBtnId, containerId){
    const btn = document.getElementById(toggleBtnId);
    const container = document.getElementById(containerId);
    if(!btn || !container) return;
    btn.addEventListener('click', ()=>{
      container.classList.toggle('enh-split');
    });
  };

  /* ---------- Kanban board for tasks/leads (HTML5 drag/drop) ---------- */
  ns.createKanban = function(rootId, dataSource){
    const root = document.getElementById(rootId);
    if(!root) return;
    root.innerHTML = '';
    const lanes = ['Open','In Progress','Done'];
    const stateKey = 'enh_kanban_state';
    const state = JSON.parse(localStorage.getItem(stateKey)||'null') || { lanes: {} };
    lanes.forEach(l => { state.lanes[l] = state.lanes[l] || []; });
    // seed
    if(!state._seeded && Array.isArray(dataSource)) {
      state.lanes.Open = dataSource.slice(0,6).map(d=>({id: d.ID||d.id || Math.random(), title: d.Name || d.Title || 'Item', data:d}));
      state._seeded = true;
      localStorage.setItem(stateKey, JSON.stringify(state));
    }

    // Build lanes
    const board = document.createElement('div'); board.className = 'enh-kanban';
    lanes.forEach(l => {
      const lane = document.createElement('div'); lane.className = 'lane'; lane.dataset.lane = l;
      lane.innerHTML = `<h3>${l}</h3><div class="cards" data-lane="${l}"></div>`;
      board.appendChild(lane);
    });
    root.appendChild(board);

    // render cards
    const render = ()=>{
      board.querySelectorAll('.cards').forEach(c=> c.innerHTML='');
      lanes.forEach(l => {
        const cards = board.querySelector(`.cards[data-lane="${l}"]`);
        (state.lanes[l]||[]).forEach(item=>{
          const card = document.createElement('div');
          card.className = 'kanban-card';
          card.draggable = true;
          card.dataset.id = item.id;
          card.innerHTML = `<strong>${escapeHtml(item.title)}</strong><div class="small muted">${escapeHtml((item.data && (item.data.Agent||item.data.agent))||'')}</div>`;
          card.addEventListener('dragstart',(e)=>{ e.dataTransfer.setData('text/plain', JSON.stringify({id:item.id,from:l})); setTimeout(()=>card.classList.add('hidden'),10); });
          card.addEventListener('dragend',(e)=>{ card.classList.remove('hidden'); });
          cards.appendChild(card);
        });
      });
    };

    // dragover & drop (re-bind after render)
    function bindDrops(){
      board.querySelectorAll('.cards').forEach(c=>{
        c.addEventListener('dragover', e=>{ e.preventDefault(); c.parentElement.classList.add('drag-over'); });
        c.addEventListener('dragleave', e=>{ c.parentElement.classList.remove('drag-over'); });
        c.addEventListener('drop', e=>{
          e.preventDefault();
          c.parentElement.classList.remove('drag-over');
          try{
            const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
            // find in lanes and move
            for(const L of Object.keys(state.lanes)){
              const idx = (state.lanes[L]||[]).findIndex(x=>String(x.id)===String(payload.id));
              if(idx>-1){
                const [item] = state.lanes[L].splice(idx,1);
                state.lanes[c.dataset.lane].push(item);
                localStorage.setItem(stateKey, JSON.stringify(state));
                render(); bindDrops();
                return;
              }
            }
            // if not found, create one in target
            state.lanes[c.dataset.lane].push({id:payload.id||Math.random(), title:payload.title||'New'});
            localStorage.setItem(stateKey, JSON.stringify(state));
            render(); bindDrops();
          }catch(err){ console.warn('kanban drop parse',err); }
        });
      });
    }

    render();
    bindDrops();
  };

  /* ---------- Neon/glow theme transitions ---------- */
  ns.applyNeon = function(rootSelector){
    const root = document.querySelector(rootSelector||'body');
    if(!root) return;
    root.classList.add('neon-glow','theme-transition-blur');
  };

  /* ---------- Animated blur transitions when switching themes ---------- */
  ns.initThemeBlurTransition = function(){
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = ()=>{
      document.body.classList.add('theme-blur-on');
      setTimeout(()=> document.body.classList.remove('theme-blur-on'), 600);
    };
    if(mq && mq.addEventListener) mq.addEventListener('change', apply);
  };

  /* ---------- Simple AI-powered lead scoring (client-side heuristic) ---------- */
  ns.scoreLead = function(lead, properties){
    let score = 0;
    if(!lead) return 0;
    const budget = Number(lead.Budget||lead.budget||0);
    const status = (lead.Status||lead.status||'').toLowerCase();
    if(['site visit','negotiation','contacted'].includes(status)) score += 30;
    if(status==='closed') score += 50;
    if(Array.isArray(properties)){
      const matches = properties.filter(p=>{
        const price = Number(p.Price||p.price||0);
        return price && budget && price <= budget*1.1;
      });
      score += Math.min(40, (matches.length*10));
    }
    const leadDate = new Date(lead.LeadDate || lead.leadDate || lead.Date || Date.now());
    const daysOld = Math.max(0, Math.floor((Date.now()-leadDate.getTime())/(1000*60*60*24)));
    if(daysOld < 7) score += 15;
    else if(daysOld < 30) score += 7;
    return Math.min(100, Math.round(score));
  };

  /* ---------- Show suggestions for a lead using existing matching helper if available ---------- */
  ns.showLeadSuggestions = function(lead, container){
    if(!lead || !container) return;
    const props = window.app && Array.isArray(window.app.data.properties) ? window.app.data.properties : [];
    let matches = [];
    if(typeof findMatchesForLead === 'function') matches = findMatchesForLead(lead, props).slice(0,6).map(m=>m.property);
    else matches = props.slice(0,6);
    container.innerHTML = '<strong>Suggested properties</strong><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>';
    const inner = container.querySelector('div');
    matches.forEach(p=>{
      const el = document.createElement('div'); el.className='tag'; el.style.marginBottom='6px';
      el.textContent = `${p.Title || p.Ref || 'Property'} — ₹${p.Price? p.Price: '-'}`;
      inner.appendChild(el);
    });
  };

  /* ---------- Voice-enabled search (Web Speech API) ---------- */
  ns.initVoiceSearch = function(buttonId, inputId){
    const btn = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if(!btn || !input) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) { btn.style.display='none'; return; }
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.onresult = (e)=>{
      const t = e.results[0][0].transcript;
      input.value = t;
      if(window.app && typeof app.onSearch === 'function') app.onSearch();
    };
    btn.addEventListener('click', ()=>{
      try{ rec.start(); btn.classList.add('listening'); setTimeout(()=>btn.classList.remove('listening'),5000);}catch(e){console.warn(e);}
    });
  };

  /* ---------- Simple local chatbot: rule-based queries over app.data ---------- */
  ns.initChatbot = function(rootId){
    const root = document.getElementById(rootId);
    if(!root) return;
    root.innerHTML = `
      <div class="enh-chatbot">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong>Assistant</strong><button id="enh-chat-close" class="btn">Close</button>
        </div>
        <div class="messages" id="enh-chat-messages"></div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input id="enh-chat-input" placeholder="Ask e.g. 'hot leads in Mumbai >50L'..." style="flex:1;padding:8px;border-radius:8px;background:transparent;border:1px solid rgba(255,255,255,0.06);color:#fff;">
          <button id="enh-chat-send" class="enh-voice-btn">Send</button>
        </div>
      </div>`;
    const msgBox = root.querySelector('#enh-chat-messages');
    const input = root.querySelector('#enh-chat-input');
    const send = root.querySelector('#enh-chat-send');
    const close = root.querySelector('#enh-chat-close');
    close.addEventListener('click', ()=> root.innerHTML='');
    const push = (txt, who='bot')=>{ const d = document.createElement('div'); d.className=`msg ${who}`; d.textContent=txt; msgBox.appendChild(d); msgBox.scrollTop = msgBox.scrollHeight; };
    const handle = (q)=>{
      push(q,'user');
      const answer = ns.chatAnswer(q);
      setTimeout(()=> push(answer,'bot'),300 + Math.random()*600);
    };
    send.addEventListener('click', ()=> handle(input.value));
    input.addEventListener('keydown',(e)=>{ if(e.key==='Enter') handle(input.value); });
  };

  ns.chatAnswer = function(q){
    if(!q) return "Tell me what you want (e.g., 'hot leads Mumbai >50L' ).";
    q = q.toLowerCase();
    const leads = (window.app && app.data && app.data.leads) || [];
    if(q.includes('hot leads')){
      const city = (q.match(/in ([a-z]+)/) || [])[1];
      const budgetMatch = q.match(/>(\d+)(l|k|m)?/);
      let min = 0;
      if(budgetMatch){
        min = Number(budgetMatch[1]);
        const suf = (budgetMatch[2]||'').toLowerCase();
        if(suf==='l') min = min*100000;
        if(suf==='k') min = min*1000;
        if(suf==='m') min = min*1000000;
      }
      let res = leads.filter(l=> (l.Status||'').toLowerCase().includes('site visit') || (l.Priority||'').toLowerCase().includes('hot'));
      if(city) res = res.filter(r=> (r.City||'').toLowerCase().includes(city));
      if(min) res = res.filter(r=> Number(r.Budget||0) >= min);
      return `Found ${res.length} hot lead(s). Top 3: ` + res.slice(0,3).map(x=> `${x.Name} (${x.City||x.Location||'?'})`).join('; ');
    }
    if(q.includes('show me properties') || q.includes('suggest properties')){
      const leadName = (q.match(/for (.+)$/) || [])[1];
      const lead = (window.app && app.data && app.data.leads || []).find(l=> (l.Name||'').toLowerCase().includes((leadName||'').toLowerCase()));
      if(lead) {
        const tmp = ns.scoreLead(lead, app.data.properties);
        return `Lead ${lead.Name} score ${tmp}. Suggestions shown in UI.`;
      }
    }
    if(q.includes('leaderboard')){
      const lb = ns.getLeaderboard();
      return 'Top agents: ' + lb.slice(0,3).map(a=>`${a.agent} (${a.count})`).join(', ');
    }
    return "I didn't understand. Try 'hot leads in Mumbai >50L' or 'leaderboard'.";
  };

  ns.getLeaderboard = function(){
    const leads = (window.app && app.data && app.data.leads) || [];
    const counts = {};
    leads.forEach(l=> { const a = l.Agent||'Unassigned'; if(!counts[a]) counts[a]=0; if((l.Status||'').toLowerCase()==='closed') counts[a]++; });
    return Object.keys(counts).map(k=>({agent:k, count:counts[k]})).sort((a,b)=>b.count-a.count);
  };

  /* ---------- Exports: CSV & XLSX (requires xlsx already loaded in host) ---------- */
  ns.exportCSV = function(arrayOfObjects, filename){
    if(!arrayOfObjects || !arrayOfObjects.length) return alert('No data');
    const keys = Object.keys(arrayOfObjects[0]);
    const rows = [keys.join(',')].concat(arrayOfObjects.map(o=> keys.map(k=> `"${String(o[k]||'').replace(/"/g,'""')}"`).join(',')));
    const blob = new Blob([rows.join('\n')], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download = filename||'export.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  ns.exportXLSX = function(arrayOfObjects, filename){
    if(!window.XLSX) return alert('XLSX library is needed');
    const ws = XLSX.utils.json_to_sheet(arrayOfObjects);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename||'export.xlsx');
  };

  /* ---------- New: Heatmap (Leaflet) ---------- */
  ns.renderHeatmap = function(containerId, properties){
    const el = document.getElementById(containerId);
    if(!el) return;
    if(!window.L) {
      el.innerHTML = "<div class='small muted'>Leaflet.js not loaded — include Leaflet to render heatmap.</div>";
      return;
    }
    el.style.height = "420px";
    el.innerHTML = ""; // clear
    const map = L.map(el).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    (properties||[]).forEach(p=>{
      const lat = p.lat || p.latitude || p.latlng && p.latlng[0];
      const lng = p.lng || p.longitude || p.latlng && p.latlng[1];
      if(lat && lng){
        L.circle([lat, lng], {radius: 200, color: "#06b6d4", weight:1, fillOpacity:0.12})
          .addTo(map).bindPopup(`${escapeHtml(p.Title||p.Ref||'Property')} — ₹${Number(p.Price||p.price||0).toLocaleString()}`);
      }
    });
  };

  /* ---------- New: Widget drag & persist (personalized dashboards) ---------- */
  ns.enableWidgetDrag = function(containerId){
    const root = document.getElementById(containerId);
    if(!root) return;
    const stateKey = 'enh_widget_order';
    let dragSrc = null;
    // mark children as widgets if not already
    Array.from(root.children).forEach((ch, idx)=>{
      if(!ch.classList.contains('widget')) ch.classList.add('widget');
      if(!ch.id) ch.id = `widget_${idx}_${Math.random().toString(36).slice(2,7)}`;
      ch.draggable = true;
      ch.addEventListener('dragstart', e=>{ dragSrc = ch; e.dataTransfer.effectAllowed = 'move'; });
      ch.addEventListener('dragover', e=> e.preventDefault());
      ch.addEventListener('drop', e=>{
        e.preventDefault();
        if(dragSrc && dragSrc !== ch) root.insertBefore(dragSrc, ch);
        saveOrder();
      });
    });
    function saveOrder(){ const ids = Array.from(root.children).map(x=>x.id); localStorage.setItem(stateKey, JSON.stringify(ids)); }
    // restore
    const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');
    if(saved && saved.length){
      saved.forEach(id=>{ const el = document.getElementById(id); if(el) root.appendChild(el); });
    }
  };

  /* ---------- New: PPT export (PptxGenJS) ---------- */
  ns.exportPPT = function(data, filename){
    if(!window.PptxGenJS) { alert('PptxGenJS not loaded'); return; }
    try{
      const pptx = new PptxGenJS();
      const slide = pptx.addSlide();
      slide.addText('Report', {x:0.5,y:0.3,fontSize:20});
      const cols = Object.keys(data[0]||{});
      const rows = data.map(d=> cols.map(c=> String(d[c]||'')));
      slide.addTable([cols].concat(rows), {x:0.5,y:1,w:9});
      pptx.writeFile(filename||'report.pptx');
    }catch(err){ console.error('PPT export failed', err); alert('PPT export error'); }
  };

  /* ---------- New: Achievement unlock animation ---------- */
  ns.showAchievementUnlock = function(badgeName){
    const div = document.createElement('div');
    div.className = 'achievement-unlock';
    div.innerHTML = `<div class="badge-glow">🏆 ${escapeHtml(badgeName)} Unlocked!</div>`;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(),4200);
  };

  /* ---------- New: Skeleton loader ---------- */
  ns.showSkeleton = function(containerId, height){
    const el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = `<div class="skeleton" style="height:${(height||80)}px;border-radius:8px;"></div>`;
  };

  /* ---------- Notifications & smart checks ---------- */
  ns.checkHighValueUncontacted = function(minValue){
    const leads = (window.app && app.data && app.data.leads) || [];
    const candidates = leads.filter(l=> Number(l.Budget||0) >= (minValue||1000000) && !( (l.Status||'').toLowerCase().includes('contact') || (l.Priority||'').toLowerCase().includes('hot') ));
    if(candidates.length){
      const text = `⚡ ${candidates.length} high-value buyer(s) not contacted recently.`;
      ns.showToast(text,'info');
      if("Notification" in window){
        if(Notification.permission === 'granted') new Notification('CRM Alert', { body:text });
        else if(Notification.permission !== 'denied') Notification.requestPermission().then(p=> p==='granted' && new Notification('CRM Alert',{body:text}));
      }
    }
    return candidates;
  };

  ns.showToast = function(text, type){
    const d = document.createElement('div'); d.className='ua-insight-message'; d.textContent = text;
    document.body.appendChild(d); setTimeout(()=>d.remove(),4500);
  };

  /* ---------- Funnel analytics and predictive trends ---------- */
  ns.renderFunnel = function(containerId){
    const c = document.getElementById(containerId); if(!c) return;
    const leads = (window.app && app.data && app.data.leads) || [];
    const counts = { Lead: leads.length, SiteVisit: leads.filter(l=> (l.Status||'').toLowerCase().includes('site visit')).length, Negotiation: leads.filter(l=> (l.Status||'').toLowerCase().includes('negotiation')).length, Closed: leads.filter(l=> (l.Status||'').toLowerCase().includes('closed')).length };
    c.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;"><div>Leads: ${counts.Lead}</div><div>Site Visit: ${counts.SiteVisit}</div><div>Negotiation: ${counts.Negotiation}</div><div>Closed: ${counts.Closed}</div></div>`;
    if(window.Chart && c.getAttribute('data-chart')!=='no'){
      const canvas = document.createElement('canvas'); c.innerHTML=''; c.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      new Chart(ctx,{ type:'bar', data:{ labels:Object.keys(counts), datasets:[{ data: Object.values(counts), backgroundColor:['#06b6d4','#7c3aed','#f97316','#10b981'] }] }, options:{ responsive:true, plugins:{legend:{display:false}} } });
    }
  };

  ns.predictClosures = function(containerId){
    const c = document.getElementById(containerId); if(!c) return;
    const leads = (window.app && app.data && app.data.leads) || [];
    const months = {};
    for(let i=0;i<6;i++){ const d = new Date(); d.setMonth(d.getMonth()-i); months[d.toISOString().slice(0,7)]=0; }
    leads.forEach(l=>{ if((l.Status||'').toLowerCase().includes('closed')){ const d = new Date(l.LeadDate||l.LeadedAt||l.Date||Date.now()); const key = d.toISOString().slice(0,7); if(months.hasOwnProperty(key)) months[key]++; }});
    const vals = Object.values(months).reverse();
    const avg = vals.reduce((a,b)=>a+b,0)/ (vals.length || 1);
    const projected = Math.round(avg * 1.05);
    c.innerHTML = `<div>Past ${vals.length} months: ${vals.join(', ')}. Projected closures this month: <strong>${projected}</strong></div>`;
  };

  /* ---------- Lazy-load charts using IntersectionObserver ---------- */
  ns.lazyLoadCharts = function(selector = 'canvas[data-lazy-chart]'){
    if(!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries, o)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){
          const el = en.target;
          el.removeAttribute('data-lazy-chart');
          // trigger a redraw if attribute indicates which chart
          if(typeof window.app !== 'undefined' && typeof window.app.renderAll === 'function'){
            try{ window.app.renderAll(); }catch(e){ console.warn('renderAll error', e); }
          }
          o.unobserve(el);
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.15 });
    document.querySelectorAll(selector).forEach(c=> obs.observe(c));
  };

  /* ---------- Dark/Light Mode sync ---------- */
  ns.initThemeSync = function(){
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = ()=>{
      if(mq.matches) document.documentElement.classList.add('theme-alt'); else document.documentElement.classList.remove('theme-alt');
    };
    if(mq && mq.addEventListener) mq.addEventListener('change', apply);
    apply();
  };

  /* ---------- Simple Agent profile modal ---------- */
  ns.openAgentProfile = function(agentName){
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `<div class="modal-bg"></div><div class="modal-card"><h2>Agent: ${escapeHtml(agentName)}</h2><div style="display:flex;gap:12px;flex-wrap:wrap;"><div style="flex:1"><div class="small muted">Closed Deals</div><div style="font-size:20px;font-weight:700">${(app.data.leads||[]).filter(l=>l.Agent===agentName && (l.Status||'').toLowerCase()==='closed').length}</div></div><div style="flex:1"><div class="small muted">Monthly Target</div><div style="font-size:20px;font-weight:700">12</div></div></div><div style="margin-top:12px"><button class="btn" id="enh-close-agent">Close</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('enh-close-agent').addEventListener('click', ()=> modal.remove());
  };

  // expose functions
  return {
    initSplitView: ns.initSplitView,
    createKanban: ns.createKanban,
    applyNeon: ns.applyNeon,
    initThemeBlurTransition: ns.initThemeBlurTransition,
    scoreLead: ns.scoreLead,
    showLeadSuggestions: ns.showLeadSuggestions,
    initVoiceSearch: ns.initVoiceSearch,
    initChatbot: ns.initChatbot,
    exportCSV: ns.exportCSV,
    exportXLSX: ns.exportXLSX,
    exportPPT: ns.exportPPT,
    checkHighValueUncontacted: ns.checkHighValueUncontacted,
    renderFunnel: ns.renderFunnel,
    predictClosures: ns.predictClosures,
    renderHeatmap: ns.renderHeatmap,
    enableWidgetDrag: ns.enableWidgetDrag,
    showAchievementUnlock: ns.showAchievementUnlock,
    showSkeleton: ns.showSkeleton,
    lazyLoadCharts: ns.lazyLoadCharts,
    initThemeSync: ns.initThemeSync,
    openAgentProfile: ns.openAgentProfile,
    getLeaderboard: ns.getLeaderboard,
    showToast: ns.showToast
  };
})();

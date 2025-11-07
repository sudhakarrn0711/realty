/***********************
 * RealEstate CRM Backend — Test + Live
 ***********************/
const SHEET_MAP = {
  live: '11LNssflQarL_U4Xg-29L2WnYdw_HD2ApogmfujuEnvU',
  test: '1hjInCFAltSsdX5gYDOZYeP-HBPjk2cj-Kcfls7-b4wA'
};
const DEFAULT_ENV = 'test';

/* Entrypoints */
function doGet(e)  { return out(handle('GET', e && e.parameter, null)); }
function doPost(e) { return out(handle('POST', e && e.parameter, e && e.postData)); }
function doOptions(e){ return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT); }

/* Router */
function handle(method, params, postData) {
  params = params || {};

  if (method === 'GET') {
    const action = (params.action || '').toString().toLowerCase();
    const env = (params.env || DEFAULT_ENV).toString().toLowerCase();
    const sheetId = SHEET_MAP[env] || SHEET_MAP[DEFAULT_ENV];
    const ss = SpreadsheetApp.openById(sheetId);

    if (action === 'load') return loadAll(ss);
    return { error: 'unknown GET action' };
  }

  if (method === 'POST') {
    const body = parseBody(postData, params);
    const act = (body.action || '').toString().toLowerCase();
    const env = (body.env || DEFAULT_ENV).toString().toLowerCase(); // ✅ get env from body!
    const sheetId = SHEET_MAP[env] || SHEET_MAP[DEFAULT_ENV];
    const ss = SpreadsheetApp.openById(sheetId);

    if (act === 'add')    return { ok:true, id:addRow(ss, body.type, body.data||{}) };
    if (act === 'update') return { ok:updateRow(ss, body.type, body.data||{}) };
    if (act === 'delete') return { ok:deleteRow(ss, body.type, body.id) };
    return { error: 'unknown POST action' };
  }

  return { error: 'unsupported method' };
}


/* Robust POST parser — accepts JSON (text/plain) or urlencoded */
function parseBody(postData, params) {
  if (!postData || !postData.contents) return params || {};
  const raw = postData.contents;
  try {
    return JSON.parse(raw);
  } catch (e) {
    const out = Object.assign({}, params||{});
    raw.split('&').forEach(function(kv){
      if (!kv) return;
      const parts = kv.split('=');
      const key = decodeURIComponent(parts.shift().replace(/\+/g,' '));
      const val = decodeURIComponent((parts.join('=') || '').replace(/\+/g,' '));
      out[key] = val;
    });
    return out;
  }
}

/* JSON response helper */
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Data helpers ---------- */
function loadAll(ss) {
  const names = ["Leads","Properties","Tasks","Sellers","Buyers","Config"];
  const out = {};
  names.forEach(name => { 
    const data = getSheetDataFromSS(ss, name);
    if (name === "Leads") Logger.log(Object.keys(data[0] || {}));  // ✅ log headers
    out[toKey(name)] = data;
  });
  return out;
}


function getSheetDataFromSS(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastRow < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim());

  // 🔎 debug for Sellers
  if (sheetName === "Sellers") {
    console.log("Sellers headers:", headers); // will appear in JSON response
  }

  return values.slice(1)
    .filter(r => r.join('').trim() !== '')
    .map(r => {
      const o = {};
      headers.forEach((h, i) => o[h] = r[i] === undefined ? '' : String(r[i]));
      return o;
    });
}





function ensureIdPrefix(id, prefix) {
  if (!id) return prefix + "_" + Utilities.getUuid().slice(0,8);
  if (id.indexOf(prefix+"_") === 0) return id;
  return prefix + "_" + id;
}

function addRow(ss, sheetName, obj) {
  console.log("📥 addRow", sheetName, JSON.stringify(obj));

  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw "Sheet not found: " + sheetName;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  console.log("📑 Headers:", JSON.stringify(headers));

  if (headers.indexOf("ID") === -1) throw 'No ID header in ' + sheetName;

  const prefix = sheetName === 'Leads' ? 'lead' :
                 sheetName === 'Properties' ? 'prop' :
                 sheetName === 'Tasks' ? 'task' :
                 sheetName === 'Sellers' ? 'seller' :
                 sheetName === 'Buyers' ? 'buyer' : 'id';

  // Always assign primary ID
  obj.ID = ensureIdPrefix(obj.ID, prefix);

  // Auto-generate BuyerID
  if (sheetName === 'Leads' && !obj.BuyerID) {
    obj.BuyerID = 'buyer_' + Utilities.getUuid().slice(0, 8);
  }

  // Auto-generate SellerID
  if (sheetName === 'Sellers' && !obj.SellerID) {
    obj.SellerID = 'seller_' + Utilities.getUuid().slice(0, 8);
  }

  // 🔑 Normalize legacy fields (Tasks only)
  if (sheetName === "Tasks") {
    if (obj.TaskType && !obj.Type)   obj.Type = obj.TaskType;
    if (obj.TaskStatus && !obj.Status) obj.Status = obj.TaskStatus;
  }

  const row = headers.map(h => {
    const val = obj[h] === undefined ? '' : obj[h];
    console.log(`📝 addRow set [${h}] =`, val);
    return val;
  });

  sh.appendRow(row);
  return { id: obj.ID, debug: { obj, headers } };
}


function updateRow(ss, sheetName, obj) {
  console.log("📥 updateRow", sheetName, JSON.stringify(obj));

  if (!obj.ID) throw "Missing ID for update";
  const sh = ss.getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  console.log("📑 Headers:", JSON.stringify(headers));

  const idIndex = headers.indexOf("ID");

  // 🔑 Normalize legacy fields
  if (sheetName === "Tasks") {
    if (obj.TaskType && !obj.Type)   obj.Type = obj.TaskType;
    if (obj.TaskStatus && !obj.Status) obj.Status = obj.TaskStatus;
  }

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(obj.ID)) {
      headers.forEach((h, j) => {
        if ((sheetName === "Leads" && h === "BuyerID") ||
            (sheetName === "Sellers" && h === "SellerID")) {
          return;
        }
        const val = obj[h] === undefined ? '' : obj[h];
        console.log(`🔄 updateRow set [${h}] =`, val);
        sh.getRange(i + 1, j + 1).setValue(val);
      });
      return true;
    }
  }
  return false;
}


function deleteRow(ss, sheetName, id) {
  if (!id) throw "Missing id";
  const sh = ss.getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf("ID");
  for (let i=1;i<values.length;i++) {
    if (String(values[i][idIndex])===String(id)) {
      sh.deleteRow(i+1);
      return true;
    }
  }
  return false;
}

function toKey(sheetName){ return sheetName.toLowerCase(); }

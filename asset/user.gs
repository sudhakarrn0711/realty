/*****************************
 * User Management Backend
 * Sheet: Users
 * Columns: Username | Password | Role | Rights (comma separated)
 *****************************/
const USER_SHEET_ID = "1hjInCFAltSsdX5gYDOZYeP-HBPjk2cj-Kcfls7-b4wA";  // Replace with your Drive Sheet ID

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "addUser") return out(addUser(body));
    if (action === "updateUser") return out(updateUser(body));
    if (action === "deleteUser") return out(deleteUser(body.username));
    if (action === "getAllUsers") return out({ users: getAllUsers() });
    if (action === "getUser") return out({ user: getUser(body.username) });
    if (action === "loginUser") return out(loginUser(body.username, body.password));

    // ✅ SuperAdmin login check (using Config sheet)
    if (action === "superAdminLogin") {
      const inputPassword = (body.password || "").trim();
      const ss = SpreadsheetApp.openById(USER_SHEET_ID);   // Make sure SHEET_ID is set at top
      const configSheet = ss.getSheetByName("Config");
      if (!configSheet) return out({ success: false, message: "Config sheet not found" });

      const values = configSheet.getRange(1, 1, configSheet.getLastRow(), 2).getValues();
      let savedPassword = "";
      values.forEach(row => {
        if (String(row[0]).trim() === "SuperAdminPassword") {
          savedPassword = String(row[1]).trim();
        }
      });

      if (!savedPassword) {
        return out({ success: false, message: "No SuperAdmin password configured" });
      }

      if (inputPassword === savedPassword) {
        return out({ success: true, message: "SuperAdmin login successful" });
      } else {
        return out({ success: false, message: "Invalid SuperAdmin password" });
      }
    }

    return out({ success: false, message: "Unknown action" });
  } catch (err) {
    return out({ success: false, message: err.message });
  }
}


/*******************
 * Role → Rights Map
 *******************/
function getDefaultRights(role) {
  if (role === "Admin") {
    return ["dashboard","crm-dashboard-v2","leads","buyers","sellers","properties","tasks","reports","map","settings"];
  }
  if (role === "Manager") {
    return ["leads","buyers","sellers","properties","tasks","reports","map","settings"];
  }
  if (role === "Agent") {
    return ["leads","buyers","sellers","properties","tasks"];
  }
  return [];
}

/*******************
 * Helpers
 *******************/
function getSheet() {
  return SpreadsheetApp.openById(USER_SHEET_ID).getSheetByName("Users");
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*******************
 * CRUD Operations
 *******************/
function addUser({ username, password, role, rights }) {
  if (!username || !password || !role) {
    return { success: false, message: "Missing required fields" };
  }

  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");
  const idxPassword = headers.indexOf("Password");
  const idxRole = headers.indexOf("Role");
  const idxRights = headers.indexOf("Rights");

  // Check duplicate
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxUsername] === username) {
      return { success: false, message: "User already exists" };
    }
  }

  // Auto-assign rights if not provided
  const finalRights = rights && rights.length ? rights : getDefaultRights(role);

  sh.appendRow([username, password, role, finalRights.join(",")]);
  return { success: true, message: "User created successfully" };
}

function updateUser({ oldUsername, username, password, role, rights }) {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");
  const idxPassword = headers.indexOf("Password");
  const idxRole = headers.indexOf("Role");
  const idxRights = headers.indexOf("Rights");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxUsername] === oldUsername) {
      const finalRights = rights && rights.length ? rights : getDefaultRights(role);
      sh.getRange(i + 1, idxUsername + 1).setValue(username);
      if (password) sh.getRange(i + 1, idxPassword + 1).setValue(password);
      sh.getRange(i + 1, idxRole + 1).setValue(role);
      sh.getRange(i + 1, idxRights + 1).setValue(finalRights.join(","));
      return { success: true, message: "User updated successfully" };
    }
  }
  return { success: false, message: "User not found" };
}

function deleteUser(username) {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxUsername] === username) {
      sh.deleteRow(i + 1);
      return { success: true, message: "User deleted successfully" };
    }
  }
  return { success: false, message: "User not found" };
}

function getAllUsers() {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");
  const idxRole = headers.indexOf("Role");
  const idxRights = headers.indexOf("Rights");

  const users = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][idxUsername]) continue;
    users.push({
      username: data[i][idxUsername],
      role: data[i][idxRole],
      rights: (data[i][idxRights] || "").split(",").map(r => r.trim()).filter(r => r)
    });
  }
  return users;
}

function getUser(username) {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");
  const idxRole = headers.indexOf("Role");
  const idxRights = headers.indexOf("Rights");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxUsername] === username) {
      return {
        username: data[i][idxUsername],
        role: data[i][idxRole],
        rights: (data[i][idxRights] || "").split(",").map(r => r.trim()).filter(r => r)
      };
    }
  }
  return null;
}

function loginUser(username, password) {
  const sh = getSheet();
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idxUsername = headers.indexOf("Username");
  const idxPassword = headers.indexOf("Password");
  const idxRole = headers.indexOf("Role");
  const idxRights = headers.indexOf("Rights");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxUsername] === username && data[i][idxPassword] === password) {
      return {
        success: true,
        user: {
          username: data[i][idxUsername],
          role: data[i][idxRole],
          rights: (data[i][idxRights] || "").split(",").map(r => r.trim()).filter(r => r)
        }
      };
    }
  }
  return { success: false, message: "Invalid credentials" };
}


function superAdminLogin(password) {
  const ss = SpreadsheetApp.openById("USER_SHEET_ID"); // Replace with your Sheet ID
  const configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    return { success: false, message: "Config sheet not found" };
  }

  // Get all rows in config
  const data = configSheet.getDataRange().getValues();

  // Find the row where column A = "SuperAdminPassword"
  let storedPassword = null;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() === "SuperAdminPassword") {
      storedPassword = data[i][1]; // column B value
      break;
    }
  }

  if (!storedPassword) {
    return { success: false, message: "SuperAdminPassword not found in Config sheet" };
  }

  if (password === storedPassword) {
    return { success: true, message: "SuperAdmin authenticated" };
  }

  return { success: false, message: "Invalid password" };
}


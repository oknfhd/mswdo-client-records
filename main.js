const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const isDev = !app.isPackaged;
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { shell } = require("electron");
const { dialog } = require("electron");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// ========================
// DATABASE
// ========================
// Where the DB is saved:
// - Packaged app: per-user app data directory (app.getPath("userData"))
// - Dev: ./database for easy inspection in DB Browser
// You can override with env var MSWD_DB_PATH (full file path).
const defaultDbDir = isDev ? path.resolve(__dirname, "database") : app.getPath("userData");
const envDbPath = process.env.MSWD_DB_PATH && process.env.MSWD_DB_PATH.trim();
const defaultDbName = isDev ? "mswdclients.local.db" : "mswdclients.db";
const userDbPath = envDbPath ? path.resolve(envDbPath) : path.join(defaultDbDir, defaultDbName);
const userDbDir = path.dirname(userDbPath);

try {
  fs.mkdirSync(userDbDir, { recursive: true });
} catch (e) {
  // If folder creation fails, better-sqlite3 will throw when opening the DB.
}

const db = new Database(userDbPath);

db.prepare(`
    CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        caseNo TEXT,
        dateCreated TEXT,
        clientName TEXT,
        clientSex TEXT,
        clientCStatus TEXT,
        clientAge INTEGER,
        clientDob TEXT,
        clientCaseNature TEXT,
        clientCaseRemarks TEXT,
        clientAddress TEXT,
        clientReferral TEXT,
        clientOtherRemarks TEXT,
        clientPerson TEXT
  )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        sex TEXT,
        civilStatus TEXT,
        age INTEGER,
        dob TEXT,
        address TEXT
  )
`).run();


function ensureEntriesColumns() {
  const existing = new Set(
    db.prepare("PRAGMA table_info(entries)").all().map((c) => c.name)
  );

  const required = [
    ["caseNo", "TEXT"],
    ["dateCreated", "TEXT"],
    ["clientName", "TEXT"],
    ["clientSex", "TEXT"],
    ["clientCStatus", "TEXT"],
    ["clientAge", "INTEGER"],
    ["clientDob", "TEXT"],
    ["clientCaseNature", "TEXT"],
    ["clientCaseRemarks", "TEXT"],
    ["clientAddress", "TEXT"],
    ["clientReferral", "TEXT"],
    ["clientOtherRemarks", "TEXT"],
    ["clientPerson", "TEXT"],
    ["client_id", "INTEGER"]
  ];

  for (const [name, type] of required) {
    if (!existing.has(name)) {
      db.prepare(`ALTER TABLE entries ADD COLUMN ${name} ${type}`).run();
    }
  }
}

ensureEntriesColumns();

const insertEntryStmt = db.prepare(`
    INSERT INTO entries (
        caseNo,
        dateCreated,
        clientName,
        clientSex,
        clientCStatus,
        clientAge,
        clientDob,
        clientCaseNature,
        clientCaseRemarks,
        clientAddress,
        clientReferral,
        clientOtherRemarks,
        clientPerson
    ) VALUES (
        @caseNo,
        @dateCreated,
        @clientName,
        @clientSex,
        @clientCStatus,
        @clientAge,
        @clientDob,
        @clientCaseNature,
        @clientCaseRemarks,
        @clientAddress,
        @clientReferral,
        @clientOtherRemarks,
        @clientPerson
    )
`);

const getEntryByIdStmt = db.prepare("SELECT * FROM entries WHERE id = ?");
const getEntriesByClientNameStmt = db.prepare("SELECT * FROM entries WHERE clientName = ? ORDER BY id DESC");
const updateEntryStmt = db.prepare(`
    UPDATE entries SET
      caseNo=@caseNo,
      dateCreated=@dateCreated,
      clientName=@clientName,
      clientSex=@clientSex,
      clientCStatus=@clientCStatus,
      clientAge=@clientAge,
      clientDob=@clientDob,
      clientCaseNature=@clientCaseNature,
      clientCaseRemarks=@clientCaseRemarks,
      clientAddress=@clientAddress,
      clientReferral=@clientReferral,
      clientOtherRemarks=@clientOtherRemarks,
      clientPerson=@clientPerson,
      client_id=@client_id
    WHERE id=@id
`);
const deleteEntryStmt = db.prepare("DELETE FROM entries WHERE id = ?");
const updateClientStmt = db.prepare(`
    UPDATE clients SET
      name=@name,
      sex=@sex,
      civilStatus=@civilStatus,
      age=@age,
      dob=@dob,
      address=@address
    WHERE id=@id
`);
const deleteEntriesByClientStmt = db.prepare("DELETE FROM entries WHERE client_id = ?");
const deleteClientStmt = db.prepare("DELETE FROM clients WHERE id = ?");

// ========================
// IPC (BACKEND)
// ========================
ipcMain.handle("get-client-by-id", async (_event, id) => {
  const numericId = Number(id);

  if (!Number.isFinite(numericId)) {
    throw new Error("Invalid client id");
  }

  return db.prepare(
    "SELECT * FROM clients WHERE id = ?"
  ).get(numericId);
});

ipcMain.handle("get-db-path", () => {
  return userDbPath;
});

ipcMain.handle("save-entry", (_event, data) => {

  let clientId = data.client_id;

  // If no client_id → create new client
  if (!clientId) {
    // Try to find existing client FIRST
    const existing = db.prepare(`
    SELECT id FROM clients WHERE name = ?
  `).get(data.clientName);

    if (existing) {
      clientId = existing.id;
    } else {
      const result = db.prepare(`
      INSERT INTO clients (name, sex, civilStatus, age, dob, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        data.clientName,
        data.clientSex,
        data.clientCStatus,
        data.clientAge,
        data.clientDob,
        data.clientAddress
      );

      clientId = result.lastInsertRowid;
    }
  }


  const record = {
    ...data,
    client_id: clientId
  };

  const result = db.prepare(`
    INSERT INTO entries (
      caseNo, dateCreated,
      clientName, clientSex, clientCStatus, clientAge, clientDob,
      clientCaseNature, clientCaseRemarks, clientAddress,
      clientReferral, clientOtherRemarks, clientPerson,
      client_id
    ) VALUES (
      @caseNo, @dateCreated,
      @clientName, @clientSex, @clientCStatus, @clientAge, @clientDob,
      @clientCaseNature, @clientCaseRemarks, @clientAddress,
      @clientReferral, @clientOtherRemarks, @clientPerson,
      @client_id
    )
  `).run(record);

  return { id: result.lastInsertRowid };
});


ipcMain.handle("get-entries", () => {
  return db.prepare("SELECT * FROM entries ORDER BY id DESC").all();
});

ipcMain.handle("get-entry-by-id", (_event, id) => {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) throw new Error("Invalid id.");
  return getEntryByIdStmt.get(numericId) || null;
});

ipcMain.handle("update-entry", (_event, data) => {
  const numericId = Number(data?.id);
  if (!Number.isFinite(numericId)) throw new Error("Invalid entry id.");

  const parsedAge = data.clientAge === "" || data.clientAge == null ? null : Number(data.clientAge);

  const record = {
    id: numericId,
    caseNo: data.caseNo?.toString?.() ?? "",
    dateCreated: data.dateCreated?.toString?.() ?? "",
    clientName: data.clientName?.toString?.() ?? "",
    clientSex: data.clientSex?.toString?.() ?? "",
    clientCStatus: data.clientCStatus?.toString?.() ?? "",
    clientAge: Number.isFinite(parsedAge) ? parsedAge : null,
    clientDob: data.clientDob?.toString?.() ?? "",
    clientCaseNature: data.clientCaseNature?.toString?.() ?? "",
    clientCaseRemarks: data.clientCaseRemarks?.toString?.() ?? "",
    clientAddress: data.clientAddress?.toString?.() ?? "",
    clientReferral: data.clientReferral?.toString?.() ?? "",
    clientOtherRemarks: data.clientOtherRemarks?.toString?.() ?? "",
    clientPerson: data.clientPerson?.toString?.() ?? "",
    client_id: data.client_id == null || data.client_id === "" ? null : Number(data.client_id)
  };

  updateEntryStmt.run(record);
  return { ok: true };
});

ipcMain.handle("delete-entry", (_event, id) => {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) throw new Error("Invalid id.");
  deleteEntryStmt.run(numericId);
  return { ok: true };
});

ipcMain.handle("update-client", (_event, data) => {
  const numericId = Number(data?.id);
  if (!Number.isFinite(numericId)) throw new Error("Invalid client id.");

  const parsedAge = data.age === "" || data.age == null ? null : Number(data.age);

  updateClientStmt.run({
    id: numericId,
    name: data.name?.toString?.() ?? "",
    sex: data.sex?.toString?.() ?? "",
    civilStatus: data.civilStatus?.toString?.() ?? "",
    age: Number.isFinite(parsedAge) ? parsedAge : null,
    dob: data.dob?.toString?.() ?? "",
    address: data.address?.toString?.() ?? ""
  });

  return { ok: true };
});

ipcMain.handle("delete-client", (_event, id) => {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) throw new Error("Invalid client id.");

  const tx = db.transaction(() => {
    deleteEntriesByClientStmt.run(numericId);
    deleteClientStmt.run(numericId);
  });

  tx();
  return { ok: true };
});

ipcMain.handle("search-clients", (_e, query) => {
  return db.prepare(`
    SELECT * FROM clients
    WHERE name LIKE ?
    LIMIT 10
  `).all(`%${query}%`);
});

ipcMain.handle("create-client", (_e, data) => {
  const result = db.prepare(`
    INSERT INTO clients (name, sex, civilStatus, age, dob, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.sex,
    data.civilStatus,
    data.age,
    data.dob,
    data.address
  );

  return result.lastInsertRowid;
});

ipcMain.handle("search-case-nature", (_e, query) => {
  return db.prepare(`
    SELECT DISTINCT clientCaseNature AS value
    FROM entries
    WHERE clientCaseNature LIKE ?
    ORDER BY clientCaseNature ASC
    LIMIT 10
  `).all(`%${query}%`);
});


ipcMain.handle("search-addresses", (_e, query) => {
  return db.prepare(`
    SELECT DISTINCT clientAddress AS value
    FROM entries
    WHERE clientAddress LIKE ?
    ORDER BY clientAddress ASC
    LIMIT 10
  `).all(`%${query}%`);
});

ipcMain.handle("search-referrals", (_e, query) => {
  // Get distinct referral values (including comma-separated ones)
  // Split them and return unique matches
  const rows = db.prepare(`
    SELECT DISTINCT clientReferral AS value
    FROM entries
    WHERE clientReferral IS NOT NULL AND clientReferral != ''
    ORDER BY clientReferral ASC
  `).all();
  
  // Split comma-separated values and flatten
  const allValues = new Set();
  for (const row of rows) {
    if (row.value) {
      const parts = row.value.split(',').map(p => p.trim()).filter(p => p.length > 0);
      parts.forEach(p => allValues.add(p));
    }
  }
  
  // Filter by query and return top 10
  const filtered = query
    ? [...allValues].filter(v => v.toLowerCase().includes(query.toLowerCase()))
    : [...allValues];
  
  return filtered
    .sort()
    .slice(0, 10)
    .map(v => ({ value: v }));
});

ipcMain.handle("get-max-case-no", () => {
  const result = db.prepare(`
    SELECT MAX(CAST(caseNo AS INTEGER)) as maxCaseNo
    FROM entries
    WHERE caseNo GLOB '[0-9]*'
  `).get();
  return result?.maxCaseNo || 0;
});


ipcMain.handle("get-clients", () => {
  return db.prepare(`
    SELECT * FROM clients ORDER BY name ASC
  `).all();
});

ipcMain.handle("get-client-with-cases", (_e, clientId) => {
  const client = db.prepare(`
    SELECT * FROM clients WHERE id = ?
  `).get(clientId);

  const cases = db.prepare(`
    SELECT * FROM entries
    WHERE client_id = ?
    ORDER BY dateCreated DESC
  `).all(clientId);

  return { client, cases };
});

// Get available months and years with entries
ipcMain.handle("get-available-months-years", () => {
  const rows = db.prepare(`
    SELECT DISTINCT 
      strftime('%Y', dateCreated) as year,
      strftime('%m', dateCreated) as month
    FROM entries
    WHERE dateCreated IS NOT NULL AND dateCreated != ''
    ORDER BY year DESC, month DESC
  `).all();

  // Extract unique years and months
  const years = [...new Set(rows.map(r => parseInt(r.year)))].sort((a, b) => b - a);
  const months = [...new Set(rows.map(r => parseInt(r.month)))].sort((a, b) => a - b);

  return { years, months, entries: rows };
});

// Helper function to build date filter WHERE clause
function buildDateFilter(fromYear, fromMonth, toYear, toMonth) {
  let conditions = [];
  let params = {};

  if (fromYear && fromMonth) {
    conditions.push("strftime('%Y', dateCreated) >= @fromYear AND strftime('%m', dateCreated) >= @fromMonth");
    params.fromYear = String(fromYear);
    params.fromMonth = String(fromMonth).padStart(2, '0');
  } else if (fromYear) {
    conditions.push("strftime('%Y', dateCreated) >= @fromYear");
    params.fromYear = String(fromYear);
  }

  if (toYear && toMonth) {
    conditions.push("strftime('%Y', dateCreated) <= @toYear AND strftime('%m', dateCreated) <= @toMonth");
    params.toYear = String(toYear);
    params.toMonth = String(toMonth).padStart(2, '0');
  } else if (toYear) {
    conditions.push("strftime('%Y', dateCreated) <= @toYear");
    params.toYear = String(toYear);
  }

  return { whereClause: conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "", params };
}

// ========================
// STATISTICS & CHARTS
// ========================

// Get total counts
ipcMain.handle("get-statistics", () => {
  const totalClients = db.prepare("SELECT COUNT(*) as count FROM clients").get().count;
  const totalCases = db.prepare("SELECT COUNT(*) as count FROM entries").get().count;
  return { totalClients, totalCases };
});


// Get age distribution data for chart
ipcMain.handle("get-age-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN age IS NULL OR age = '' THEN 'Unknown'
        WHEN CAST(age AS INTEGER) < 18 THEN 'Minor (under 18)'
        WHEN CAST(age AS INTEGER) BETWEEN 18 AND 30 THEN '18-30'
        WHEN CAST(age AS INTEGER) BETWEEN 31 AND 59 THEN '31-59'
        WHEN CAST(age AS INTEGER) > 59 THEN 'Senior (60+)'
        ELSE 'Unknown'
      END as ageGroup,
      COUNT(*) as count
    FROM clients 
    GROUP BY ageGroup
    ORDER BY 
      CASE ageGroup
        WHEN 'Minor (under 18)' THEN 1
        WHEN '18-30' THEN 2
        WHEN '31-59' THEN 3
        WHEN 'Senior (60+)' THEN 4
        WHEN 'Unknown' THEN 5
      END
  `).all();
  return rows;
});

// Get gender distribution data for chart
ipcMain.handle("get-gender-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN sex IS NULL OR sex = '' THEN 'Unknown'
        ELSE sex 
      END as gender,
      COUNT(*) as count
    FROM clients 
    GROUP BY gender
    ORDER BY count DESC
  `).all();
  return rows;
});

// Get civil status distribution data for chart
ipcMain.handle("get-civil-status-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN civilStatus IS NULL OR civilStatus = '' THEN 'Unknown'
        ELSE civilStatus 
      END as status,
      COUNT(*) as count
    FROM clients 
    GROUP BY status
    ORDER BY count DESC
  `).all();
  return rows;
});

// Get address distribution data for chart (top 10)
ipcMain.handle("get-address-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN address IS NULL OR address = '' THEN 'Unknown'
        ELSE address 
      END as address,
      COUNT(*) as count
    FROM clients 
    GROUP BY address
    ORDER BY count DESC
    LIMIT 10
  `).all();
  return rows;
});

function computeBarangayCounts(addressRows) {
  const barangays = [
    { label: "Ambassador", needles: ["ambassador"] },
    { label: "Ambongdolan", needles: ["ambongdolan"] },
    { label: "Ba-ayan", needles: ["ba-ayan", "baayan"] },
    { label: "Basil", needles: ["basil"] },
    { label: "Caponga", needles: ["caponga"] },
    { label: "Daclan", needles: ["daclan"] },
    { label: "Tublay Central", needles: ["tublay central", "central, tublay", "central tublay"] },
    { label: "Tuel", needles: ["tuel"] },
  ];

  const counts = new Map(barangays.map((b) => [b.label, 0]));

  for (const row of addressRows || []) {
    const address = (row?.address ?? "").toString().toLowerCase();
    if (!address) continue;

    for (const b of barangays) {
      if (b.needles.some((n) => address.includes(n))) {
        counts.set(b.label, (counts.get(b.label) || 0) + 1);
        break; // assume one barangay per client
      }
    }
  }

  return barangays.map((b) => ({ barangay: b.label, count: counts.get(b.label) || 0 }));
}

ipcMain.handle("get-barangay-distribution", () => {
  const rows = db.prepare(`
    SELECT address
    FROM clients
    WHERE address IS NOT NULL AND address != ''
  `).all();

  return computeBarangayCounts(rows);
});

// Helper function to split comma-separated values and count them
function splitAndCount(rows, fieldName) {
  const counts = {};
  for (const row of rows) {
    const value = row[fieldName];
    if (!value || value.trim() === '') {
      counts['Unknown'] = (counts['Unknown'] || 0) + 1;
      continue;
    }
    // Split by comma and trim each value
    const parts = value.split(',').map(p => p.trim()).filter(p => p.length > 0);
    for (const part of parts) {
      counts[part] = (counts[part] || 0) + 1;
    }
  }
  // Convert to array format
  return Object.entries(counts)
    .map(([key, count]) => ({ [fieldName]: key, count }))
    .sort((a, b) => b.count - a.count);
}

// Get referral distribution data for chart
ipcMain.handle("get-referral-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN clientReferral IS NULL OR clientReferral = '' THEN 'Unknown'
        ELSE clientReferral 
      END as referral
    FROM entries 
  `).all();
  return splitAndCount(rows, 'referral');
});

// Get person in charge distribution data for chart
ipcMain.handle("get-person-in-charge-distribution", () => {
  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN clientPerson IS NULL OR clientPerson = '' THEN 'Unknown'
        ELSE clientPerson 
      END as person
    FROM entries 
  `).all();
  return splitAndCount(rows, 'person');
});

// ========================
// FILTERED STATISTICS (with date range)
// ========================

// Get filtered statistics with date range
ipcMain.handle("get-filtered-statistics", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  // For total cases, we filter entries by date
  const totalCases = db.prepare(`SELECT COUNT(*) as count FROM entries ${whereClause}`).get(params).count;

  // For total clients, we count clients who have entries in the date range
  const totalClients = db.prepare(`
    SELECT COUNT(DISTINCT client_id) as count FROM entries ${whereClause}
  `).get(params).count;

  return { totalClients, totalCases };
});

// Get filtered age distribution
ipcMain.handle("get-filtered-age-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN c.age IS NULL OR c.age = '' THEN 'Unknown'
        WHEN CAST(c.age AS INTEGER) < 18 THEN 'Minor (under 18)'
        WHEN CAST(c.age AS INTEGER) BETWEEN 18 AND 30 THEN '18-30'
        WHEN CAST(c.age AS INTEGER) BETWEEN 31 AND 59 THEN '31-59'
        WHEN CAST(c.age AS INTEGER) > 59 THEN 'Senior (60+)'
        ELSE 'Unknown'
      END as ageGroup,
      COUNT(*) as count
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    ${whereClause}
    GROUP BY ageGroup
    ORDER BY 
      CASE ageGroup
        WHEN 'Minor (under 18)' THEN 1
        WHEN '18-30' THEN 2
        WHEN '31-59' THEN 3
        WHEN 'Senior (60+)' THEN 4
        WHEN 'Unknown' THEN 5
      END
  `).all(params);
  return rows;
});

// Get filtered gender distribution
ipcMain.handle("get-filtered-gender-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN c.sex IS NULL OR c.sex = '' THEN 'Unknown'
        ELSE c.sex 
      END as gender,
      COUNT(*) as count
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    ${whereClause}
    GROUP BY gender
    ORDER BY count DESC
  `).all(params);
  return rows;
});

// Get filtered civil status distribution
ipcMain.handle("get-filtered-civil-status-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN c.civilStatus IS NULL OR c.civilStatus = '' THEN 'Unknown'
        ELSE c.civilStatus 
      END as status,
      COUNT(*) as count
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    ${whereClause}
    GROUP BY status
    ORDER BY count DESC
  `).all(params);
  return rows;
});

// Get filtered address distribution
ipcMain.handle("get-filtered-address-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN c.address IS NULL OR c.address = '' THEN 'Unknown'
        ELSE c.address 
      END as address,
      COUNT(*) as count
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    ${whereClause}
    GROUP BY address
    ORDER BY count DESC
    LIMIT 10
  `).all(params);
  return rows;
});

ipcMain.handle("get-filtered-barangay-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const whereWithAddress = whereClause
    ? `${whereClause} AND c.address IS NOT NULL AND c.address != ''`
    : "WHERE c.address IS NOT NULL AND c.address != ''";

  const rows = db.prepare(`
    SELECT DISTINCT c.id, c.address as address
    FROM entries e
    JOIN clients c ON e.client_id = c.id
    ${whereWithAddress}
  `).all(params);

  return computeBarangayCounts(rows);
});

// Get filtered referral distribution
ipcMain.handle("get-filtered-referral-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN clientReferral IS NULL OR clientReferral = '' THEN 'Unknown'
        ELSE clientReferral 
      END as referral
    FROM entries 
    ${whereClause}
  `).all(params);
  return splitAndCount(rows, 'referral');
});

// Get filtered person in charge distribution
ipcMain.handle("get-filtered-person-in-charge-distribution", (_e, filters) => {
  const { whereClause, params } = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);

  const rows = db.prepare(`
    SELECT 
      CASE 
        WHEN clientPerson IS NULL OR clientPerson = '' THEN 'Unknown'
        ELSE clientPerson 
      END as person
    FROM entries 
    ${whereClause}
  `).all(params);
  return splitAndCount(rows, 'person');
});

// ========================
// DOCUMENT GENERATION
// ========================

ipcMain.handle("generate-summary-document", async (_e, filters) => {
  try {
    // Build date filter if provided
    let dateFilterText = "";
    let whereClause = "";
    let params = {};

    if (filters && (filters.fromYear || filters.fromMonth || filters.toYear || filters.toMonth)) {
      const filterResult = buildDateFilter(filters.fromYear, filters.fromMonth, filters.toYear, filters.toMonth);
      whereClause = filterResult.whereClause;
      params = filterResult.params;

      const fromMonthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const toMonthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      if (filters.fromMonth && filters.fromYear) {
        dateFilterText = `${fromMonthNames[filters.fromMonth] || ''} ${filters.fromYear}`;
      }
      if (filters.toMonth && filters.toYear) {
        dateFilterText += ` - ${toMonthNames[filters.toMonth] || ''} ${filters.toYear}`;
      }
    }

    // Get statistics
    let totalClients, totalCases;
    if (whereClause) {
      totalCases = db.prepare(`SELECT COUNT(*) as count FROM entries ${whereClause}`).get(params).count;
      totalClients = db.prepare(`SELECT COUNT(DISTINCT client_id) as count FROM entries ${whereClause}`).get(params).count;
    } else {
      totalClients = db.prepare("SELECT COUNT(*) as count FROM clients").get().count;
      totalCases = db.prepare("SELECT COUNT(*) as count FROM entries").get().count;
    }

    // Get gender distribution
    let genderData;
    if (whereClause) {
      genderData = db.prepare(`
        SELECT 
          CASE 
            WHEN c.sex IS NULL OR c.sex = '' THEN 'Unknown'
            ELSE c.sex 
          END as category,
          COUNT(*) as count
        FROM entries e
        JOIN clients c ON e.client_id = c.id
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `).all(params);
    } else {
      genderData = db.prepare(`
        SELECT 
          CASE 
            WHEN sex IS NULL OR sex = '' THEN 'Unknown'
            ELSE sex 
          END as category,
          COUNT(*) as count
        FROM clients 
        GROUP BY category
        ORDER BY count DESC
      `).all();
    }

    // Get civil status distribution
    let civilStatusData;
    if (whereClause) {
      civilStatusData = db.prepare(`
        SELECT 
          CASE 
            WHEN c.civilStatus IS NULL OR c.civilStatus = '' THEN 'Unknown'
            ELSE c.civilStatus 
          END as category,
          COUNT(*) as count
        FROM entries e
        JOIN clients c ON e.client_id = c.id
        ${whereClause}
        GROUP BY category
        ORDER BY count DESC
      `).all(params);
    } else {
      civilStatusData = db.prepare(`
        SELECT 
          CASE 
            WHEN civilStatus IS NULL OR civilStatus = '' THEN 'Unknown'
            ELSE civilStatus 
          END as category,
          COUNT(*) as count
        FROM clients 
        GROUP BY category
        ORDER BY count DESC
      `).all();
    }

    // Get referral distribution (with comma-split handling)
    let referralData;
    if (whereClause) {
      const rawReferralData = db.prepare(`
        SELECT 
          CASE 
            WHEN clientReferral IS NULL OR clientReferral = '' THEN 'Unknown'
            ELSE clientReferral 
          END as referral
        FROM entries 
        ${whereClause}
      `).all(params);
      referralData = splitAndCount(rawReferralData, 'referral');
    } else {
      const rawReferralData = db.prepare(`
        SELECT 
          CASE 
            WHEN clientReferral IS NULL OR clientReferral = '' THEN 'Unknown'
            ELSE clientReferral 
          END as referral
        FROM entries 
      `).all();
      referralData = splitAndCount(rawReferralData, 'referral');
    }

	    // Get address distribution
	    let addressData;
	    if (whereClause) {
	      addressData = db.prepare(`
	        SELECT 
	          CASE 
	            WHEN c.address IS NULL OR c.address = '' THEN 'Unknown'
	            ELSE c.address 
	          END as category,
	          COUNT(*) as count
	        FROM entries e
	        JOIN clients c ON e.client_id = c.id
	        ${whereClause}
	        GROUP BY category
	        ORDER BY count DESC
	        LIMIT 20
	      `).all(params);
	    } else {
	      addressData = db.prepare(`
	        SELECT 
	          CASE 
	            WHEN address IS NULL OR address = '' THEN 'Unknown'
	            ELSE address 
	          END as category,
	          COUNT(*) as count
	        FROM clients 
	        GROUP BY category
	        ORDER BY count DESC
	        LIMIT 20
	      `).all();
	    }

	    // Get barangay distribution (derived from address strings)
	    let barangayData;
	    if (whereClause) {
	      const whereWithAddress = whereClause
	        ? `${whereClause} AND c.address IS NOT NULL AND c.address != ''`
	        : "WHERE c.address IS NOT NULL AND c.address != ''";

	      const barangayAddressRows = db.prepare(`
	        SELECT DISTINCT c.id, c.address as address
	        FROM entries e
	        JOIN clients c ON e.client_id = c.id
	        ${whereWithAddress}
	      `).all(params);

	      barangayData = computeBarangayCounts(barangayAddressRows);
	    } else {
	      const barangayAddressRows = db.prepare(`
	        SELECT address
	        FROM clients
	        WHERE address IS NOT NULL AND address != ''
	      `).all();

	      barangayData = computeBarangayCounts(barangayAddressRows);
	    }

    // Get age distribution
    let ageData;

    if (whereClause) {
      ageData = db.prepare(`
        SELECT 
          CASE 
            WHEN c.age IS NULL OR c.age = '' THEN 'Unknown'
            WHEN CAST(c.age AS INTEGER) < 18 THEN 'Minor (under 18)'
            WHEN CAST(c.age AS INTEGER) BETWEEN 18 AND 30 THEN '18-30'
            WHEN CAST(c.age AS INTEGER) BETWEEN 31 AND 59 THEN '31-59'
            WHEN CAST(c.age AS INTEGER) > 59 THEN 'Senior (60+)'
            ELSE 'Unknown'
          END as category,
          COUNT(*) as count
        FROM entries e
        JOIN clients c ON e.client_id = c.id
        ${whereClause}
        GROUP BY category
        ORDER BY 
          CASE category
            WHEN 'Minor (under 18)' THEN 1
            WHEN '18-30' THEN 2
            WHEN '31-59' THEN 3
            WHEN 'Senior (60+)' THEN 4
            WHEN 'Unknown' THEN 5
          END
      `).all(params);
    } else {
      ageData = db.prepare(`
        SELECT 
          CASE 
            WHEN age IS NULL OR age = '' THEN 'Unknown'
            WHEN CAST(age AS INTEGER) < 18 THEN 'Minor (under 18)'
            WHEN CAST(age AS INTEGER) BETWEEN 18 AND 30 THEN '18-30'
            WHEN CAST(age AS INTEGER) BETWEEN 31 AND 59 THEN '31-59'
            WHEN CAST(age AS INTEGER) > 59 THEN 'Senior (60+)'
            ELSE 'Unknown'
          END as category,
          COUNT(*) as count
        FROM clients 
        GROUP BY category
        ORDER BY 
          CASE category
            WHEN 'Minor (under 18)' THEN 1
            WHEN '18-30' THEN 2
            WHEN '31-59' THEN 3
            WHEN 'Senior (60+)' THEN 4
            WHEN 'Unknown' THEN 5
          END
      `).all();
    }

    // Get person in charge distribution (with comma-split handling)
    let personInChargeData;
    if (whereClause) {
      const rawPersonData = db.prepare(`
        SELECT 
          CASE 
            WHEN clientPerson IS NULL OR clientPerson = '' THEN 'Unknown'
            ELSE clientPerson 
          END as person
        FROM entries 
        ${whereClause}
      `).all(params);
      personInChargeData = splitAndCount(rawPersonData, 'person');
    } else {
      const rawPersonData = db.prepare(`
        SELECT 
          CASE 
            WHEN clientPerson IS NULL OR clientPerson = '' THEN 'Unknown'
            ELSE clientPerson 
          END as person
        FROM entries 
      `).all();
      personInChargeData = splitAndCount(rawPersonData, 'person');
    }

    // Build document content
    const now = new Date();
    const generatedDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let content = `
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
<b>CLIENT RECORDS SUMMARY REPORT</b><br>
Generated: ${generatedDate}<br><br>
`;

    if (dateFilterText) {
      content += `Period: ${dateFilterText} <br><br>
`;
    }

    content += `
<b>OVERVIEW</b><br>
Total Clients: ${totalClients}<br>
Total Cases: ${totalCases}<br><br>

<b>GENDER DISTRIBUTION</b><br>
`;
    genderData.forEach(row => {
      content += `${row.category}: ${row.count} <br>
`;
    });

    content += `
<b>CIVIL STATUS DISTRIBUTION</b><br>
`;
    civilStatusData.forEach(row => {
      content += `${row.category}: ${row.count} <br>
`;
    });

	    content += `
	<b>REFERRAL DISTRIBUTION</b><br>
	`;
	    referralData.forEach(row => {
	      content += `${row.referral ?? "Unknown"}: ${row.count} <br>
	`;
	    });

	    content += `
	<b>ADDRESS DISTRIBUTION</b><br>
	`;
	    addressData.forEach(row => {
	      content += `${row.category}: ${row.count} <br>
	`;
	    });

	    content += `
	<b>BARANGAY DISTRIBUTION</b><br>
	`;
	    barangayData.forEach(row => {
	      content += `${row.barangay}: ${row.count} <br>
	`;
	    });

    content += `
<b>AGE RANGE DISTRIBUTION</b><br>
`;
    ageData.forEach(row => {
      content += `${row.category}: ${row.count} <br>
`;
    });

	    content += `
	<b>PERSON IN CHARGE DISTRIBUTION</b><br>
	`;
	    personInChargeData.forEach(row => {
	      content += `${row.person ?? "Unknown"}: ${row.count} <br>
	`;
	    });

    content += `
</body>
</html>
`;


    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Save Summary Report',
      defaultPath: `Client_Records_Summary_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}.doc`,
      filters: [
        { name: 'Document Files', extensions: ['doc'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Save cancelled' };
    }

    // Write file
    fs.writeFileSync(result.filePath, content, 'utf8');

    // Open the file location
    shell.showItemInFolder(result.filePath);

    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('Error generating document:', error);
    return { success: false, message: error.message };
  }
});












// ========================
// WINDOW
// ========================
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Dev",
        submenu: [
          { role: "reload" },
          { role: "toggledevtools" }
        ]
      }
    ])
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

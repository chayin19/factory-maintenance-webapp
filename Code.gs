const DB_PROPERTY_KEY = 'MAINTENANCE_DB_ID';

const SHEET_HEADERS = {
  Machines: ['machine_id', 'machine_name', 'plant_name', 'machine_type', 'location', 'status', 'display_order'],
  Problem_Codebook: ['problem_code', 'problem_name_th', 'problem_group', 'machine_type', 'active', 'display_order'],
  Repair_Requests: ['request_id', 'created_at', 'machine_id', 'machine_name', 'plant_name', 'machine_type', 'problem_code', 'problem_name', 'problem_group', 'severity', 'note', 'image_url', 'request_status', 'status', 'accepted_at', 'started_at', 'closed_at', 'technician_name'],
  Problem_Review: ['review_id', 'created_at', 'request_id', 'machine_id', 'problem_code', 'problem_text', 'note', 'review_status'],
  Repair_Actions: ['action_id', 'request_id', 'created_at', 'technician_name', 'work_type', 'root_cause_code', 'root_cause_name', 'action_code', 'action_name', 'machine_stopped', 'repair_note', 'response_time_min', 'waiting_time_min', 'repair_time_min', 'downtime_min'],
  Root_Cause_Codebook: ['root_cause_code', 'root_cause_name_th', 'active', 'display_order'],
  Action_Codebook: ['action_code', 'action_name_th', 'active', 'display_order'],
  Parts_Used: ['part_id', 'request_id', 'part_name', 'qty', 'unit', 'note', 'created_at']
};

const MASTER_SEED = {
  Machines: [
    ['CS-01', 'เครื่องตัด CS-01', 'โรงงาน 1', 'เครื่องตัด', 'ไลน์ A', 'Active', 1],
    ['CS-02', 'เครื่องตัด CS-02', 'โรงงาน 1', 'เครื่องตัด', 'ไลน์ A', 'Active', 2],
    ['PK-01', 'เครื่องแพ็ก PK-01', 'โรงงาน 1', 'เครื่องแพ็ก', 'ไลน์ B', 'Active', 3],
    ['MX-01', 'เครื่องผสม MX-01', 'โรงงาน 2', 'เครื่องผสม', 'ไลน์ C', 'Active', 4]
  ],
  Problem_Codebook: [
    ['NOISE', 'เสียงดังผิดปกติ', 'เสียง/สั่น', '', 'Y', 1],
    ['VIBRATION', 'สั่นผิดปกติ', 'เสียง/สั่น', '', 'Y', 2],
    ['LEAK', 'น้ำมัน/ลมรั่ว', 'รั่วซึม', '', 'Y', 3],
    ['JAM', 'ติดขัด/เดินไม่ต่อเนื่อง', 'การทำงาน', '', 'Y', 4],
    ['SENSOR', 'เซนเซอร์แจ้งเตือน', 'ไฟฟ้า/ควบคุม', '', 'Y', 5],
    ['MOTOR', 'มอเตอร์ร้อนหรือไม่หมุน', 'ไฟฟ้า/ควบคุม', '', 'Y', 6]
  ],
  Root_Cause_Codebook: [
    ['WEAR', 'ชิ้นส่วนสึกหรอ', 'Y', 1],
    ['LOOSE', 'น็อต/จุดยึดหลวม', 'Y', 2],
    ['DIRTY', 'สกปรกหรือมีเศษติด', 'Y', 3],
    ['ELECTRIC', 'ระบบไฟฟ้าขัดข้อง', 'Y', 4],
    ['SETTING', 'ตั้งค่าไม่ถูกต้อง', 'Y', 5],
    ['UNKNOWN', 'ยังไม่ทราบสาเหตุ', 'Y', 6]
  ],
  Action_Codebook: [
    ['ADJUST', 'ปรับตั้ง', 'Y', 1],
    ['CLEAN', 'ทำความสะอาด', 'Y', 2],
    ['TIGHTEN', 'ขันแน่น', 'Y', 3],
    ['REPLACE', 'เปลี่ยนอะไหล่', 'Y', 4],
    ['RESET', 'รีเซ็ตระบบ', 'Y', 5],
    ['MONITOR', 'เฝ้าระวังต่อ', 'Y', 6]
  ]
};

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'home';
  const file = page === 'report' ? 'Report' : page === 'technician' ? 'Technician' : page === 'supervisor' ? 'Supervisor' : 'Home';
  const template = HtmlService.createTemplateFromFile(file);
  template.machineId = (e && e.parameter && e.parameter.machine_id) || '';
  return template.evaluate()
    .setTitle('ระบบแจ้งซ่อมโรงงาน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Run this once if you want to connect the app to the provided maintenance spreadsheet.
function useProvidedMaintenanceDatabase() {
  const databaseId = '1bQiQ5A_Gouw8_JznvYu_GqdHhoRXJ04AUEfFzizh79Q';
  PropertiesService.getScriptProperties().setProperty(DB_PROPERTY_KEY, databaseId);
  return setupDatabase();
}

// Creates the database only when the configured property is missing, then validates sheets without clearing data.
function setupDatabase() {
  const properties = PropertiesService.getScriptProperties();
  let dbId = properties.getProperty(DB_PROPERTY_KEY);
  let spreadsheet;

  if (dbId) {
    spreadsheet = SpreadsheetApp.openById(dbId);
  } else {
    spreadsheet = SpreadsheetApp.create('Factory Maintenance Database');
    dbId = spreadsheet.getId();
    properties.setProperty(DB_PROPERTY_KEY, dbId);
  }

  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    const sheet = getOrCreateSheet_(spreadsheet, sheetName);
    ensureHeaders_(sheet, SHEET_HEADERS[sheetName]);
    seedSheetIfEmpty_(sheet, sheetName);
  });

  return checkSystemHealth();
}

function checkSystemHealth() {
  const dbId = PropertiesService.getScriptProperties().getProperty(DB_PROPERTY_KEY);
  const result = {
    ok: Boolean(dbId),
    dbId: dbId || '',
    sheets: [],
    missingSheets: [],
    message: ''
  };

  if (!dbId) {
    result.message = 'ยังไม่ได้ตั้งค่าฐานข้อมูล กรุณารัน setupDatabase()';
    return result;
  }

  const spreadsheet = SpreadsheetApp.openById(dbId);
  Object.keys(SHEET_HEADERS).forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      result.ok = false;
      result.missingSheets.push(sheetName);
      return;
    }
    const headers = getHeaders_(sheet);
    const missingHeaders = SHEET_HEADERS[sheetName].filter(function(header) {
      return headers.indexOf(header) === -1;
    });
    result.sheets.push({
      name: sheetName,
      rows: Math.max(sheet.getLastRow() - 1, 0),
      missingHeaders: missingHeaders
    });
    if (missingHeaders.length) result.ok = false;
  });
  result.message = result.ok ? 'ระบบพร้อมใช้งาน' : 'พบชีตหรือหัวตารางที่ยังไม่ครบ';
  return result;
}

function getHomeData() {
  const rows = readObjects_('Machines')
    .filter(function(row) { return String(row.status || '').toLowerCase() === 'active'; })
    .sort(function(a, b) {
      return Number(a.display_order || 999) - Number(b.display_order || 999);
    });
  const groups = {};
  rows.forEach(function(machine) {
    const plant = machine.plant_name || 'ไม่ระบุโรงงาน';
    const type = machine.machine_type || 'ไม่ระบุประเภท';
    groups[plant] = groups[plant] || {};
    groups[plant][type] = groups[plant][type] || [];
    groups[plant][type].push(machine);
  });
  return { machines: rows, groups: groups };
}

function getReportPageData(machineId) {
  const machine = findById_('Machines', 'machine_id', machineId);
  if (!machine) throw new Error('ไม่พบเครื่องจักร: ' + machineId);

  const problems = readObjects_('Problem_Codebook')
    .filter(function(row) {
      const active = String(row.active || '').toUpperCase() === 'Y';
      const type = String(row.machine_type || '');
      return active && (!type || type === machine.machine_type);
    })
    .sort(function(a, b) {
      return Number(a.display_order || 999) - Number(b.display_order || 999);
    });
  const groups = {};
  problems.forEach(function(problem) {
    const group = problem.problem_group || 'อื่น ๆ';
    groups[group] = groups[group] || [];
    groups[group].push(problem);
  });
  return { machine: machine, problemGroups: groups };
}

function submitRepairRequest(payload) {
  if (!payload || !payload.machine_id) throw new Error('ข้อมูลเครื่องจักรไม่ครบ');
  if (!payload.problem_code) throw new Error('กรุณาเลือกอาการ');
  if (!payload.severity) throw new Error('กรุณาเลือกระดับความรุนแรง');

  const machine = findById_('Machines', 'machine_id', payload.machine_id);
  if (!machine) throw new Error('ไม่พบเครื่องจักร');

  const now = new Date();
  const requestId = generateRequestId_(now);
  const problemName = payload.problem_name || getProblemName_(payload.problem_code);
  const row = {
    request_id: requestId,
    created_at: now,
    machine_id: machine.machine_id,
    machine_name: machine.machine_name,
    plant_name: machine.plant_name,
    machine_type: machine.machine_type,
    problem_code: payload.problem_code,
    problem_name: problemName,
    problem_group: payload.problem_group || '',
    severity: payload.severity,
    note: payload.note || '',
    image_url: payload.image_url || '',
    request_status: 'Open',
    status: 'Open',
    accepted_at: '',
    started_at: '',
    closed_at: '',
    technician_name: ''
  };
  appendObject_('Repair_Requests', row);

  if (payload.problem_code === 'OTHER' || payload.problem_code === 'UNSURE') {
    appendObject_('Problem_Review', {
      review_id: 'REV-' + Utilities.getUuid(),
      created_at: now,
      request_id: requestId,
      machine_id: machine.machine_id,
      problem_code: payload.problem_code,
      problem_text: problemName,
      note: payload.note || '',
      review_status: 'New'
    });
  }

  return { ok: true, request_id: requestId };
}

function getTechnicianJobs() {
  return readObjects_('Repair_Requests')
    .filter(function(row) {
      return row.request_status === 'Open' || row.request_status === 'In Progress';
    })
    .sort(function(a, b) {
      return toDate_(a.created_at).getTime() - toDate_(b.created_at).getTime();
    });
}

function acceptJob(requestId, technicianName) {
  const sheet = getSheet_('Repair_Requests');
  const found = findRow_(sheet, 'request_id', requestId);
  if (!found) throw new Error('ไม่พบงานซ่อม');
  const row = found.object;
  if (row.request_status === 'Closed') throw new Error('งานนี้ปิดแล้ว');
  if (!row.accepted_at) setCells_(sheet, found.rowIndex, { accepted_at: new Date() });
  setCells_(sheet, found.rowIndex, {
    request_status: 'In Progress',
    status: 'In Progress',
    technician_name: technicianName || row.technician_name || 'ช่าง'
  });
  return { ok: true };
}

function startRepair(requestId, technicianName) {
  const sheet = getSheet_('Repair_Requests');
  const found = findRow_(sheet, 'request_id', requestId);
  if (!found) throw new Error('ไม่พบงานซ่อม');
  const row = found.object;
  if (!row.accepted_at) throw new Error('กรุณารับงานก่อนเริ่มซ่อม');
  if (row.request_status === 'Closed') throw new Error('งานนี้ปิดแล้ว');
  if (!row.started_at) setCells_(sheet, found.rowIndex, { started_at: new Date() });
  setCells_(sheet, found.rowIndex, {
    request_status: 'In Progress',
    status: 'In Progress',
    technician_name: technicianName || row.technician_name || 'ช่าง'
  });
  return { ok: true };
}

function getCloseJobData() {
  return {
    rootCauses: activeCodebook_('Root_Cause_Codebook', 'root_cause_code', 'root_cause_name_th'),
    actions: activeCodebook_('Action_Codebook', 'action_code', 'action_name_th')
  };
}

function closeJob(payload) {
  if (!payload || !payload.request_id) throw new Error('ไม่พบเลขที่งาน');
  ['work_type', 'root_cause_code', 'action_code', 'machine_stopped', 'repair_note'].forEach(function(field) {
    if (!payload[field]) throw new Error('กรุณากรอกข้อมูลปิดงานให้ครบ');
  });

  const requestSheet = getSheet_('Repair_Requests');
  const found = findRow_(requestSheet, 'request_id', payload.request_id);
  if (!found) throw new Error('ไม่พบงานซ่อม');
  const request = found.object;
  if (request.request_status === 'Closed' || request.closed_at) throw new Error('งานนี้ถูกปิดแล้ว');
  if (!request.accepted_at || !request.started_at) throw new Error('ต้องรับงานและเริ่มซ่อมก่อนปิดงาน');
  if (findById_('Repair_Actions', 'request_id', payload.request_id)) throw new Error('มีบันทึกปิดงานนี้แล้ว');

  const now = new Date();
  const createdAt = toDate_(request.created_at);
  const acceptedAt = toDate_(request.accepted_at);
  const startedAt = toDate_(request.started_at);
  const rootCause = findById_('Root_Cause_Codebook', 'root_cause_code', payload.root_cause_code) || {};
  const action = findById_('Action_Codebook', 'action_code', payload.action_code) || {};
  const responseTime = minutesBetween_(createdAt, acceptedAt);
  const waitingTime = minutesBetween_(acceptedAt, startedAt);
  const repairTime = minutesBetween_(startedAt, now);
  const machineStopped = String(payload.machine_stopped) === 'Yes';

  appendObject_('Repair_Actions', {
    action_id: 'ACT-' + Utilities.getUuid(),
    request_id: payload.request_id,
    created_at: now,
    technician_name: payload.technician_name || request.technician_name || 'ช่าง',
    work_type: payload.work_type,
    root_cause_code: payload.root_cause_code,
    root_cause_name: rootCause.root_cause_name_th || '',
    action_code: payload.action_code,
    action_name: action.action_name_th || '',
    machine_stopped: payload.machine_stopped,
    repair_note: payload.repair_note,
    response_time_min: responseTime,
    waiting_time_min: waitingTime,
    repair_time_min: repairTime,
    downtime_min: machineStopped ? minutesBetween_(createdAt, now) : 0
  });

  setCells_(requestSheet, found.rowIndex, {
    request_status: 'Closed',
    status: 'Closed',
    closed_at: now,
    technician_name: payload.technician_name || request.technician_name || 'ช่าง'
  });
  return { ok: true };
}

function getSupervisorDashboard() {
  const requests = readObjects_('Repair_Requests');
  const actions = readObjects_('Repair_Actions');
  const todayKey = formatDateKey_(new Date());
  const openJobs = requests.filter(function(row) { return row.request_status === 'Open'; });
  const inProgressJobs = requests.filter(function(row) { return row.request_status === 'In Progress'; });
  const closedToday = requests.filter(function(row) {
    return row.request_status === 'Closed' && row.closed_at && formatDateKey_(toDate_(row.closed_at)) === todayKey;
  });
  const downtimeToday = actions.reduce(function(total, row) {
    return formatDateKey_(toDate_(row.created_at)) === todayKey ? total + Number(row.downtime_min || 0) : total;
  }, 0);
  const waitingOver30 = openJobs.filter(function(row) {
    return minutesBetween_(toDate_(row.created_at), new Date()) > 30;
  });

  return {
    summary: {
      open: openJobs.length,
      inProgress: inProgressJobs.length,
      closedToday: closedToday.length,
      downtimeToday: downtimeToday
    },
    topMachines: topCounts_(requests, 'machine_id', 'machine_name'),
    topProblems: topCounts_(requests, 'problem_code', 'problem_name'),
    waitingOver30: waitingOver30
  };
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function getSheet_(sheetName) {
  const dbId = PropertiesService.getScriptProperties().getProperty(DB_PROPERTY_KEY);
  if (!dbId) throw new Error('ยังไม่ได้ตั้งค่าฐานข้อมูล กรุณารัน setupDatabase()');
  return SpreadsheetApp.openById(dbId).getSheetByName(sheetName);
}

function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getLastRow() ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(String) : [];
  if (!currentHeaders.length) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return;
  }
  const missing = requiredHeaders.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });
  if (missing.length) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
}

function seedSheetIfEmpty_(sheet, sheetName) {
  const seed = MASTER_SEED[sheetName];
  if (!seed || sheet.getLastRow() > 1) return;
  const headers = getHeaders_(sheet);
  const requiredHeaders = SHEET_HEADERS[sheetName];
  const rows = seed.map(function(seedRow) {
    return headers.map(function(header) {
      const seedIndex = requiredHeaders.indexOf(header);
      return seedIndex === -1 ? '' : seedRow[seedIndex];
    });
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function getHeaders_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = getHeaders_(sheet);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values.map(function(row) {
    const object = {};
    headers.forEach(function(header, index) {
      object[header] = normalizeValue_(row[index]);
    });
    return object;
  });
}

function appendObject_(sheetName, object) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : '';
  });
  sheet.appendRow(row);
}

function findById_(sheetName, key, value) {
  return readObjects_(sheetName).filter(function(row) {
    return String(row[key]) === String(value);
  })[0] || null;
}

function findRow_(sheet, key, value) {
  const headers = getHeaders_(sheet);
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1 || sheet.getLastRow() < 2) return null;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][keyIndex]) === String(value)) {
      const object = {};
      headers.forEach(function(header, index) {
        object[header] = normalizeValue_(values[i][index]);
      });
      return { rowIndex: i + 2, object: object, headers: headers };
    }
  }
  return null;
}

function setCells_(sheet, rowIndex, valuesByHeader) {
  const headers = getHeaders_(sheet);
  Object.keys(valuesByHeader).forEach(function(header) {
    const colIndex = headers.indexOf(header) + 1;
    if (colIndex > 0) sheet.getRange(rowIndex, colIndex).setValue(valuesByHeader[header]);
  });
}

function generateRequestId_(date) {
  const key = formatDateKey_(date);
  const prefix = 'REQ-' + key + '-';
  const maxRunning = readObjects_('Repair_Requests').reduce(function(max, row) {
    const id = String(row.request_id || '');
    if (id.indexOf(prefix) !== 0) return max;
    return Math.max(max, Number(id.slice(prefix.length)) || 0);
  }, 0);
  return prefix + Utilities.formatString('%04d', maxRunning + 1);
}

function getProblemName_(problemCode) {
  if (problemCode === 'OTHER') return 'อื่น ๆ / ไม่อยู่ในรายการ';
  if (problemCode === 'UNSURE') return 'ไม่แน่ใจ ให้ช่างประเมิน';
  const problem = findById_('Problem_Codebook', 'problem_code', problemCode);
  return problem ? problem.problem_name_th : problemCode;
}

function activeCodebook_(sheetName, codeKey, nameKey) {
  return readObjects_(sheetName)
    .filter(function(row) { return String(row.active || '').toUpperCase() === 'Y'; })
    .sort(function(a, b) { return Number(a.display_order || 999) - Number(b.display_order || 999); })
    .map(function(row) {
      return { code: row[codeKey], name: row[nameKey] };
    });
}

function topCounts_(rows, keyField, labelField) {
  const map = {};
  rows.forEach(function(row) {
    const key = row[keyField] || 'ไม่ระบุ';
    map[key] = map[key] || { key: key, label: row[labelField] || key, count: 0 };
    map[key].count += 1;
  });
  return Object.keys(map).map(function(key) { return map[key]; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 5);
}

function minutesBetween_(start, end) {
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function toDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  return value ? new Date(value) : new Date('');
}

function formatDateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd');
}

function normalizeValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return value;
}

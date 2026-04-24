/**
 * Phase 1 setup for factory maintenance request and repair tracking.
 *
 * Setup instructions:
 * 1. Create a new Google Apps Script project.
 * 2. Paste this file into Code.gs.
 * 3. Select setupDatabase from the function dropdown.
 * 4. Click Run and approve the requested spreadsheet permissions.
 * 5. Open View > Logs to copy the generated spreadsheet URL.
 * 6. Re-running setupDatabase will reuse the spreadsheet ID saved in Script Properties.
 *
 * The spreadsheet ID is saved in Script Properties as MAINTENANCE_DB_ID.
 */

const DB_PROPERTY_KEY = 'MAINTENANCE_DB_ID';

const SHEET_SCHEMAS = {
  Machines: [
    'machine_id',
    'plant_id',
    'plant_name',
    'machine_group',
    'machine_type',
    'machine_name',
    'location',
    'qr_url',
    'status',
    'created_at',
    'updated_at',
  ],
  Repair_Requests: [
    'request_id',
    'request_datetime',
    'machine_id',
    'plant_id',
    'plant_name',
    'machine_group',
    'reported_by',
    'reporter_role',
    'problem_code',
    'problem_name_th',
    'problem_source',
    'problem_other_text',
    'symptom_note',
    'image_url',
    'priority',
    'machine_status',
    'downtime_start',
    'request_status',
    'assigned_to',
    'created_at',
    'updated_at',
  ],
  Repair_Actions: [
    'action_id',
    'request_id',
    'technician_name',
    'start_datetime',
    'finish_datetime',
    'downtime_end',
    'downtime_minutes',
    'repair_minutes',
    'confirmed_problem_code',
    'root_cause_code',
    'action_code',
    'repair_summary',
    'is_repeat_failure',
    'requires_follow_up',
    'job_status',
    'created_at',
    'updated_at',
  ],
  Problem_Codebook: [
    'problem_code',
    'problem_name_th',
    'machine_group',
    'machine_type',
    'plant_id',
    'severity_default',
    'active',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  Root_Cause_Codebook: [
    'root_cause_code',
    'root_cause_name_th',
    'category_th',
    'active',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  Action_Codebook: [
    'action_code',
    'action_name_th',
    'category_th',
    'active',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  Parts_Used: [
    'part_used_id',
    'action_id',
    'request_id',
    'part_code',
    'part_name',
    'quantity',
    'unit',
    'cost',
    'created_at',
  ],
  Problem_Review: [
    'review_id',
    'request_id',
    'machine_id',
    'machine_group',
    'problem_other_text',
    'symptom_note',
    'review_status',
    'reviewed_by',
    'approved_problem_code',
    'review_note',
    'created_at',
    'updated_at',
  ],
};

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'home';

  if (page === 'home') {
    return HtmlService.createTemplateFromFile('Home').evaluate()
      .setTitle('เมนูแจ้งซ่อมเครื่องจักร')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  if (page !== 'report') {
    return HtmlService.createHtmlOutput('ไม่พบหน้าที่ต้องการ');
  }

  const template = HtmlService.createTemplateFromFile('Report');
  template.machineId = (e && e.parameter && e.parameter.machine_id) || '';

  return template.evaluate()
    .setTitle('แจ้งซ่อมเครื่องจักร')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getActiveMachines() {
  const spreadsheet = getOrCreateDatabase_();
  const sheet = spreadsheet.getSheetByName('Machines');
  const rows = sheetToObjects_(sheet);

  return rows
    .filter(function (row) {
      const status = String(row.status || '').trim().toLowerCase();
      return status === 'active';
    })
    .map(function (row) {
      return {
        machine_id: row.machine_id,
        plant_id: row.plant_id,
        plant_name: row.plant_name,
        machine_group: row.machine_group,
        machine_type: row.machine_type,
        machine_name: row.machine_name,
        location: row.location,
      };
    })
    .sort(function (a, b) {
      return String(a.plant_id).localeCompare(String(b.plant_id), 'en') ||
        String(a.machine_group || a.machine_type).localeCompare(String(b.machine_group || b.machine_type), 'en') ||
        String(a.machine_id).localeCompare(String(b.machine_id), 'en', { numeric: true });
    });
}

function getReportPageData(machineId) {
  if (!machineId) {
    throw new Error('ไม่พบรหัสเครื่องจักรจาก QR Code');
  }

  const spreadsheet = getOrCreateDatabase_();
  const machine = findMachineById_(spreadsheet, machineId);

  if (!machine) {
    throw new Error('ไม่พบข้อมูลเครื่องจักร: ' + machineId);
  }

  const problemCodes = getProblemCodesForMachine_(spreadsheet, machine);

  return {
    machine: machine,
    problemGroups: groupProblemCodes_(problemCodes, machine),
  };
}

function submitRepairRequest(formData) {
  validateRepairRequest_(formData);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = getOrCreateDatabase_();
    const machine = findMachineById_(spreadsheet, formData.machine_id);

    if (!machine) {
      throw new Error('ไม่พบข้อมูลเครื่องจักร: ' + formData.machine_id);
    }

    const now = new Date();
    const requestId = generateRequestId_(spreadsheet, now);
    const problemCode = formData.problem_code || 'GEN_OTHER_REVIEW';
    const problemName = formData.problem_name_th || '';
    const problemSource = formData.problem_source || 'codebook';
    const machineStatus = formData.priority === 'หยุดเครื่อง' ? 'stopped' : 'running';

    appendObjectRow_(spreadsheet.getSheetByName('Repair_Requests'), {
      request_id: requestId,
      request_datetime: now,
      machine_id: machine.machine_id,
      plant_id: machine.plant_id,
      plant_name: machine.plant_name,
      machine_group: machine.machine_group,
      reported_by: formData.reported_by || '',
      reporter_role: 'operator',
      problem_code: problemCode,
      problem_name_th: problemName,
      problem_source: problemSource,
      problem_other_text: formData.other_problem_text || '',
      symptom_note: formData.symptom_note || '',
      image_url: formData.image_url || '',
      priority: formData.priority,
      machine_status: machineStatus,
      downtime_start: formData.priority === 'หยุดเครื่อง' ? now : '',
      request_status: 'Open',
      assigned_to: '',
      created_at: now,
      updated_at: now,
    });

    if (problemSource === 'other' || problemSource === 'technician_assess') {
      appendObjectRow_(spreadsheet.getSheetByName('Problem_Review'), {
        review_id: 'PRV-' + requestId.replace('REQ-', ''),
        request_id: requestId,
        machine_id: machine.machine_id,
        machine_group: machine.machine_group,
        problem_other_text: formData.other_problem_text || problemName,
        symptom_note: formData.symptom_note || '',
        review_status: 'Open',
        reviewed_by: '',
        approved_problem_code: '',
        review_note: '',
        created_at: now,
        updated_at: now,
      });
    }

    SpreadsheetApp.flush();

    return {
      request_id: requestId,
      request_status: 'Open',
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
    };
  } finally {
    lock.releaseLock();
  }
}

function setupDatabase() {
  const spreadsheet = getOrCreateDatabase_();
  const now = new Date();

  Object.keys(SHEET_SCHEMAS).forEach(function (sheetName) {
    const sheet = getOrCreateSheet_(spreadsheet, sheetName);
    setupHeader_(sheet, SHEET_SCHEMAS[sheetName]);
  });
  removeEmptyDefaultSheets_(spreadsheet);

  seedMachines_(spreadsheet.getSheetByName('Machines'), now);
  seedProblemCodebook_(spreadsheet.getSheetByName('Problem_Codebook'), now);
  seedRootCauseCodebook_(spreadsheet.getSheetByName('Root_Cause_Codebook'), now);
  seedActionCodebook_(spreadsheet.getSheetByName('Action_Codebook'), now);

  SpreadsheetApp.flush();
  Logger.log('Maintenance database is ready: ' + spreadsheet.getUrl());
  Logger.log('Spreadsheet ID saved in Script Properties key: ' + DB_PROPERTY_KEY);
}

function getOrCreateDatabase_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(DB_PROPERTY_KEY);

  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      Logger.log('Stored spreadsheet ID could not be opened. Creating a new database.');
    }
  }

  const spreadsheet = SpreadsheetApp.create('Factory Maintenance DB');
  properties.setProperty(DB_PROPERTY_KEY, spreadsheet.getId());
  return spreadsheet;
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function findMachineById_(spreadsheet, machineId) {
  const sheet = spreadsheet.getSheetByName('Machines');
  const rows = sheetToObjects_(sheet);
  const targetId = String(machineId).trim().toUpperCase();

  return rows.find(function (row) {
    return String(row.machine_id).trim().toUpperCase() === targetId && row.status === 'active';
  }) || null;
}

function getProblemCodesForMachine_(spreadsheet, machine) {
  const sheet = spreadsheet.getSheetByName('Problem_Codebook');
  const rows = sheetToObjects_(sheet);

  return rows
    .filter(function (row) {
      const isActive = row.active === true || String(row.active).toLowerCase() === 'true';
      const isMachineGroup = row.machine_group === machine.machine_group;
      const isMachineType = row.machine_type === machine.machine_type;
      const isGeneral = row.machine_group === 'General' || row.machine_type === 'ALL';
      const isSamePlant = row.plant_id === machine.plant_id || row.plant_id === 'ALL';

      return isActive && isSamePlant && (isMachineGroup || isMachineType || isGeneral);
    })
    .filter(function (row) {
      return row.problem_code !== 'GEN_OTHER_REVIEW';
    })
    .sort(function (a, b) {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

function groupProblemCodes_(problemCodes, machine) {
  const processProblems = [];
  const generalProblems = [];

  problemCodes.forEach(function (problem) {
    const item = {
      problem_code: problem.problem_code,
      problem_name_th: problem.problem_name_th,
      severity_default: problem.severity_default,
    };

    if (problem.machine_group === 'General' || problem.machine_type === 'ALL') {
      generalProblems.push(item);
    } else {
      processProblems.push(item);
    }
  });

  const groups = [];

  if (processProblems.length > 0) {
    groups.push({
      group_name: machine.machine_group,
      group_label: 'อาการเสียของกระบวนการนี้',
      problems: processProblems,
    });
  }

  if (generalProblems.length > 0) {
    groups.push({
      group_name: 'General',
      group_label: 'อาการเสียทั่วไป',
      problems: generalProblems,
    });
  }

  return groups;
}

function validateRepairRequest_(formData) {
  if (!formData) {
    throw new Error('ไม่พบข้อมูลแจ้งซ่อม');
  }

  if (!formData.machine_id) {
    throw new Error('ไม่พบรหัสเครื่องจักร');
  }

  if (!formData.problem_code) {
    throw new Error('กรุณาเลือกอาการเสีย');
  }

  if (!formData.priority) {
    throw new Error('กรุณาเลือกระดับความเร่งด่วน');
  }

  if (formData.problem_source === 'other' && !String(formData.other_problem_text || '').trim()) {
    throw new Error('กรุณาระบุอาการเสียอื่น ๆ');
  }
}

function generateRequestId_(spreadsheet, now) {
  const dateText = Utilities.formatDate(now, getScriptTimeZone_(), 'yyyyMMdd');
  const prefix = 'REQ-' + dateText + '-';
  const requestSheet = spreadsheet.getSheetByName('Repair_Requests');
  const requests = sheetToObjects_(requestSheet);
  let maxSequence = 0;

  requests.forEach(function (request) {
    const requestId = String(request.request_id || '');

    if (requestId.indexOf(prefix) === 0) {
      const sequence = Number(requestId.slice(prefix.length));
      if (sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  });

  return prefix + String(maxSequence + 1).padStart(4, '0');
}

function appendObjectRow_(sheet, rowObject) {
  const headers = getHeaders_(sheet);
  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : '';
  });

  sheet.appendRow(row);
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values.slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    })
    .map(function (row) {
      const object = {};
      headers.forEach(function (header, index) {
        object[header] = row[index];
      });
      return object;
    });
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    return [];
  }

  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getScriptTimeZone_() {
  return Session.getScriptTimeZone() || 'Asia/Bangkok';
}

function setupHeader_(sheet, headers) {
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#d9ead3');
  sheet.autoResizeColumns(1, headers.length);
}

function removeEmptyDefaultSheets_(spreadsheet) {
  const requiredSheetNames = Object.keys(SHEET_SCHEMAS);

  spreadsheet.getSheets().forEach(function (sheet) {
    const sheetName = sheet.getName();
    const isRequired = requiredSheetNames.indexOf(sheetName) !== -1;
    const isEmptyDefault = /^Sheet\d*$/.test(sheetName) && sheet.getLastRow() === 0 && sheet.getLastColumn() === 0;

    if (!isRequired && isEmptyDefault && spreadsheet.getSheets().length > requiredSheetNames.length) {
      spreadsheet.deleteSheet(sheet);
    }
  });
}

function seedMachines_(sheet, now) {
  const rows = [];

  addMachineRange_(rows, 'P1', 'โรงถุงพลาสติก', 'Blown Film', 'BF', 1, 8, 'BF', 'พื้นที่ผลิตฟิล์ม', now);
  addMachineRange_(rows, 'P1', 'โรงถุงพลาสติก', 'Cutting/Sealing', 'CS', 1, 5, 'CS', 'พื้นที่ตัดและซีลถุง', now);
  addMachine_(rows, 'TL-01', 'P2', 'โรงกระสอบ', 'Tape Line', 'Tape Line', 'TL-01', 'พื้นที่ผลิตเส้นเทป', now);
  addMachineRange_(rows, 'P2', 'โรงกระสอบ', 'Loom', 'LM', 1, 27, 'LM', 'พื้นที่ทอ', now);
  addMachineRange_(rows, 'P2', 'โรงกระสอบ', 'Sack Cutting', 'SC', 1, 3, 'SC', 'พื้นที่ตัดกระสอบ', now);
  addMachine_(rows, 'PR-01', 'P2', 'โรงกระสอบ', 'Printing', 'Printing', 'PR-01', 'พื้นที่พิมพ์', now);

  sheet.getRange(2, 1, rows.length, SHEET_SCHEMAS.Machines.length).setValues(rows);
  sheet.autoResizeColumns(1, SHEET_SCHEMAS.Machines.length);
}

function addMachineRange_(rows, plantId, plantName, machineGroup, machinePrefix, start, end, machineType, location, now) {
  for (let i = start; i <= end; i += 1) {
    const machineId = machinePrefix + '-' + String(i).padStart(2, '0');
    addMachine_(rows, machineId, plantId, plantName, machineGroup, machineType, machineId, location, now);
  }
}

function addMachine_(rows, machineId, plantId, plantName, machineGroup, machineType, machineName, location, now) {
  rows.push([
    machineId,
    plantId,
    plantName,
    machineGroup,
    machineType,
    machineName,
    location,
    '?machine_id=' + encodeURIComponent(machineId),
    'active',
    now,
    now,
  ]);
}

function seedProblemCodebook_(sheet, now) {
  const rows = [
    ['BF_FILM_BREAK', 'ฟิล์มขาด', 'Blown Film', 'BF', 'P1', 'medium', true, 10, now, now],
    ['BF_THICKNESS', 'ความหนาฟิล์มผิดปกติ', 'Blown Film', 'BF', 'P1', 'medium', true, 20, now, now],
    ['BF_DIE_LEAK', 'หัวดายรั่ว/ตัน', 'Blown Film', 'BF', 'P1', 'high', true, 30, now, now],
    ['CS_SEAL_BAD', 'ซีลไม่ติด/ซีลรั่ว', 'Cutting/Sealing', 'CS', 'P1', 'medium', true, 40, now, now],
    ['CS_CUT_BAD', 'ตัดไม่ขาด/ระยะตัดเพี้ยน', 'Cutting/Sealing', 'CS', 'P1', 'medium', true, 50, now, now],
    ['TL_TAPE_BREAK', 'เส้นเทปขาด', 'Tape Line', 'TL', 'P2', 'medium', true, 60, now, now],
    ['TL_WIDTH_BAD', 'ขนาดเส้นเทปผิดปกติ', 'Tape Line', 'TL', 'P2', 'medium', true, 70, now, now],
    ['LM_WARP_BREAK', 'เส้นยืนขาด', 'Loom', 'LM', 'P2', 'medium', true, 80, now, now],
    ['LM_WEFT_BREAK', 'เส้นพุ่งขาด', 'Loom', 'LM', 'P2', 'medium', true, 90, now, now],
    ['LM_SENSOR', 'เซนเซอร์เครื่องทอมีปัญหา', 'Loom', 'LM', 'P2', 'high', true, 100, now, now],
    ['SC_CUT_BAD', 'ตัดกระสอบไม่ขาด/ขนาดเพี้ยน', 'Sack Cutting', 'SC', 'P2', 'medium', true, 110, now, now],
    ['PR_PRINT_BAD', 'งานพิมพ์ไม่ชัด/สีเพี้ยน', 'Printing', 'PR', 'P2', 'medium', true, 120, now, now],
    ['GEN_NO_POWER', 'เครื่องไม่ทำงาน/ไฟไม่เข้า', 'General', 'ALL', 'ALL', 'high', true, 900, now, now],
    ['GEN_ABNORMAL_NOISE', 'เสียงดังผิดปกติ', 'General', 'ALL', 'ALL', 'medium', true, 910, now, now],
    ['GEN_AIR_LEAK', 'ลมรั่ว/แรงดันลมตก', 'General', 'ALL', 'ALL', 'medium', true, 920, now, now],
    ['GEN_OTHER_REVIEW', 'อื่น ๆ (ส่งตรวจสอบ)', 'General', 'ALL', 'ALL', 'low', true, 999, now, now],
  ];

  sheet.getRange(2, 1, rows.length, SHEET_SCHEMAS.Problem_Codebook.length).setValues(rows);
  sheet.autoResizeColumns(1, SHEET_SCHEMAS.Problem_Codebook.length);
}

function seedRootCauseCodebook_(sheet, now) {
  const rows = [
    ['RC_WEAR', 'ชิ้นส่วนสึกหรอ', 'เครื่องกล', true, 10, now, now],
    ['RC_MISALIGN', 'ตั้งศูนย์/ตั้งระยะไม่ถูกต้อง', 'เครื่องกล', true, 20, now, now],
    ['RC_ELECTRICAL', 'ระบบไฟฟ้าขัดข้อง', 'ไฟฟ้า', true, 30, now, now],
    ['RC_SENSOR', 'เซนเซอร์/สัญญาณผิดปกติ', 'ควบคุม', true, 40, now, now],
    ['RC_PNEUMATIC', 'ระบบลมผิดปกติ', 'ลม', true, 50, now, now],
    ['RC_OPERATOR_SETTING', 'การตั้งค่าหน้างานไม่เหมาะสม', 'การใช้งาน', true, 60, now, now],
    ['RC_UNKNOWN', 'รอสรุปสาเหตุ', 'อื่น ๆ', true, 999, now, now],
  ];

  sheet.getRange(2, 1, rows.length, SHEET_SCHEMAS.Root_Cause_Codebook.length).setValues(rows);
  sheet.autoResizeColumns(1, SHEET_SCHEMAS.Root_Cause_Codebook.length);
}

function seedActionCodebook_(sheet, now) {
  const rows = [
    ['ACT_ADJUST', 'ปรับตั้ง', 'แก้ไขหน้างาน', true, 10, now, now],
    ['ACT_CLEAN', 'ทำความสะอาด', 'บำรุงรักษา', true, 20, now, now],
    ['ACT_REPLACE_PART', 'เปลี่ยนอะไหล่', 'ซ่อม', true, 30, now, now],
    ['ACT_REPAIR_PART', 'ซ่อมชิ้นส่วน', 'ซ่อม', true, 40, now, now],
    ['ACT_RESET', 'รีเซ็ตระบบ/ตั้งค่าใหม่', 'ไฟฟ้า/ควบคุม', true, 50, now, now],
    ['ACT_MONITOR', 'เฝ้าติดตามอาการ', 'ติดตามผล', true, 60, now, now],
    ['ACT_OTHER', 'อื่น ๆ', 'อื่น ๆ', true, 999, now, now],
  ];

  sheet.getRange(2, 1, rows.length, SHEET_SCHEMAS.Action_Codebook.length).setValues(rows);
  sheet.autoResizeColumns(1, SHEET_SCHEMAS.Action_Codebook.length);
}

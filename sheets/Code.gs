// ── Confix Payment — Google Apps Script Backend ──
// วิธีใช้: เปิด Google Sheets → Extensions → Apps Script → วางโค้ดนี้ → Deploy as Web App

const SHEET_ID   = SpreadsheetApp.getActiveSpreadsheet().getId();
const SS         = SpreadsheetApp.getActiveSpreadsheet();

// ── Sheet names ──
const SH = {
  STUDENTS : 'students',
  PAYMENTS : 'payments',
  ITEMS    : 'items',
};

// ── Headers ──
const HEADERS = {
  STUDENTS : ['studentId', 'firstName', 'lastName', 'year', 'type', 'phone', 'email'],
  PAYMENTS : ['payId', 'studentId', 'firstName', 'lastName', 'year', 'itemId', 'itemName', 'amount', 'paidAt'],
  ITEMS    : ['itemId', 'name', 'amount', 'targetYears', 'deadline', 'active'],
};

// ════════════════════════════════════════════
//  INIT — สร้าง Sheet + Header ถ้ายังไม่มี
// ════════════════════════════════════════════
function initSheets() {
  Object.entries(HEADERS).forEach(([key, headers]) => {
    const name = SH[key];
    let sh = SS.getSheetByName(name);
    if (!sh) {
      sh = SS.insertSheet(name);
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4A3520')
        .setFontColor('#FAFAF8');
      sh.setFrozenRows(1);
    }
  });
  return 'Sheets initialized';
}

// ════════════════════════════════════════════
//  ROUTER — doGet / doPost
// ════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action || '';
  const p      = e.parameter;
  let result;

  try {
    switch (action) {
      case 'lookupStudent': result = lookupStudent(p.studentId);        break;
      case 'getItems':      result = getItems();                         break;
      case 'getPayments':   result = getPayments(p.studentId);          break;
      case 'getStudents':   result = getStudents();                      break;
      case 'initSheets':    result = { message: initSheets() };         break;
      default:              result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }

  return output(result);
}

function doPost(e) {
  const body   = JSON.parse(e.postData.contents);
  const action = body.action || '';
  let result;

  try {
    switch (action) {
      case 'addPayment':    result = addPayment(body.data);             break;
      case 'addItem':       result = addItem(body.data);                break;
      case 'updateItem':    result = updateItem(body.data);             break;
      case 'deleteItem':    result = deleteItem(body.itemId);           break;
      case 'addStudent':    result = addStudent(body.data);             break;
      case 'importStudents':result = importStudents(body.rows);         break;
      case 'deleteStudent': result = deleteStudent(body.studentId);     break;
      default:              result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }

  return output(result);
}

function output(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════
//  STUDENTS
// ════════════════════════════════════════════
function lookupStudent(studentId) {
  if (!studentId) return { found: false, error: 'No studentId' };
  const sh   = SS.getSheetByName(SH.STUDENTS);
  const data = sh.getDataRange().getValues();
  const hdrs = data[0];
  const idx  = hdrs.indexOf('studentId');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]).trim() === String(studentId).trim()) {
      const row = {};
      hdrs.forEach((h, j) => row[h] = data[i][j]);
      return { found: true, student: row };
    }
  }
  return { found: false };
}

function getStudents() {
  const sh   = SS.getSheetByName(SH.STUDENTS);
  const data = sh.getDataRange().getValues();
  const hdrs = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    hdrs.forEach((h, j) => obj[h] = row[j]);
    return obj;
  });
}

function addStudent(data) {
  // ตรวจ duplicate
  const check = lookupStudent(data.studentId);
  if (check.found) return { success: false, error: 'รหัสนักศึกษานี้มีอยู่แล้ว' };

  const sh  = SS.getSheetByName(SH.STUDENTS);
  const row = HEADERS.STUDENTS.map(h => data[h] || '');
  sh.appendRow(row);
  return { success: true };
}

function importStudents(rows) {
  const sh      = SS.getSheetByName(SH.STUDENTS);
  let added = 0, skipped = 0;
  rows.forEach(data => {
    const check = lookupStudent(data.studentId);
    if (check.found) { skipped++; return; }
    sh.appendRow(HEADERS.STUDENTS.map(h => data[h] || ''));
    added++;
  });
  return { success: true, added, skipped };
}

function deleteStudent(studentId) {
  const sh   = SS.getSheetByName(SH.STUDENTS);
  const data = sh.getDataRange().getValues();
  const idx  = data[0].indexOf('studentId');
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx]).trim() === String(studentId).trim()) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Not found' };
}

// ════════════════════════════════════════════
//  ITEMS
// ════════════════════════════════════════════
function getItems() {
  const sh   = SS.getSheetByName(SH.ITEMS);
  const data = sh.getDataRange().getValues();
  const hdrs = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    hdrs.forEach((h, j) => obj[h] = row[j]);
    // targetYears เก็บเป็น string "1,2,3" → แปลงเป็น array
    obj.targetYears = String(obj.targetYears).split(',').map(s => s.trim()).filter(Boolean);
    obj.active = obj.active === true || obj.active === 'TRUE' || obj.active === 'true';
    obj.amount = Number(obj.amount);
    return obj;
  });
}

function addItem(data) {
  const sh  = SS.getSheetByName(SH.ITEMS);
  data.itemId = 'item_' + Date.now();
  // targetYears array → string
  const row = [
    data.itemId, data.name, data.amount,
    Array.isArray(data.targetYears) ? data.targetYears.join(',') : data.targetYears,
    data.deadline || '', data.active !== false,
  ];
  sh.appendRow(row);
  return { success: true, itemId: data.itemId };
}

function updateItem(data) {
  const sh   = SS.getSheetByName(SH.ITEMS);
  const rows = sh.getDataRange().getValues();
  const hdrs = rows[0];
  const idx  = hdrs.indexOf('itemId');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idx] === data.itemId) {
      const updated = hdrs.map(h => {
        if (h === 'targetYears') return Array.isArray(data[h]) ? data[h].join(',') : (data[h] || rows[i][hdrs.indexOf(h)]);
        return data[h] !== undefined ? data[h] : rows[i][hdrs.indexOf(h)];
      });
      sh.getRange(i + 1, 1, 1, hdrs.length).setValues([updated]);
      return { success: true };
    }
  }
  return { success: false, error: 'Item not found' };
}

function deleteItem(itemId) {
  const sh   = SS.getSheetByName(SH.ITEMS);
  const data = sh.getDataRange().getValues();
  const idx  = data[0].indexOf('itemId');
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idx] === itemId) { sh.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false, error: 'Not found' };
}

// ════════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════════
function getPayments(studentId) {
  const sh   = SS.getSheetByName(SH.PAYMENTS);
  const data = sh.getDataRange().getValues();
  const hdrs = data[0];
  let rows   = data.slice(1).map(row => {
    const obj = {};
    hdrs.forEach((h, j) => obj[h] = row[j]);
    obj.amount = Number(obj.amount);
    return obj;
  });
  if (studentId) rows = rows.filter(r => String(r.studentId) === String(studentId));
  return rows;
}

function addPayment(data) {
  const sh  = SS.getSheetByName(SH.PAYMENTS);
  data.payId  = 'pay_' + Date.now();
  data.paidAt = new Date().toISOString();
  const row = HEADERS.PAYMENTS.map(h => data[h] || '');
  sh.appendRow(row);
  return { success: true, payId: data.payId };
}
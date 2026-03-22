// ── expenses.js — ระบบรายจ่าย + ใบเบิกเงิน ──

const Expenses = {
  get SUPA_URL() { return API.URL; },
  get SUPA_KEY() { return API.KEY; },
  _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },


  get _h() {
    return {
      'apikey': this.SUPA_KEY,
      'Authorization': `Bearer ${this.SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  },

  // ════════════════════════════════
  //  API
  // ════════════════════════════════
  async getAll(month = '') {
    let qs = 'select=*&order=date.desc';
    if (month) qs += `&date=like.${month}%`;
    const res = await fetch(`${this.SUPA_URL}/rest/v1/expenses?${qs}`, { headers: this._h });
    return res.json();
  },

  async create(data) {
    const expenseId = 'EXP-' + Date.now();
    const res = await fetch(`${this.SUPA_URL}/rest/v1/expenses`, {
      method: 'POST', headers: this._h,
      body: JSON.stringify({ ...data, expense_id: expenseId }),
    });
    const result = await res.json();
    const admin  = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    await AdminKeys.log(admin.label, 'เพิ่มรายจ่าย', `${data.description} ฿${Number(data.amount).toLocaleString()}`);
    return result;
  },

  async remove(expenseId) {
    await fetch(`${this.SUPA_URL}/rest/v1/expenses?expense_id=eq.${expenseId}`, {
      method: 'DELETE', headers: this._h,
    });
    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    await AdminKeys.log(admin.label, 'ลบรายจ่าย', `expense: ${expenseId}`);
  },

  // ════════════════════════════════
  //  UI
  // ════════════════════════════════
  async loadView() {
    const month = document.getElementById('filter-expense-month')?.value || '';
    const rows  = await this.getAll(month);
    this._renderTable(rows);
    this._renderSummary(rows);
  },

  _renderTable(rows) {
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    document.getElementById('expense-total').textContent = `฿${total.toLocaleString()}`;
    document.getElementById('expense-count').textContent = rows.length;

    document.getElementById('expenses-tbody').innerHTML = rows.length
      ? rows.map(r => `
          <tr>
            <td style="font-size:.82rem;color:var(--gray-mid)">${this._esc(r.expense_id)}<br>${this._date(r.date)}</td>
            <td><strong>${this._esc(r.recipient)}</strong></td>
            <td>${this._esc(r.description)}<br><span class="badge badge-year" style="font-size:.72rem">${this._esc(r.category)}</span></td>
            <td class="amount-cell">฿${Number(r.amount).toLocaleString()}</td>
            <td style="font-size:.82rem">${this._esc(r.approved_by) || '—'}</td>
            <td>
              <button class="btn-sm" onclick="Expenses.printSlip('${this._esc(r.expense_id)}')" title="พิมพ์ใบเบิก">
                <i class="fi fi-rr-print"></i>
              </button>
              <button class="btn-sm btn-del" onclick="Expenses.confirmDelete('${this._esc(r.expense_id)}')" title="ลบ">
                <i class="fi fi-rr-trash"></i>
              </button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty-td">ยังไม่มีรายจ่าย</td></tr>';
  },

  _renderSummary(rows) {
    const byCategory = {};
    rows.forEach(r => {
      byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount);
    });
    document.getElementById('expense-by-category').innerHTML = Object.entries(byCategory).length
      ? Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => `
          <div class="year-row">
            <span>${cat}</span>
            <strong>฿${amt.toLocaleString()}</strong>
          </div>`).join('')
      : '<p class="muted">ยังไม่มีข้อมูล</p>';
  },

  // ── Modal เพิ่มรายจ่าย ──
  openAddModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exp-date').value        = today;
    document.getElementById('exp-recipient').value   = '';
    document.getElementById('exp-category').value    = 'ค่าวัสดุ/อุปกรณ์';
    document.getElementById('exp-description').value = '';
    document.getElementById('exp-amount').value      = '';
    document.getElementById('exp-approved').value    = '';
    document.getElementById('exp-note').value        = '';
    document.getElementById('modal-expense').classList.add('open');
  },

  async saveExpense() {
    const data = {
      date:        document.getElementById('exp-date').value,
      recipient:   document.getElementById('exp-recipient').value.trim(),
      category:    document.getElementById('exp-category').value,
      description: document.getElementById('exp-description').value.trim(),
      amount:      parseFloat(document.getElementById('exp-amount').value),
      approved_by: document.getElementById('exp-approved').value.trim(),
      note:        document.getElementById('exp-note').value.trim(),
      created_by:  JSON.parse(sessionStorage.getItem('cfx_admin') || '{}').label || '',
    };

    if (!data.date || !data.recipient || !data.description || !data.amount) {
      alert('กรุณากรอกข้อมูลให้ครบ'); return;
    }

    const btn = document.getElementById('btn-save-expense');
    btn.disabled = true;
    try {
      await this.create(data);
      this.closeModal('modal-expense');
      this.loadView();
    } catch(e) { alert('บันทึกไม่สำเร็จ: ' + e.message); }
    finally { btn.disabled = false; }
  },

  async confirmDelete(expenseId) {
    if (!confirm(`ลบรายจ่าย ${expenseId}?`)) return;
    await this.remove(expenseId);
    this.loadView();
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ════════════════════════════════
  //  พิมพ์ใบเบิกเงิน (PDF via Print)
  // ════════════════════════════════
  async printSlip(expenseId) {
    const rows = await this.getAll();
    const r    = rows.find(x => x.expense_id === expenseId);
    if (!r) return;

    const win = window.open('', '_blank', 'width=794,height=1123');
    win.document.write(this._slipHTML(r));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  },

  async printSummary() {
    const month = document.getElementById('filter-expense-month')?.value || '';
    const rows  = await this.getAll(month);
    if (!rows.length) { alert('ไม่มีรายจ่ายในช่วงเวลานี้'); return; }

    const win = window.open('', '_blank', 'width=794,height=1123');
    win.document.write(this._monthlyHTML(rows, month));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  },

  // ── Template ใบเบิกเงิน ──
  _slipHTML(r) {
    const amt    = Number(r.amount);
    const amtTxt = this._bahtText(amt);
    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>ใบเบิกเงิน ${this._esc(r.expense_id)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 14px; color: #000; background: #fff; padding: 40px; }
  .doc { max-width: 720px; margin: 0 auto; border: 2px solid #000; padding: 32px; }
  .title { text-align: center; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 14px; margin-bottom: 24px; }
  .header-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .field { margin-bottom: 14px; display: flex; align-items: baseline; gap: 8px; }
  .field label { min-width: 120px; font-weight: 600; flex-shrink: 0; }
  .field .line { flex: 1; border-bottom: 1px dotted #000; min-width: 60px; padding-bottom: 2px; }
  .amount-box { border: 2px solid #000; padding: 12px 20px; text-align: center; margin: 20px 0; font-size: 18px; font-weight: 700; }
  .amount-text { text-align: center; font-size: 13px; margin-bottom: 20px; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1px solid #000; margin: 40px 20px 8px; }
  .sign-label { font-size: 12px; }
  .note-box { border: 1px solid #999; padding: 10px; margin-top: 20px; min-height: 60px; font-size: 12px; color: #555; }
  @media print { body { padding: 0; } .doc { border: none; } @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
<div class="doc">
  <div class="title">ใบเบิกเงิน / ใบสำคัญรับเงิน</div>
  <div class="subtitle">Confix Payment System</div>
  <hr style="margin-bottom:20px">

  <div class="header-row">
    <div class="field"><label>เลขที่:</label><div class="line">${this._esc(r.expense_id)}</div></div>
    <div class="field"><label>วันที่:</label><div class="line">${this._dateTH(r.date)}</div></div>
  </div>

  <div class="field"><label>ผู้รับเงิน:</label><div class="line">${this._esc(r.recipient)}</div></div>
  <div class="field"><label>หมวดหมู่:</label><div class="line">${this._esc(r.category)}</div></div>
  <div class="field"><label>วัตถุประสงค์:</label><div class="line">${this._esc(r.description)}</div></div>

  <div class="amount-box">จำนวนเงิน: ฿${amt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
  <div class="amount-text">(${amtTxt})</div>

  <div class="field"><label>หมายเหตุ:</label><div class="line">${r.note || '—'}</div></div>

  <div class="sign-row">
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">ผู้รับเงิน</div>
      <div class="sign-label">(${this._esc(r.recipient)})</div>
    </div>
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">ผู้อนุมัติ</div>
      <div class="sign-label">(${r.approved_by || '...................................'})</div>
    </div>
  </div>

  <div class="note-box" style="margin-top:24px">
    <strong>สำหรับเจ้าหน้าที่การเงิน:</strong><br>
    บันทึกเมื่อ: ${new Date(r.created_at).toLocaleString('th-TH')} | โดย: ${r.created_by || '—'}
  </div>
</div>
</body></html>`;
  },

  // ── Template สรุปรายจ่าย (ปรับปรุงใหม่) ──
  _monthlyHTML(rows, month) {
    const total  = rows.reduce((s, r) => s + Number(r.amount), 0);
    const title  = month ? `ประจำเดือน ${this._monthLabel(month)}` : 'ทั้งหมด';
    const cats   = rows.reduce((a, r) => { a[r.category] = (a[r.category]||0)+Number(r.amount); return a; }, {});
    const catHTML = Object.entries(cats).map(([k,v]) =>
      `<div class="cat-item"><span>${k}</span><strong>฿${v.toLocaleString('th-TH',{minimumFractionDigits:2})}</strong></div>`
    ).join('');

    const rowsHTML = rows.map((r, i) => `
      <tr class="${i%2===1?'even':''}">
        <td class="center">${i+1}</td>
        <td class="mono">${this._esc(r.expense_id)}</td>
        <td class="center">${this._date(r.date)}</td>
        <td><strong>${this._esc(r.recipient)}</strong></td>
        <td><span class="badge">${this._esc(r.category)}</span></td>
        <td>${this._esc(r.description)}</td>
        <td class="right amount">฿${Number(r.amount).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
        <td class="center">${this._esc(r.approved_by)||'—'}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>สรุปรายจ่าย ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
  .page { padding: 20mm 18mm; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #4A3520; }
  .logo-area h1 { font-size: 22px; font-weight: 700; color: #4A3520; margin-bottom: 2px; }
  .logo-area p  { font-size: 12px; color: #888; }
  .doc-info     { text-align: right; }
  .doc-info .doc-title { font-size: 18px; font-weight: 700; color: #4A3520; }
  .doc-info .doc-sub   { font-size: 11px; color: #888; margin-top: 4px; }

  /* ── Summary Cards ── */
  .summary-bar { display: grid; grid-template-columns: auto 1fr; gap: 16px; margin-bottom: 20px; }
  .total-card  { background: #4A3520; color: #fff; border-radius: 10px; padding: 14px 24px; text-align: center; min-width: 180px; }
  .total-card .label  { font-size: 11px; opacity: .8; margin-bottom: 4px; }
  .total-card .amount { font-size: 24px; font-weight: 700; }
  .total-card .count  { font-size: 11px; opacity: .7; margin-top: 2px; }
  .cat-grid    { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
  .cat-item    { background: #FFF8EC; border: 1px solid #E8C86A; border-radius: 6px; padding: 6px 12px; display: flex; gap: 10px; align-items: center; font-size: 12px; }
  .cat-item strong { color: #4A3520; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  thead tr { background: #4A3520; }
  thead th { color: #fff; padding: 9px 10px; text-align: left; font-weight: 600; font-size: 11px; letter-spacing: .3px; }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }
  tbody tr.even td { background: #FAFAF8; }
  tbody tr:hover td { background: #FFF8EC; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: middle; }
  td.center { text-align: center; }
  td.right   { text-align: right; }
  td.amount  { font-weight: 600; color: #4A3520; }
  td.mono    { font-size: 11px; color: #888; }
  .badge { background: #EEE8E0; color: #4A3520; padding: 2px 8px; border-radius: 20px; font-size: 11px; white-space: nowrap; }
  .total-row td { font-weight: 700; background: #FFF8EC !important; border-top: 2px solid #4A3520; font-size: 13px; }

  /* ── Signatures ── */
  .sign-section { margin-top: 40px; }
  .sign-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 40px; }
  .sign-box { text-align: center; }
  .sign-line { border-top: 1.5px solid #333; margin: 48px 16px 8px; }
  .sign-name { font-size: 12px; font-weight: 600; }
  .sign-title { font-size: 11px; color: #888; margin-top: 2px; }

  /* ── Footer ── */
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }

  @media print {
    .page { padding: 10mm 12mm; }
    @page { size: A4 landscape; margin: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <h1>ConfixPay</h1>
      <p>ระบบบริหารจัดการค่าใช้จ่าย</p>
    </div>
    <div class="doc-info">
      <div class="doc-title">สรุปรายจ่าย ${title}</div>
      <div class="doc-sub">พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary-bar">
    <div class="total-card">
      <div class="label">ยอดรายจ่ายรวม</div>
      <div class="amount">฿${total.toLocaleString('th-TH',{minimumFractionDigits:2})}</div>
      <div class="count">${rows.length} รายการ</div>
    </div>
    <div class="cat-grid">${catHTML}</div>
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th class="center" style="width:4%">#</th>
        <th style="width:14%">เลขที่</th>
        <th class="center" style="width:10%">วันที่</th>
        <th style="width:14%">ผู้รับเงิน</th>
        <th style="width:12%">หมวดหมู่</th>
        <th>รายการ / วัตถุประสงค์</th>
        <th class="right" style="width:11%">จำนวนเงิน</th>
        <th class="center" style="width:11%">ผู้อนุมัติ</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
      <tr class="total-row">
        <td colspan="6" style="text-align:right;padding-right:16px">รวมทั้งสิ้น</td>
        <td class="right">฿${total.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <!-- Signatures -->
  <div class="sign-section">
    <div class="sign-row">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">ผู้จัดทำ</div>
        <div class="sign-title">( .................................................. )</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">ผู้ตรวจสอบ</div>
        <div class="sign-title">( .................................................. )</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">ผู้อนุมัติ</div>
        <div class="sign-title">( .................................................. )</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>ConfixPay — ระบบบริหารจัดการค่าใช้จ่าย</span>
    <span>พิมพ์ ${rows.length} รายการ · ยอดรวม ฿${total.toLocaleString('th-TH',{minimumFractionDigits:2})}</span>
  </div>

</div>
</body></html>`;
  },

  // ── Helpers ──
  _date(str)    { return str ? new Date(str).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : '—'; },
  _dateTH(str)  {
    if (!str) return '—';
    const d = new Date(str);
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
  },
  _monthLabel(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${months[+m]} ${+y+543}`;
  },
  _bahtText(amount) {
    const ones  = ['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const tens  = ['','สิบ','ยี่สิบ','สามสิบ','สี่สิบ','ห้าสิบ','หกสิบ','เจ็ดสิบ','แปดสิบ','เก้าสิบ'];
    const units = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
    if (!amount) return 'ศูนย์บาทถ้วน';
    let n    = Math.round(amount * 100);
    const s  = n % 100 > 0 ? `${ones[Math.floor(n/10)%10]}สิบ${ones[n%10]}สตางค์` : 'ถ้วน';
    n = Math.floor(n / 100);
    if (!n) return 'ศูนย์บาท' + s;
    let baht = '', i = 0;
    while (n > 0) {
      const d = n % 10;
      if (d) baht = (i === 0 && d === 1 && i < 2 ? 'หนึ่ง' : ones[d]) + units[i] + baht;
      n = Math.floor(n / 10); i++;
    }
    return baht + 'บาท' + s;
  },
};
// ── admin.js — Admin Panel Logic ──

const Admin = {
  // ── Navigation ──
  showView(id) {
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + id)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-view="${id}"]`)?.classList.add('active');
    document.getElementById('page-title').textContent =
      { dashboard: 'ภาพรวม', payments: 'รายการชำระเงิน', items: 'จัดการรายการ', students: 'จัดการนักศึกษา', keys: 'จัดการ Key', expenses: 'รายจ่าย / ใบเบิกเงิน' }[id] || '';
    const fn = { dashboard: '_loadDashboard', payments: '_loadPayments', items: '_loadItems', students: '_loadStudents' }[id];
    if (fn) this[fn]();
    if (id === 'keys')     { AdminKeys.loadView(); AdminKeys.populateLogFilter(); }
    if (id === 'expenses') { Expenses.loadView(); }
  },

  // ── Dashboard ──
  async _loadDashboard() {
    this._loading('recent-payments'); this._loading('year-breakdown');
    try {
      const [payments, items] = await Promise.all([ API.getPayments(), API.getItems() ]);
      document.getElementById('stat-total').textContent  = payments.length;
      document.getElementById('stat-amount').textContent = '฿' + payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString();
      document.getElementById('stat-items').textContent  = items.filter(i => i.active).length;

      const byYear = payments.reduce((a, p) => { a[p.year] = (a[p.year]||0)+1; return a; }, {});
      document.getElementById('year-breakdown').innerHTML = Object.keys(byYear).length
        ? Object.entries(byYear).sort().map(([yr, n]) =>
            `<div class="year-row"><span>${DB.yearLabel(yr)}</span><strong>${n} รายการ</strong></div>`
          ).join('')
        : '<p class="muted">ยังไม่มีข้อมูล</p>';

      document.getElementById('recent-payments').innerHTML =
        [...payments].reverse().slice(0, 5).map(p =>
          `<tr>
            <td>${p.firstName} ${p.lastName}</td>
            <td><span class="badge badge-year">${DB.yearLabel(p.year)}</span></td>
            <td>${p.itemName}</td>
            <td class="amount-cell">฿${Number(p.amount).toLocaleString()}</td>
            <td>${this._date(p.paidAt)}</td>
          </tr>`
        ).join('') || '<tr><td colspan="5" class="empty-td">ยังไม่มีรายการ</td></tr>';
    } catch(e) { this._error('recent-payments', 5); this._error('year-breakdown'); }
  },

  // ── Payments ──
  async _loadPayments(year='', itemId='', search='') {
    this._loading('payments-tbody', 7);
    try {
      let rows = await API.getPayments();
      const q  = search.toLowerCase();
      rows = rows.filter(p =>
        (!year   || p.year === year) &&
        (!itemId || p.itemId === itemId) &&
        (!q      || `${p.firstName} ${p.lastName} ${p.studentId}`.toLowerCase().includes(q))
      ).reverse();

      document.getElementById('payments-count').textContent = `${rows.length} รายการ`;
      document.getElementById('payments-tbody').innerHTML = rows.length
        ? rows.map(p => `<tr>
            <td>${p.studentId||'—'}</td>
            <td>${p.firstName} ${p.lastName}</td>
            <td><span class="badge badge-year">${DB.yearLabel(p.year)}</span></td>
            <td>${p.itemName}</td>
            <td class="amount-cell">฿${Number(p.amount).toLocaleString()}</td>
            <td>${this._date(p.paidAt)}</td>
            <td><span class="badge badge-paid"><i class="fi fi-rr-check-circle"></i> ชำระแล้ว</span></td>
          </tr>`).join('')
        : '<tr><td colspan="7" class="empty-td">ไม่พบรายการ</td></tr>';
    } catch(e) { this._error('payments-tbody', 7); }
  },

  filterPayments() {
    this._loadPayments(
      document.getElementById('filter-year').value,
      document.getElementById('filter-item').value,
      document.getElementById('search-payments').value
    );
  },

  // ── Items ──
  async _loadItems() {
    this._loading('items-tbody', 6);
    try {
      const items = await API.getItems();
      document.getElementById('items-tbody').innerHTML = items.length
        ? items.map(i => `<tr>
            <td><strong>${i.name}</strong></td>
            <td class="amount-cell">฿${Number(i.amount).toLocaleString()}</td>
            <td>${i.targetYears.map(y => `<span class="badge badge-year">${DB.yearLabel(y)}</span>`).join(' ')}</td>
            <td>${i.deadline ? this._date(i.deadline) : '—'}</td>
            <td><span class="badge ${i.active ? 'badge-paid' : 'badge-pending'}">${i.active ? 'เปิด' : 'ปิด'}</span></td>
            <td>
              <button class="btn-sm" onclick="Admin.openItemModal('${i.itemId}')"><i class="fi fi-rr-edit"></i></button>
              <button class="btn-sm btn-del" onclick="Admin.deleteItem('${i.itemId}')"><i class="fi fi-rr-trash"></i></button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="6" class="empty-td">ยังไม่มีรายการ</td></tr>';
    } catch(e) { this._error('items-tbody', 6); }
  },

  // ── Students ──
  async _loadStudents(search='') {
    this._loading('students-tbody', 5);
    try {
      let students = await API.getStudents();
      const q = search.toLowerCase();
      if (q) students = students.filter(s =>
        `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(q)
      );
      document.getElementById('students-count').textContent = `${students.length} คน`;
      document.getElementById('students-tbody').innerHTML = students.length
        ? students.map(s => `<tr>
            <td>${s.studentId}</td>
            <td>${s.firstName} ${s.lastName}</td>
            <td><span class="badge badge-year">${DB.yearLabel(s.year + (s.type==='เทียบโอน'?'t':''))}</span></td>
            <td>${s.phone||'—'}</td>
            <td>
              <button class="btn-sm btn-del" onclick="Admin.deleteStudent('${s.studentId}')"><i class="fi fi-rr-trash"></i></button>
            </td>
          </tr>`).join('')
        : '<tr><td colspan="5" class="empty-td">ไม่พบข้อมูล</td></tr>';
    } catch(e) { this._error('students-tbody', 5); }
  },

  filterStudents() { this._loadStudents(document.getElementById('search-students').value); },

  // ── Student Modal ──
  openStudentModal() {
    document.getElementById('s-id').value        = '';
    document.getElementById('s-firstname').value = '';
    document.getElementById('s-lastname').value  = '';
    document.getElementById('s-year').value      = '1';
    document.getElementById('s-type').value      = 'ปกติ';
    document.getElementById('s-phone').value     = '';
    document.getElementById('modal-student').classList.add('open');
  },

  async saveStudent() {
    const data = {
      studentId: document.getElementById('s-id').value.trim(),
      firstName: document.getElementById('s-firstname').value.trim(),
      lastName:  document.getElementById('s-lastname').value.trim(),
      year:      document.getElementById('s-year').value,
      type:      document.getElementById('s-type').value,
      phone:     document.getElementById('s-phone').value.trim(),
      email:     '',
    };
    if (!data.studentId || !data.firstName || !data.lastName) { alert('กรุณากรอกข้อมูลให้ครบ'); return; }

    const btn = document.getElementById('btn-save-student');
    btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-refresh"></i> กำลังบันทึก...';
    try {

      const res = await API.addStudent(data);
      if (!res.success) { alert(res.error || 'บันทึกไม่สำเร็จ'); return; }
      this.closeModal('modal-student');
      this._loadStudents();
    } catch(e) {
      if (e.message === 'Unauthorized') { alert('Session หมดอายุ กรุณา login ใหม่'); adminLogout(); return; }
      alert('เกิดข้อผิดพลาด');
    } finally { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-disk"></i> บันทึก'; }
  },

  async deleteStudent(studentId) {
    if (!confirm(`ลบรหัส ${studentId} ออกจากระบบ?`)) return;
    try {
      const res = await API.deleteStudent(studentId);
      if (!res.success) { alert(res.error || 'ลบไม่สำเร็จ'); return; }
      this._loadStudents();
    } catch(e) {
      if (e.message === 'Unauthorized') { alert('Session หมดอายุ กรุณา login ใหม่'); adminLogout(); return; }
      alert('ลบไม่สำเร็จ');
    }
  },

  // ── Import CSV ──
  triggerImport() { document.getElementById('csv-file').click(); },

  async handleImport(input) {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
      const obj = {};
      headers.forEach((h,i) => obj[h] = vals[i]||'');
      return obj;
    }).filter(r => r.studentId);

    if (!rows.length) { alert('ไม่พบข้อมูลใน CSV'); return; }

    const btn = document.getElementById('btn-import');
    btn.disabled = true; btn.innerHTML = '<i class="fi fi-rr-refresh"></i> กำลังนำเข้า...';
    try {
      const res = await API.importStudents(rows);
      alert(`นำเข้าสำเร็จ: ${res.added} คน${res.skipped ? ` (ข้าม ${res.skipped} รายการที่ซ้ำ)` : ''}`);
      this._loadStudents();
    } catch(e) {
      if (e.message === 'Unauthorized') { alert('Session หมดอายุ กรุณา login ใหม่'); adminLogout(); return; }
      alert('นำเข้าไม่สำเร็จ');
    } finally { btn.disabled = false; btn.innerHTML = '<i class="fi fi-rr-file-upload"></i> Import CSV'; input.value=''; }
  },

  // ── Item Modal ──
  _editingItemId: null,

  async openItemModal(id=null) {
    this._editingItemId = id;
    if (id) {
      const items = await API.getItems();
      const item  = items.find(i => i.itemId === id);
      if (!item) return;
      document.getElementById('modal-item-title').innerHTML = '<i class="fi fi-rr-edit"></i> แก้ไขรายการ';
      document.getElementById('item-name').value     = item.name;
      document.getElementById('item-amount').value   = item.amount;
      document.getElementById('item-deadline').value = item.deadline || '';
      document.getElementById('item-active').value   = String(item.active);
      document.querySelectorAll('.year-check').forEach(cb => cb.checked = item.targetYears.includes(cb.value));
    } else {
      document.getElementById('modal-item-title').innerHTML = '<i class="fi fi-rr-file-add"></i> เพิ่มรายการชำระเงิน';
      document.getElementById('item-name').value     = '';
      document.getElementById('item-amount').value   = '';
      document.getElementById('item-deadline').value = '';
      document.getElementById('item-active').value   = 'true';
      document.querySelectorAll('.year-check').forEach(cb => cb.checked = false);
    }
    document.getElementById('modal-item').classList.add('open');
  },

  async saveItem() {
    const data = {
      name:        document.getElementById('item-name').value.trim(),
      amount:      parseInt(document.getElementById('item-amount').value),
      deadline:    document.getElementById('item-deadline').value,
      active:      document.getElementById('item-active').value === 'true',
      targetYears: [...document.querySelectorAll('.year-check:checked')].map(cb => cb.value),
    };
    if (!data.name || !data.amount || !data.targetYears.length) {
      alert('กรุณากรอกข้อมูลให้ครบ และเลือกปีอย่างน้อย 1 ปี'); return;
    }
    const btn = document.getElementById('btn-save-item');
    btn.disabled = true;
    try {
      if (this._editingItemId) {
        await API.updateItem({ ...data, itemId: this._editingItemId });
      } else {
        await API.addItem(data);
      }
      this.closeModal('modal-item');
      this._loadItems();
    } catch(e) {
      if (e.message === 'Unauthorized') { alert('Session หมดอายุ กรุณา login ใหม่'); adminLogout(); return; }
      alert('บันทึกไม่สำเร็จ');
    } finally { btn.disabled = false; }
  },

  async deleteItem(id) {
    if (!confirm('ยืนยันการลบรายการนี้?')) return;
    try {
      await API.deleteItem(id);
      this._loadItems();
    } catch(e) {
      if (e.message === 'Unauthorized') { alert('Session หมดอายุ กรุณา login ใหม่'); adminLogout(); return; }
      alert('ลบไม่สำเร็จ');
    }
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── Export CSV ──
  async exportCSV() {
    const payments = await API.getPayments();
    const csv = '\ufeff' + 'รหัสนักศึกษา,ชื่อ,นามสกุล,ปี,รายการ,จำนวน,วันที่\n' +
      payments.map(p => `${p.studentId},${p.firstName},${p.lastName},${DB.yearLabel(p.year)},${p.itemName},${p.amount},${this._date(p.paidAt)}`).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: 'confix-payments.csv',
    });
    a.click();
  },

  // ── UI Helpers ──
  _loading(tbodyId, cols=1) {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${cols}" class="empty-td"><i class="fi fi-rr-refresh spin"></i> กำลังโหลด...</td></tr>`;
  },
  _error(tbodyId, cols=1) {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${cols}" class="empty-td muted"><i class="fi fi-rr-cross-circle"></i> โหลดไม่สำเร็จ</td></tr>`;
  },
  _date(str) { return str ? new Date(str).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : '—'; },

  async _populateItemFilter() {
    try {
      const items = await API.getItems();
      document.getElementById('filter-item').innerHTML =
        '<option value="">ทุกรายการ</option>' +
        items.map(i => `<option value="${i.itemId}">${i.name}</option>`).join('');
    } catch(e) {}
  },

  init() {
    // แสดงเมนูตามสิทธิ์
    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    if (admin.canKeys) document.getElementById('nav-keys').style.display = '';
    if (!admin.canStudents) document.querySelector('[data-view="students"]')?.style.setProperty('display','none');
    if (!admin.canItems)    document.querySelector('[data-view="items"]')?.style.setProperty('display','none');
    if (!admin.canPayments) document.querySelector('[data-view="payments"]')?.style.setProperty('display','none');

    this._populateItemFilter();
    this.showView('dashboard');
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
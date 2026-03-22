// ── admin-keys.js — Key Management + Activity Log ──

const AdminKeys = {
  get SUPA_URL() { return API.URL; },
  get SUPA_KEY() { return API.KEY; },

  get _h() {
    return { 'apikey': this.SUPA_KEY, 'Authorization': `Bearer ${this.SUPA_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
  },

  async sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },

  // ── Keys ──
  async getKeys() {
    const res = await fetch(`${this.SUPA_URL}/rest/v1/admin_keys?select=*&order=created_at.asc`, { headers: this._h });
    return res.json();
  },

  async createKey(label, key, perms, createdBy) {
    const hash  = await this.sha256(key);
    const keyId = 'key_' + Date.now();
    const res   = await fetch(`${this.SUPA_URL}/rest/v1/admin_keys`, {
      method: 'POST', headers: this._h,
      body: JSON.stringify({
        key_id: keyId, label, key_hash: hash,
        role: 'admin',
        can_students: perms.students,
        can_items:    perms.items,
        can_payments: perms.payments,
        can_keys:     false,
        active:       true,
        created_by:   createdBy,
      }),
    });
    const data = await res.json();
    await this.log(createdBy, 'สร้าง key', `สร้าง key "${label}" (${keyId})`);
    return data;
  },

  async toggleKey(keyId, active, byLabel) {
    await fetch(`${this.SUPA_URL}/rest/v1/admin_keys?key_id=eq.${keyId}`, {
      method: 'PATCH', headers: this._h, body: JSON.stringify({ active }),
    });
    await this.log(byLabel, active ? 'เปิดใช้ key' : 'ระงับ key', `key: ${keyId}`);
  },

  async deleteKey(keyId, byLabel) {
    await fetch(`${this.SUPA_URL}/rest/v1/admin_keys?key_id=eq.${keyId}`, {
      method: 'DELETE', headers: this._h,
    });
    await this.log(byLabel, 'ลบ key', `ลบ key: ${keyId}`);
  },

  async updatePerms(keyId, perms, byLabel) {
    await fetch(`${this.SUPA_URL}/rest/v1/admin_keys?key_id=eq.${keyId}`, {
      method: 'PATCH', headers: this._h,
      body: JSON.stringify({
        can_students: perms.students,
        can_items:    perms.items,
        can_payments: perms.payments,
      }),
    });
    await this.log(byLabel, 'แก้ไขสิทธิ์', `key: ${keyId}`);
  },

  // ── Logs ──
  async getLogs(keyId = '') {
    const filter = keyId ? `key_id=eq.${keyId}&` : '';
    const res = await fetch(
      `${this.SUPA_URL}/rest/v1/admin_logs?${filter}select=*&order=created_at.desc&limit=200`,
      { headers: this._h }
    );
    return res.json();
  },

  async log(label, action, detail = '') {
    const s = sessionStorage.getItem('cfx_admin');
    const admin = s ? JSON.parse(s) : { keyId: 'system', label: label || 'system' };
    await fetch(`${this.SUPA_URL}/rest/v1/admin_logs`, {
      method: 'POST',
      headers: { ...this._h, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ key_id: admin.keyId, label: admin.label, action, detail }),
    });
  },

  // ════════════════════════════════
  //  UI — หน้า Key Management
  // ════════════════════════════════
  _newKey: '',

  async loadView() {
    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    if (!admin.canKeys) {
      document.getElementById('view-keys').innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--gray-mid)"><i class="fi fi-rr-lock" style="font-size:2rem"></i><p style="margin-top:12px">คุณไม่มีสิทธิ์จัดการ Key</p></div>';
      return;
    }

    const [keys, logs] = await Promise.all([ this.getKeys(), this.getLogs() ]);
    this._renderKeys(keys, admin);
    this._renderLogs(logs);
  },

  _renderKeys(keys, admin) {
    document.getElementById('keys-tbody').innerHTML = keys.map(k => `
      <tr>
        <td>
          <strong>${k.label}</strong>
          ${k.role === 'superadmin' ? '<span class="badge" style="background:#4A3520;color:#C8A97A;margin-left:6px">Super</span>' : ''}
          <div style="font-size:.75rem;color:var(--gray-mid);margin-top:2px">${k.key_id}</div>
        </td>
        <td>
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/uicons-solid-rounded/css/uicons-solid-rounded.css">
          <span style="font-size:.8rem">
            ${k.can_students ? '<i class="fi fi-sr-user"></i> นักศึกษา ' : ''}
            ${k.can_items    ? '<i class="fi fi-sr-list"></i> รายการ ' : ''}
            ${k.can_payments ? '<i class="fi fi-sr-credit-card"></i> ชำระเงิน' : ''}
          </span>
        </td>
        <td><span class="badge ${k.active ? 'badge-paid' : 'badge-pending'}">${k.active ? 'ใช้งาน' : 'ระงับ'}</span></td>
        <td style="font-size:.82rem;color:var(--gray-mid)">${this._date(k.created_at)}<br><span style="font-size:.75rem">โดย: ${k.created_by}</span></td>
        <td>
          ${k.role !== 'superadmin' ? `
            <button class="btn-sm" onclick="AdminKeys.openEditModal('${k.key_id}','${k.label}',${k.can_students},${k.can_items},${k.can_payments})" style="margin-right:4px"><i class="fi fi-rr-edit"></i></button>
            <button class="btn-sm" onclick="AdminKeys.toggleActive('${k.key_id}',${!k.active})" style="margin-right:4px">
              <i class="fi fi-rr-${k.active ? 'ban' : 'check'}"></i>
            </button>
            <button class="btn-sm btn-del" onclick="AdminKeys.confirmDelete('${k.key_id}','${k.label}')"><i class="fi fi-rr-trash"></i></button>
          ` : '<span style="font-size:.75rem;color:var(--gray-mid)">—</span>'}
        </td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty-td">ยังไม่มี key</td></tr>';
  },

  _renderLogs(logs, filterKeyId = '') {
    const rows = filterKeyId ? logs.filter(l => l.key_id === filterKeyId) : logs;
    document.getElementById('logs-tbody').innerHTML = rows.map(l => `
      <tr>
        <td style="font-size:.82rem;color:var(--gray-mid)">${this._dateTime(l.created_at)}</td>
        <td><strong>${l.label}</strong><div style="font-size:.75rem;color:var(--gray-mid)">${l.key_id}</div></td>
        <td><span class="badge badge-year">${l.action}</span></td>
        <td style="font-size:.85rem">${l.detail || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty-td">ยังไม่มี activity</td></tr>';
  },

  async filterLogs() {
    const keyId = document.getElementById('filter-log-key').value;
    const logs  = await this.getLogs(keyId);
    this._renderLogs(logs);
  },

  async populateLogFilter() {
    const keys = await this.getKeys();
    document.getElementById('filter-log-key').innerHTML =
      '<option value="">ทุก Key</option>' +
      keys.map(k => `<option value="${k.key_id}">${k.label}</option>`).join('');
  },

  // ── Create Modal ──
  openCreateModal() {
    this._newKey = this._generateKey();
    document.getElementById('new-key-label').value     = '';
    document.getElementById('new-key-value').value     = this._newKey;
    document.getElementById('new-perm-students').checked = true;
    document.getElementById('new-perm-items').checked    = true;
    document.getElementById('new-perm-payments').checked = false;
    document.getElementById('modal-create-key').classList.add('open');
  },

  async saveCreateKey() {
    const label = document.getElementById('new-key-label').value.trim();
    const key   = document.getElementById('new-key-value').value.trim();
    const perms = {
      students: document.getElementById('new-perm-students').checked,
      items:    document.getElementById('new-perm-items').checked,
      payments: document.getElementById('new-perm-payments').checked,
    };
    if (!label || !key) { alert('กรุณากรอกชื่อและ Key'); return; }

    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    const btn = document.getElementById('btn-save-key');
    btn.disabled = true;
    try {
      await this.createKey(label, key, perms, admin.label);
      this.closeModal('modal-create-key');
      this.loadView();
    } catch(e) { alert('สร้างไม่สำเร็จ: ' + e.message); }
    finally { btn.disabled = false; }
  },

  // ── Edit Modal ──
  _editKeyId: '',
  openEditModal(keyId, label, students, items, payments) {
    this._editKeyId = keyId;
    document.getElementById('edit-key-label').value        = label;
    document.getElementById('edit-perm-students').checked  = students;
    document.getElementById('edit-perm-items').checked     = items;
    document.getElementById('edit-perm-payments').checked  = payments;
    // reset key section
    document.getElementById('edit-new-key').value   = '';
    document.getElementById('edit-key-section').style.display = 'none';
    document.getElementById('modal-edit-key').classList.add('open');
  },

  toggleResetKey() {
    const sec = document.getElementById('edit-key-section');
    const visible = sec.style.display !== 'none';
    if (visible) {
      sec.style.display = 'none';
      document.getElementById('edit-new-key').value = '';
    } else {
      sec.style.display = '';
      document.getElementById('edit-new-key').value = this._generateKey();
    }
  },

  async saveEditKey() {
    const admin   = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    const perms   = {
      students: document.getElementById('edit-perm-students').checked,
      items:    document.getElementById('edit-perm-items').checked,
      payments: document.getElementById('edit-perm-payments').checked,
    };
    await this.updatePerms(this._editKeyId, perms, admin.label);

    // ถ้ามีการ reset key
    const newKey = document.getElementById('edit-new-key').value.trim();
    if (newKey && document.getElementById('edit-key-section').style.display !== 'none') {
      const hash = await this.sha256(newKey);
      await fetch(`${this.SUPA_URL}/rest/v1/admin_keys?key_id=eq.${this._editKeyId}`, {
        method: 'PATCH', headers: this._h, body: JSON.stringify({ key_hash: hash }),
      });
      await this.log(admin.label, 'reset key', `รีเซ็ต key ของ: ${this._editKeyId}`);
      alert(`✅ Key ใหม่คือ:\n\n${newKey}\n\nกรุณา copy และแจ้งผู้ใช้ด้วยครับ`);
    }

    this.closeModal('modal-edit-key');
    this.loadView();
  },

  async confirmDelete(keyId, label) {
    if (!confirm(`ลบ key "${label}" ออกจากระบบ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    await this.deleteKey(keyId, admin.label);
    this.loadView();
  },

  async toggleActive(keyId, active) {
    const admin = JSON.parse(sessionStorage.getItem('cfx_admin') || '{}');
    await this.toggleKey(keyId, active, admin.label);
    this.loadView();
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  copyKey() {
    const val = document.getElementById('new-key-value').value;
    navigator.clipboard.writeText(val).then(() => alert('Copy แล้ว! แจ้ง key นี้ให้ผู้ใช้ครับ'));
  },

  regenKey() { document.getElementById('new-key-value').value = this._generateKey(); },

  _generateKey() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    return Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => chars[b % chars.length]).join('');
  },

  _date(str)     { return str ? new Date(str).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : '—'; },
  _dateTime(str) { return str ? new Date(str).toLocaleString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'; },
};
// ── api.js — Supabase Client ──

const API = {
  URL: 'https://oqdvrzflkshxyhepaqep.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xZHZyemZsa3NoeHloZXBhcWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTIyMDAsImV4cCI6MjA4OTE4ODIwMH0.Eo4DsJ82V9PEiEhewiq6KHyP3HzNdO80oFSNQOASHcg',

  // ── XSS protection ──
  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  // ── HTTP helpers ──
  async _get(table, params = '') {
    const res = await fetch(`${this.URL}/rest/v1/${table}?${params}`, {
      headers: { 'apikey': this.KEY, 'Authorization': `Bearer ${this.KEY}` },
    });
    if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
    return res.json();
  },

  async _post(table, body) {
    const res = await fetch(`${this.URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': this.KEY, 'Authorization': `Bearer ${this.KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${table} failed: ${res.status}`);
    return res.json();
  },

  async _patch(table, match, body) {
    const qs  = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${this.URL}/rest/v1/${table}?${qs}`, {
      method: 'PATCH',
      headers: {
        'apikey': this.KEY, 'Authorization': `Bearer ${this.KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${table} failed: ${res.status}`);
    return res.json();
  },

  async _delete(table, match) {
    const qs  = Object.entries(match).map(([k,v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${this.URL}/rest/v1/${table}?${qs}`, {
      method: 'DELETE',
      headers: { 'apikey': this.KEY, 'Authorization': `Bearer ${this.KEY}` },
    });
    if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
    return true;
  },

  // ════════════════════════════════
  //  STUDENTS
  // ════════════════════════════════
  async getStudents() {
    const rows = await this._get('students', 'select=*&order=created_at.asc');
    return rows.map(r => ({
      studentId: this._esc(r.student_id),
      firstName: this._esc(r.first_name),
      lastName:  this._esc(r.last_name),
      year:      String(r.year),
      type:      r.type || 'ปกติ',
      phone:     this._esc(r.phone || ''),
      email:     this._esc(r.email || ''),
    }));
  },

  async lookupStudent(studentId) {
    const safe = encodeURIComponent(String(studentId).trim());
    const rows = await this._get('students', `student_id=eq.${safe}&select=*`);
    if (!rows.length) return { found: false };
    const r = rows[0];
    return {
      found: true,
      student: {
        studentId: this._esc(r.student_id),
        firstName: this._esc(r.first_name),
        lastName:  this._esc(r.last_name),
        year:      String(r.year),
        type:      r.type || 'ปกติ',
        phone:     this._esc(r.phone || ''),
      },
    };
  },

  async addStudent(data) {
    try {
      await this._post('students', {
        student_id: String(data.studentId).trim(),
        first_name: data.firstName,
        last_name:  data.lastName,
        year:       data.year,
        type:       data.type || 'ปกติ',
        phone:      data.phone || '',
        email:      data.email || '',
      });
      return { success: true };
    } catch(e) { return { success: false, error: e.message }; }
  },

  async importStudents(rows) {
    let added = 0, skipped = 0;
    for (const data of rows) {
      const check = await this.lookupStudent(data.studentId);
      if (check.found) { skipped++; continue; }
      await this._post('students', {
        student_id: String(data.studentId).trim(),
        first_name: data.firstName,
        last_name:  data.lastName,
        year:       data.year,
        type:       data.type || 'ปกติ',
        phone:      data.phone || '',
        email:      data.email || '',
      });
      added++;
    }
    return { success: true, added, skipped };
  },

  async deleteStudent(studentId) {
    await this._delete('students', { student_id: String(studentId).trim() });
    return { success: true };
  },

  // ════════════════════════════════
  //  ITEMS
  // ════════════════════════════════
  async getItems() {
    const rows = await this._get('items', 'select=*&order=created_at.asc');
    return rows.map(r => ({
      itemId:      r.item_id,
      name:        this._esc(r.name),
      amount:      Number(r.amount),
      targetYears: String(r.target_years).split(',').map(s => s.trim()).filter(Boolean),
      deadline:    r.deadline || '',
      active:      r.active,
    }));
  },

  async addItem(data) {
    const itemId = 'item_' + Date.now();
    await this._post('items', {
      item_id:      itemId,
      name:         data.name,
      amount:       data.amount,
      target_years: Array.isArray(data.targetYears) ? data.targetYears.join(',') : data.targetYears,
      deadline:     data.deadline || '',
      active:       data.active !== false,
    });
    return { success: true, itemId };
  },

  async updateItem(data) {
    await this._patch('items', { item_id: data.itemId }, {
      name:         data.name,
      amount:       data.amount,
      target_years: Array.isArray(data.targetYears) ? data.targetYears.join(',') : data.targetYears,
      deadline:     data.deadline || '',
      active:       data.active,
    });
    return { success: true };
  },

  async deleteItem(itemId) {
    await this._delete('items', { item_id: itemId });
    return { success: true };
  },

  // ════════════════════════════════
  //  PAYMENTS
  // ════════════════════════════════
  async getPayments(studentId = '') {
    const qs = studentId
      ? `student_id=eq.${encodeURIComponent(studentId)}&select=*&order=paid_at.asc`
      : 'select=*&order=paid_at.asc';
    const rows = await this._get('payments', qs);
    return rows.map(r => ({
      payId:     r.pay_id,
      studentId: r.student_id,
      firstName: this._esc(r.first_name),
      lastName:  this._esc(r.last_name),
      year:      r.year,
      itemId:    r.item_id,
      itemName:  this._esc(r.item_name),
      amount:    Number(r.amount),
      transId:   r.trans_id || '',
      paidAt:    r.paid_at,
    }));
  },

  async addPayment(data) {
    const payId = 'pay_' + Date.now();
    await this._post('payments', {
      pay_id:     payId,
      student_id: data.studentId,
      first_name: data.firstName,
      last_name:  data.lastName,
      year:       data.year,
      item_id:    data.itemId,
      item_name:  data.itemName,
      amount:     data.amount,
      trans_id:   data.transId || '',
    });
    return { success: true, payId };
  },

  // ════════════════════════════════
  //  PAYNOI PROXY (ผ่าน Edge Function)
  // ════════════════════════════════
  async post(action, data = {}) {
    const payActions = ['payCreate', 'payCancel', 'payCheck'];
    if (payActions.includes(action)) {
      const res = await fetch(
        'https://oqdvrzflkshxyhepaqep.supabase.co/functions/v1/paynoi-proxy',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.KEY}` },
          body: JSON.stringify(data.payload || data),
        }
      );
      if (!res.ok) throw new Error(`Paynoi proxy failed: ${res.status}`);
      return res.json();
    }
    throw new Error(`Unknown post action: ${action}`);
  },
};
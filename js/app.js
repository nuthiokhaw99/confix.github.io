// ── app.js — Main App Logic ──

const App = {
  cache: {
    students: null,
    items:    null,
    payments: null,
    ready:    false,
  },

  state: {
    year: null, firstName: '', lastName: '',
    studentId: '', currentItem: null, timer: null,
  },

  // ════════════════════════════════
  //  URL PARAMS — อ่าน/เขียน state ลง URL
  // ════════════════════════════════
  _getParams() {
    return new URLSearchParams(location.search);
  },

  _setUrl(params) {
    const url = params.toString() ? `?${params.toString()}` : location.pathname;
    history.replaceState(null, '', url);
  },

  _saveUrl(page) {
    const p = new URLSearchParams();
    p.set('page', page);
    if (this.state.studentId) p.set('id', this.state.studentId);
    if (page === 'pay' && this.state.currentItem) {
      p.set('item', this.state.currentItem.itemId);
    }
    this._setUrl(p);
  },

  _readUrl() {
    const p  = this._getParams();
    const page = p.get('page') || 'info';
    this._urlStudentId = p.get('id')   || '';
    this._urlItemId    = p.get('item') || '';
    return page;
  },

  // ════════════════════════════════
  //  PREFETCH
  // ════════════════════════════════
  async _prefetch() {
    try {
      // Supabase รองรับ parallel requests ได้เลย เร็วกว่า Apps Script มาก
      const [students, items, payments] = await Promise.all([
        API.getStudents(),
        API.getItems(),
        API.getPayments(),
      ]);

      this.cache.students = new Map(
        students.map(s => [
          String(s.studentId).trim(),
          { ...s, studentId: String(s.studentId).trim(), year: String(s.year) }
        ])
      );

      this.cache.items = items.map(i => ({
        ...i,
        itemId:      String(i.itemId),
        targetYears: (i.targetYears || []).map(y => String(y).trim()),
        amount:      Number(i.amount),
      }));

      this.cache.payments = {};
      payments.forEach(p => {
        const key = String(p.studentId).trim();
        if (!this.cache.payments[key]) this.cache.payments[key] = [];
        this.cache.payments[key].push({ ...p, itemId: String(p.itemId) });
      });

      this.cache.ready = true;
      console.log(`[Cache] ✓ students:${students.length} items:${items.length} payments:${payments.length}`);
    } catch(e) {
      console.warn('[Cache] prefetch failed, retry in 3s...', e.message);
      await new Promise(r => setTimeout(r, 3000));
      return this._prefetch();
    }
  },

  // ════════════════════════════════
  //  NAVIGATION
  // ════════════════════════════════
  go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
    window.scrollTo(0, 0);
    this._updateSteps(page);
    // บันทึก state ลง URL
    if (page === 'info') {
      this._setUrl(new URLSearchParams()); // ล้าง URL
    } else {
      this._saveUrl(page);
    }
  },

  _updateSteps(page) {
    const cur = { info: 1, select: 2, pay: 3 }[page] || 1;
    document.querySelectorAll('.step').forEach(el => {
      const n = +el.dataset.step;
      el.classList.remove('done', 'active');
      if (n < cur)        el.classList.add('done');
      else if (n === cur) el.classList.add('active');
    });
    document.querySelectorAll('.step-line').forEach(el =>
      el.classList.toggle('done', +el.dataset.after < cur)
    );
  },

  switchTab(tab) {
    const isPending = tab === 'pending';
    document.getElementById('tab-pending').classList.toggle('active', isPending);
    document.getElementById('tab-paid').classList.toggle('active', !isPending);
    document.getElementById('panel-pending').style.display = isPending ? '' : 'none';
    document.getElementById('panel-paid').style.display    = isPending ? 'none' : '';
  },

  _waitCache() {
    if (this.cache.ready) return Promise.resolve();
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (this.cache.ready) { clearInterval(check); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 10000);
    });
  },

  // ════════════════════════════════
  //  PAGE 1
  // ════════════════════════════════
  _bindPage1() {
    document.querySelectorAll('.year-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.year-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        document.querySelectorAll('.subtype-group').forEach(g => g.classList.remove('show'));
        const yr = card.dataset.year;
        this.state.year = yr;
        if (yr === '3' || yr === '4') document.getElementById('subtype-' + yr)?.classList.add('show');
      });
    });

    document.querySelectorAll('.subtype-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.subtype-group').querySelectorAll('.subtype-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.state.year = btn.dataset.type;
      });
    });

    document.getElementById('input-studentid').addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
    });

    document.getElementById('btn-next-1').addEventListener('click', () => this._validatePage1());
  },

  async _validatePage1() {
    const firstName = document.getElementById('input-firstname').value.trim();
    const lastName  = document.getElementById('input-lastname').value.trim();
    const studentId = document.getElementById('input-studentid').value.trim();
    this._clearErrors();

    let ok = true;
    if (!this.state.year)                    { this._toast('กรุณาเลือกปีการศึกษา'); ok = false; }
    if (!firstName)                          { this._err('firstname', 'กรุณากรอกชื่อจริง'); ok = false; }
    if (!lastName)                           { this._err('lastname',  'กรุณากรอกนามสกุล'); ok = false; }
    if (!studentId)                          { this._err('studentid', 'กรุณากรอกรหัสนักศึกษา'); ok = false; }
    else if (!/^\d{10,15}$/.test(studentId)) { this._err('studentid', 'รหัสต้องเป็นตัวเลข 10–15 หลัก'); ok = false; }
    if (!ok) return;

    this._setBtn(true, '<i class="fi fi-rr-refresh spin"></i> กำลังตรวจสอบ...');
    await this._waitCache();

    try {
      const student = this.cache.ready
        ? (this.cache.students.get(studentId) || null)
        : (await API.lookupStudent(studentId)).then(r => r.found ? r.student : null);

      if (!student) {
        this._err('studentid', `ไม่พบรหัส ${studentId} ในระบบ — กรุณาตรวจสอบรหัส หรือติดต่อแอดมิน`);
        return;
      }
      if (student.firstName !== firstName || student.lastName !== lastName) {
        this._err('firstname', `ชื่อ-นามสกุลไม่ตรงกับข้อมูลในระบบ — กรุณาตรวจสอบการสะกด`);
        return;
      }

      this.state.year = student.type === 'เทียบโอน' ? student.year + 't' : student.year;
      Object.assign(this.state, { firstName, lastName, studentId });

      this._loadPage2();
      this.go('select');
    } catch(e) {
      this._toast('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่');
      console.error(e);
    } finally {
      this._setBtn(false);
    }
  },

  // ════════════════════════════════
  //  PAGE 2
  // ════════════════════════════════
  _loadPage2() {
    document.getElementById('user-greeting').textContent = `${this.state.firstName} ${this.state.lastName}`;
    document.getElementById('user-id').textContent       = `รหัส: ${this.state.studentId}`;
    document.getElementById('user-year').textContent     = DB.yearLabel(this.state.year);
    document.getElementById('user-avatar').textContent   = this.state.firstName.charAt(0);

    const myPayments = (this.cache.payments || {})[String(this.state.studentId).trim()] || [];
    const allItems   = this.cache.items || [];
    this._renderLists(allItems, myPayments);
  },

  _renderLists(allItems, myPayments) {
    const paidMap = {};
    myPayments.forEach(p => paidMap[String(p.itemId)] = p);

    const yearStr      = String(this.state.year);
    const items        = allItems.filter(i => i.active && i.targetYears.includes(yearStr));
    const pendingItems = items.filter(i => !paidMap[String(i.itemId)]);
    const paidItems    = items.filter(i =>  paidMap[String(i.itemId)]);

    document.getElementById('count-pending').textContent = pendingItems.length;
    document.getElementById('count-paid').textContent    = paidItems.length;

    document.getElementById('payment-list').innerHTML = pendingItems.length
      ? pendingItems.map(item => `
          <div class="payment-item">
            <div class="pay-info">
              <div class="pay-name">${item.name}</div>
              <div class="pay-amount">฿${Number(item.amount).toLocaleString()}</div>
              ${item.deadline ? `<div class="pay-deadline"><i class="fi fi-rr-calendar"></i> ครบกำหนด: ${this._date(item.deadline)}</div>` : ''}
            </div>
            <button class="btn-pay" onclick="App.selectItem('${item.itemId}',${item.amount},'${encodeURIComponent(item.name)}')">
              <i class="fi fi-rr-credit-card"></i> ชำระเงิน
            </button>
          </div>`).join('')
      : `<div class="empty-state"><i class="fi fi-rr-check-circle empty-icon"></i><p>ชำระครบทุกรายการแล้ว</p></div>`;

    document.getElementById('paid-list').innerHTML = paidItems.length
      ? paidItems.map(item => {
          const p = paidMap[String(item.itemId)];
          return `<div class="payment-item payment-item-paid">
            <div class="pay-info">
              <div class="pay-name">${item.name}</div>
              <div class="pay-amount">฿${Number(item.amount).toLocaleString()}</div>
              ${p?.paidAt ? `<div class="pay-deadline"><i class="fi fi-rr-clock"></i> ชำระเมื่อ: ${this._date(p.paidAt)}</div>` : ''}
            </div>
            <span class="paid-badge"><i class="fi fi-rr-check-circle"></i> ชำระแล้ว</span>
          </div>`;
        }).join('')
      : `<div class="empty-state"><i class="fi fi-rr-wallet empty-icon"></i><p>ยังไม่มีรายการที่ชำระ</p></div>`;
  },

  selectItem(itemId, amount, encodedName) {
    const name = decodeURIComponent(encodedName);
    this.state.currentItem = { itemId, amount: Number(amount), name };
    this._loadPage3();
    this.go('pay');
  },

  // ════════════════════════════════
  //  PAGE 3
  // ════════════════════════════════
  async _loadPage3() {
    const { name, amount, itemId } = this.state.currentItem;
    clearTimeout(this.state.timer);
    Payment.stopAll();

    document.getElementById('qr-item-name').textContent   = name;
    document.getElementById('qr-amount').textContent      = `฿${Number(amount).toLocaleString()}`;
    document.getElementById('qr-real-amount').textContent = '';
    document.getElementById('qr-img').src                 = '';
    document.getElementById('qr-img').style.display       = 'none';
    document.getElementById('qr-loading').style.display   = '';
    document.getElementById('qr-section').style.display   = '';
    document.getElementById('success-section').style.display = 'none';
    document.getElementById('btn-cancel-pay').style.display  = '';
    document.getElementById('btn-back-pay').style.display    = '';
    document.getElementById('qr-countdown').textContent      = '15:00';
    document.getElementById('countdown-box').style.display   = '';
    this._setStatus('pending', '<i class="fi fi-rr-refresh spin"></i> กำลังสร้าง QR Code...');

    try {
      const ref1 = `${this.state.studentId}_${itemId}`;
      const res  = await Payment.create(amount, ref1);

      const b64 = res.qr_image_base64 || '';
      const img = document.getElementById('qr-img');
      img.src           = b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
      img.style.display = '';
      document.getElementById('qr-loading').style.display   = 'none';
      document.getElementById('qr-real-amount').textContent = `ยอดชำระจริง ฿${res.amount}`;
      this._setStatus('pending', '<i class="fi fi-rr-time-past"></i> รอการชำระเงิน...');

      Payment.startCountdown(
        res.expire_at,
        (t) => { const el = document.getElementById('qr-countdown'); if (el) el.textContent = t; },
        () => this._onPayExpire()
      );
      Payment.startPolling(
        (r) => this._onPaySuccess(r),
        ()  => this._onPayExpire()
      );
    } catch(e) {
      document.getElementById('qr-loading').style.display = 'none';
      this._setStatus('pending', `<i class="fi fi-rr-cross-circle"></i> สร้าง QR ไม่สำเร็จ — ${e.message}`);
    }
  },

  async _onPaySuccess(res) {
    Payment.stopAll();
    document.getElementById('qr-section').style.display      = 'none';
    document.getElementById('btn-cancel-pay').style.display  = 'none';
    document.getElementById('btn-back-pay').style.display    = 'none';
    document.getElementById('success-section').style.display = '';

    try {
      await API.addPayment({
        studentId: this.state.studentId,
        firstName: this.state.firstName,
        lastName:  this.state.lastName,
        year:      this.state.year,
        itemId:    this.state.currentItem.itemId,
        itemName:  this.state.currentItem.name,
        amount:    this.state.currentItem.amount,
        transId:   res.trans_id || Payment._transId || '',
      });
      const key = String(this.state.studentId).trim();
      if (!this.cache.payments[key]) this.cache.payments[key] = [];
      this.cache.payments[key].push({
        itemId: String(this.state.currentItem.itemId),
        paidAt: new Date().toISOString(),
        status: 'paid',
      });
    } catch(e) { console.warn('[Payment] save failed:', e); }

    this._setStatus('success',
      `<i class="fi fi-rr-check-circle"></i>
       <strong>${this.state.firstName} ${this.state.lastName}</strong>
       <span class="status-detail">${DB.yearLabel(this.state.year)} · รหัส ${this.state.studentId}</span>
       ทำการชำระเงินของ <strong>${this.state.currentItem.name}</strong> เรียบร้อยแล้ว`);

    this.state.timer = setTimeout(() => {
      this._loadPage2();
      this.switchTab('paid');
      this.go('select');
    }, 4000);
  },

  _onPayExpire() {
    Payment.stopAll();
    document.getElementById('countdown-box').style.display  = 'none';
    document.getElementById('btn-cancel-pay').style.display = 'none';
    document.getElementById('qr-img').style.display         = 'none';
    this._setStatus('pending', '<i class="fi fi-rr-clock"></i> QR หมดอายุแล้ว — กรุณากลับและชำระใหม่');
  },

  async cancelPayment() {
    await Payment.cancel();
    this.go('select');
  },

  goInfo() {
    this._setUrl(new URLSearchParams());
    this.go('info');
  },

  // ── Helpers ──
  _setBtn(loading, label = 'ดูรายการชำระเงิน <i class="fi fi-rr-arrow-right"></i>') {
    const btn = document.getElementById('btn-next-1');
    btn.disabled  = loading;
    btn.innerHTML = label;
  },
  _setStatus(cls, msg)  { const b = document.getElementById('status-box'); b.className = `status-box ${cls}`; b.innerHTML = msg; },
  _err(field, msg)      { const e = document.getElementById(`err-${field}`); if (e) { e.textContent = msg; e.classList.add('show'); } document.getElementById(`input-${field}`)?.classList.add('error'); },
  _clearErrors()        { document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show')); document.querySelectorAll('.form-input').forEach(i => i.classList.remove('error')); },
  _toast(msg)           { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3500); },
  _date(str)            { return str ? new Date(str).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) : ''; },

  init() {
    this._bindPage1();

    const page = this._readUrl();

    if (page !== 'info' && this._urlStudentId) {
      // แสดง loading ทันที
      document.getElementById('payment-list').innerHTML =
        `<div class="empty-state"><i class="fi fi-rr-refresh empty-icon spin"></i><p>กำลังโหลด...</p></div>`;
      this.go('select');

      // prefetch → restore state จาก cache
      this._prefetch().then(() => {
        const student = this.cache.students?.get(this._urlStudentId);
        if (!student) { this.goInfo(); return; } // ถ้าหาไม่เจอ → กลับหน้าแรก

        // restore state จาก cache
        this.state.studentId = this._urlStudentId;
        this.state.firstName = student.firstName;
        this.state.lastName  = student.lastName;
        this.state.year      = student.type === 'เทียบโอน'
          ? student.year + 't' : String(student.year);

        // ถ้ามี item ใน URL → restore currentItem ด้วย
        if (this._urlItemId) {
          const item = this.cache.items?.find(i => i.itemId === this._urlItemId);
          if (item) this.state.currentItem = { itemId: item.itemId, amount: item.amount, name: item.name };
        }

        // อัปเดต user card
        document.getElementById('user-greeting').textContent = `${this.state.firstName} ${this.state.lastName}`;
        document.getElementById('user-id').textContent       = `รหัส: ${this.state.studentId}`;
        document.getElementById('user-year').textContent     = DB.yearLabel(this.state.year);
        document.getElementById('user-avatar').textContent   = this.state.firstName.charAt(0);

        this._loadPage2();
      });
    } else {
      this._prefetch();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
// ── payment.js — Paynoi via Supabase Edge Function ──

const Payment = {
  // Paynoi api_key อยู่ใน Edge Function เท่านั้น ไม่ส่งจาก browser
  PROXY: 'https://oqdvrzflkshxyhepaqep.supabase.co/functions/v1/paynoi-proxy',

  _pollTimer:      null,
  _countdownTimer: null,
  _transId:        null,
  _expireAt:       null,

  // ── เรียก Paynoi ผ่าน Edge Function (ไม่ส่ง api_key) ──
  async _call(body) {
    const res = await fetch(this.PROXY, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API.KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    return res.json();
  },

  // ── สร้าง Transaction ──
  async create(amount, ref1) {
    // ไม่ส่ง api_key, account, key_id — Edge Function จัดการเอง
    const res = await this._call({
      method: 'create',
      amount: Math.floor(amount),
      ref1:   String(ref1),
    });
    if (!res || res.status !== 1) throw new Error(res?.msg || 'สร้าง QR ไม่สำเร็จ');
    this._transId  = res.trans_id;
    this._expireAt = new Date(res.expire_at);
    return res;
  },

  // ── เช็คสถานะ ──
  async check() {
    if (!this._transId) throw new Error('ไม่มี trans_id');
    return this._call({ method: 'check', trans_id: this._transId });
  },

  // ── ยกเลิก ──
  async cancel() {
    if (!this._transId) return;
    try { await this._call({ method: 'cancel', trans_id: this._transId }); } catch(e) {}
    this._transId = null;
    this.stopAll();
  },

  // ── Polling ──
  startPolling(onPaid, onExpire) {
    this.stopPolling();
    this._pollTimer = setInterval(async () => {
      try {
        if (this._expireAt && new Date() > this._expireAt) {
          this.stopAll(); onExpire?.(); return;
        }
        const res = await this.check();
        if (res?.payment_status === 'completed') { this.stopAll(); onPaid?.(res); }
      } catch(e) { console.warn('[Payment] poll:', e.message); }
    }, PAYMENT_CONFIG.poll_interval * 1000);
  },

  stopPolling() { clearInterval(this._pollTimer); this._pollTimer = null; },

  // ── Countdown ──
  startCountdown(expireAt, onTick, onExpire) {
    this.stopCountdown();
    const normalized = String(expireAt).includes('+') || String(expireAt).includes('Z')
      ? expireAt : expireAt.replace(' ', 'T') + '+07:00';
    const end = new Date(normalized).getTime();
    if (isNaN(end)) { console.error('[Payment] expireAt parse failed:', expireAt); return; }

    const tick = () => {
      const remain = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const min = Math.floor(remain / 60);
      const sec = remain % 60;
      onTick?.(`${min}:${String(sec).padStart(2, '0')}`);
      if (remain === 0) { this.stopCountdown(); onExpire?.(); }
    };
    tick();
    this._countdownTimer = setInterval(tick, 1000);
  },

  stopCountdown() { clearInterval(this._countdownTimer); this._countdownTimer = null; },
  stopAll()       { this.stopPolling(); this.stopCountdown(); },
};
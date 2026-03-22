// ── db.js — Local Utilities ──

const DB = {
  YEAR_LABELS: {
    '1':'ปี 1', '2':'ปี 2',
    '3':'ปี 3 (ปกติ)', '3t':'ปี 3 (เทียบโอน)',
    '4':'ปี 4 (ปกติ)', '4t':'ปี 4 (เทียบโอน)',
  },
  yearLabel(code) { return this.YEAR_LABELS[code] || code; },
};

// QRHelper ยังเก็บไว้เผื่อใช้ แต่ตอนนี้ใช้ Paynoi แทนแล้ว
const QRHelper = {
  getQRUrl(amount, size=220) {
    // ใช้ PAYMENT_CONFIG.proxy แทน — QRHelper ไม่ได้ใช้งานแล้ว
    return '';
  },
};
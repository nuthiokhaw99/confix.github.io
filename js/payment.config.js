// ── payment.config.js ──
// ข้อมูล sensitive ทั้งหมดย้ายไปอยู่ใน Supabase Edge Function แล้ว
// ไม่ต้องแก้ไฟล์นี้อีกต่อไป

const PAYMENT_CONFIG = {
  // Supabase Edge Function URL (Paynoi api_key อยู่ใน server เท่านั้น)
  proxy: 'https://oqdvrzflkshxyhepaqep.supabase.co/functions/v1/paynoi-proxy',

  // Poll ตรวจสอบการชำระทุกกี่วิ (5 วิ = 180 ครั้ง/15 นาที)
  poll_interval: 5,

  // หมดอายุ QR กี่นาที
  expire_minutes: 15,
};
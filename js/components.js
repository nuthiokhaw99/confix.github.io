// ── components.js — Component Loader ──

const Components = {
  get base() {
    const depth = location.pathname.replace(/\/$/, '').split('/').filter(Boolean).length;
    return depth === 0 ? 'components/' : '../'.repeat(depth) + 'components/';
  },

  get adminHref() {
    return location.pathname.includes('/admin') ? '#' : 'admin/login/';
  },

  async load(placeholderId, file) {
    const el = document.getElementById(placeholderId);
    if (!el) return;
    try {
      const res = await fetch(this.base + file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();
      html = html.replace('ADMIN_LINK', this.adminHref);
      el.outerHTML = html;
    } catch (err) {
      console.warn('[Components] โหลดไม่สำเร็จ:', file, err.message);
    }
  },

  async init() {
    await Promise.all([
      this.load('header-placeholder', 'header.html'),
      this.load('footer-placeholder', 'footer.html'),
    ]);
    document.dispatchEvent(new Event('components:loaded'));
  },
};

document.addEventListener('DOMContentLoaded', () => Components.init());

// ── components.js — Component Loader ──

const Components = {
  _getRoot() {
    if (location.hostname.includes('github.io')) {
      const firstSeg = location.pathname.split('/').filter(Boolean)[0] || '';
      return '/' + firstSeg + '/';
    }
    const depth = location.pathname.replace(/\/$/, '').split('/').filter(Boolean).length;
    return depth === 0 ? '/' : '../'.repeat(depth);
  },

  async load(placeholderId, file) {
    const el = document.getElementById(placeholderId);
    if (!el) return;
    const root = this._getRoot();
    const adminHref = location.pathname.includes('/admin') ? '#' : root + 'admin/login/';
    try {
      const res = await fetch(root + 'components/' + file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();
      html = html.replace('ADMIN_LINK', adminHref);
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

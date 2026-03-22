// ── components.js — Component Loader ──

const Components = {
  get base() {
    const path     = location.pathname;
    const segments = path.replace(/\/$/, '').split('/').filter(Boolean);

    const isGitHubPages = location.hostname.includes('github.io');

    if (isGitHubPages) {
      const repoName = segments[0] || '';
      return `/${repoName}/components/`;
    }

    const depth = segments.length;
    if (depth === 0) return 'components/';
    return '../'.repeat(depth) + 'components/';
  },

  get adminHref() {
    const isGitHubPages = location.hostname.includes('github.io');
    if (isGitHubPages) {
      const segments = location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
      const repoName = segments[0] || '';
      return location.pathname.includes('/admin') ? '#' : `/${repoName}/admin/login/`;
    }
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

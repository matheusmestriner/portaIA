(() => {
  'use strict';

  const DEFAULT_CLIENT_THEME = Object.freeze({
    mode: null,
    primaryColor: '#2563eb',
    secondaryColor: '#22c55e',
    logo: null
  });

  // O backend poderá definir window.clientTheme antes deste arquivo ser carregado.
  const suppliedTheme = window.clientTheme && typeof window.clientTheme === 'object'
    ? window.clientTheme
    : {};

  const clientTheme = {
    ...DEFAULT_CLIENT_THEME,
    ...suppliedTheme
  };

  window.clientTheme = clientTheme;

  const root = document.documentElement;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const themeToggle = document.getElementById('theme-toggle');
  const themeColorMeta = document.getElementById('theme-color-meta');
  const clientLogo = document.getElementById('client-logo');
  const defaultAvatar = document.getElementById('default-avatar');

  let manualTheme = null;

  function isValidHexColor(value) {
    return typeof value === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
  }

  function hexToRgb(hex) {
    const normalized = hex.replace('#', '').trim();
    const full = normalized.length === 3
      ? normalized.split('').map((char) => char + char).join('')
      : normalized;

    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  }

  function applyBrandColors() {
    const primary = isValidHexColor(clientTheme.primaryColor)
      ? clientTheme.primaryColor.trim()
      : DEFAULT_CLIENT_THEME.primaryColor;
    const secondary = isValidHexColor(clientTheme.secondaryColor)
      ? clientTheme.secondaryColor.trim()
      : DEFAULT_CLIENT_THEME.secondaryColor;

    const primaryRgb = hexToRgb(primary);
    const secondaryRgb = hexToRgb(secondary);

    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
  }

  function getPreferredTheme() {
    if (manualTheme === 'light' || manualTheme === 'dark') {
      return manualTheme;
    }

    if (clientTheme.mode === 'light' || clientTheme.mode === 'dark') {
      return clientTheme.mode;
    }

    return mediaQuery.matches ? 'dark' : 'light';
  }

  function updateThemeColor(theme) {
    if (!themeColorMeta) return;
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#020617' : '#f8fafc');
  }

  function updateToggleState(theme) {
    if (!themeToggle) return;

    const isDark = theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = nextTheme;
    updateThemeColor(nextTheme);
    updateToggleState(nextTheme);

    window.dispatchEvent(new CustomEvent('themechange', {
      detail: {
        theme: nextTheme,
        primaryColor: getComputedStyle(root).getPropertyValue('--primary').trim(),
        secondaryColor: getComputedStyle(root).getPropertyValue('--secondary').trim()
      }
    }));
  }

  function applyLogo() {
    if (!clientLogo || !defaultAvatar) return;

    if (typeof clientTheme.logo === 'string' && clientTheme.logo.trim()) {
      clientLogo.src = clientTheme.logo.trim();
      clientLogo.hidden = false;
      defaultAvatar.hidden = true;
      clientLogo.addEventListener('error', () => {
        clientLogo.hidden = true;
        defaultAvatar.hidden = false;
      }, { once: true });
      return;
    }

    clientLogo.hidden = true;
    defaultAvatar.hidden = false;
  }

  themeToggle?.addEventListener('click', () => {
    const current = root.dataset.theme === 'dark' ? 'dark' : 'light';
    manualTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(manualTheme);
  });

  mediaQuery.addEventListener?.('change', () => {
    if (manualTheme || clientTheme.mode === 'light' || clientTheme.mode === 'dark') {
      return;
    }
    applyTheme(getPreferredTheme());
  });

  applyBrandColors();
  applyLogo();
  applyTheme(getPreferredTheme());

  window.LoginTheme = Object.freeze({
    get config() {
      return { ...clientTheme };
    },
    get current() {
      return root.dataset.theme;
    },
    set(theme) {
      if (theme !== 'light' && theme !== 'dark') {
        throw new TypeError('Tema inválido. Use "light" ou "dark".');
      }
      manualTheme = theme;
      applyTheme(theme);
    },
    resetToClientPreference() {
      manualTheme = null;
      applyTheme(getPreferredTheme());
    }
  });
})();

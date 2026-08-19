(() => {
  'use strict';

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailShell = document.getElementById('email-shell');
  const passwordShell = document.getElementById('password-shell');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const submitButton = document.getElementById('submit-button');
  const submitLabel = document.getElementById('submit-label');
  const submitSpinner = document.getElementById('submit-spinner');
  const formStatus = document.getElementById('form-status');
  const forgotLink = document.getElementById('forgot-link');
  const loginCard = document.getElementById('login-card');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (!form || !emailInput || !passwordInput || !submitButton) return;

  let submitting = false;

  function setFieldError(input, shell, errorElement, message) {
    const hasError = Boolean(message);
    input.setAttribute('aria-invalid', String(hasError));
    shell?.classList.toggle('has-error', hasError);
    if (errorElement) errorElement.textContent = message || '';
  }

  function validateEmail(value) {
    const email = value.trim();
    if (!email) return 'Informe seu e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Digite um e-mail válido.';
    return '';
  }

  function validatePassword(value) {
    if (!value) return 'Informe sua senha.';
    return '';
  }

  function validateForm() {
    const emailMessage = validateEmail(emailInput.value);
    const passwordMessage = validatePassword(passwordInput.value);

    setFieldError(emailInput, emailShell, emailError, emailMessage);
    setFieldError(passwordInput, passwordShell, passwordError, passwordMessage);

    if (emailMessage) {
      emailInput.focus();
      return false;
    }

    if (passwordMessage) {
      passwordInput.focus();
      return false;
    }

    return true;
  }

  function setLoading(isLoading) {
    submitting = isLoading;
    submitButton.disabled = isLoading;
    submitButton.setAttribute('aria-busy', String(isLoading));
    submitSpinner.hidden = !isLoading;
    submitLabel.textContent = isLoading ? 'Entrando...' : 'Entrar';
  }

  function setStatus(message, state = 'error') {
    if (!formStatus) return;
    formStatus.textContent = message;
    formStatus.dataset.state = state;
  }

  async function login(email, password) {
    const endpoint = typeof window.AUTH_LOGIN_URL === 'string'
      ? window.AUTH_LOGIN_URL.trim()
      : '';

    if (!endpoint) {
      return {
        ok: false,
        message: 'Autenticação ainda não conectada ao backend.'
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ email, password })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.message || 'E-mail ou senha inválidos.'
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload
    };
  }

  window.login = login;

  emailInput.addEventListener('input', () => {
    if (emailInput.getAttribute('aria-invalid') === 'true') {
      setFieldError(emailInput, emailShell, emailError, validateEmail(emailInput.value));
    }
    setStatus('');
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.getAttribute('aria-invalid') === 'true') {
      setFieldError(passwordInput, passwordShell, passwordError, validatePassword(passwordInput.value));
    }
    setStatus('');
  });

  passwordToggle?.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', String(!showing));
    passwordToggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');

    const openEye = passwordToggle.querySelector('.eye-open');
    const closedEye = passwordToggle.querySelector('.eye-closed');
    if (openEye) openEye.hidden = !showing;
    if (closedEye) closedEye.hidden = showing;

    passwordInput.focus({ preventScroll: true });
    const end = passwordInput.value.length;
    try {
      passwordInput.setSelectionRange(end, end);
    } catch (_) {
      // Alguns navegadores não permitem seleção em certos estados de input.
    }
  });

  forgotLink?.addEventListener('click', (event) => {
    event.preventDefault();
    setStatus('Fluxo de recuperação de senha será conectado ao backend.', 'success');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !validateForm()) return;

    setStatus('');
    setLoading(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const result = await login(emailInput.value.trim(), passwordInput.value);
      if (!result?.ok) {
        setStatus(result?.message || 'Não foi possível concluir o login.');
      } else {
        setStatus('Login realizado com sucesso.', 'success');
        window.dispatchEvent(new CustomEvent('login:success', { detail: result.data }));
      }
    } catch (error) {
      console.error('Falha controlada no login:', error);
      setStatus('Não foi possível conectar ao serviço de autenticação.');
    } finally {
      setLoading(false);
    }
  });

  function updateCardLighting(event) {
    if (!loginCard || reducedMotionQuery.matches || !finePointerQuery.matches) return;

    const rect = loginCard.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;

    loginCard.style.setProperty('--mx', `${px}%`);
    loginCard.style.setProperty('--my', `${py}%`);

    const rotateY = ((x / rect.width) - 0.5) * 1.25;
    const rotateX = -((y / rect.height) - 0.5) * 1.0;
    loginCard.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
    loginCard.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
  }

  function resetCardLighting() {
    if (!loginCard) return;
    loginCard.style.setProperty('--mx', '50%');
    loginCard.style.setProperty('--my', '0%');
    loginCard.style.setProperty('--tilt-x', '0deg');
    loginCard.style.setProperty('--tilt-y', '0deg');
  }

  loginCard?.addEventListener('pointermove', updateCardLighting, { passive: true });
  loginCard?.addEventListener('pointerleave', resetCardLighting, { passive: true });
})();

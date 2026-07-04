import { api } from './api.js';
import { ui } from './ui.js';

const tabSignIn = document.getElementById('tab-signin');
const tabSignUp = document.getElementById('tab-signup');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const resetPasswordForm = document.getElementById('reset-password-form');

const tabsContainer = document.getElementById('auth-tabs-container');
const dividerSso = document.getElementById('auth-divider-sso');
const ssoContainer = document.getElementById('auth-sso-container');

// Helper to show inline errors or fall back to toast
function displayError(form, err) {
  ui.clearFormErrors(form);
  
  if (err.payload && err.payload.error_code === 'VALIDATION_ERROR' && err.payload.errors) {
    const errors = err.payload.errors;
    let firstInput = null;
    
    // Loop through each field validation error
    for (const fieldPath in errors) {
      // Zod errors are nested. We might have field names like "body.email" or "email"
      const fieldId = `${form.id.split('-')[0]}-${fieldPath}`;
      const inputEl = document.getElementById(fieldId) || form.querySelector(`[id$="${fieldPath}"]`);
      
      if (inputEl) {
        ui.showInputError(inputEl, errors[fieldPath][0]);
        if (!firstInput) firstInput = inputEl;
      }
    }
    
    if (firstInput) {
      firstInput.focus();
    } else {
      ui.showToast(err.message, 'error');
    }
  } else {
    if (err.payload && err.payload.error_code === 'EMAIL_NOT_VERIFIED') {
      const emailInput = document.getElementById('signin-email');
      const email = emailInput ? emailInput.value.trim() : '';
      
      if (emailInput) {
        ui.showInputError(emailInput, 'Email not verified.');
        const inputGroup = emailInput.closest('.input-group');
        const errorLabel = inputGroup ? inputGroup.querySelector('.validation-error-label') : null;
        if (errorLabel) {
          errorLabel.innerHTML = `Please verify your email. <a href="#" id="link-resend-verification" class="auth-link" style="text-decoration: underline; font-weight: 600;">Resend link</a>`;
          
          const resendBtn = document.getElementById('link-resend-verification');
          if (resendBtn) {
            resendBtn.addEventListener('click', async (clickEvent) => {
              clickEvent.preventDefault();
              try {
                await api.resendVerification(email);
                ui.showToast('Verification email resent! Check server console.', 'success');
              } catch (resendErr) {
                ui.showToast(resendErr.message, 'error');
              }
            });
          }
        }
      } else {
        ui.showToast(err.message, 'error');
      }
    } else {
      ui.showToast(err.message, 'error');
    }
  }
}

export const auth = {
  init() {
    // 1. Tab Switching (Sign In / Sign Up)
    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        signinForm.classList.add('active');
        signupForm.classList.remove('active');
        forgotPasswordForm.classList.remove('active');
        resetPasswordForm.classList.remove('active');
        ui.clearFormErrors(signinForm);
      });

      tabSignUp.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        signupForm.classList.add('active');
        signinForm.classList.remove('active');
        forgotPasswordForm.classList.remove('active');
        resetPasswordForm.classList.remove('active');
        ui.clearFormErrors(signupForm);
      });
    }

    // 2. Forgot Password Screen Navigation
    const linkForgot = document.getElementById('link-forgot-password');
    const linkBack = document.getElementById('link-back-to-signin');
    const linkResetBack = document.getElementById('link-reset-to-signin');

    if (linkForgot) {
      linkForgot.addEventListener('click', (e) => {
        e.preventDefault();
        tabsContainer.style.display = 'none';
        dividerSso.style.display = 'none';
        ssoContainer.style.display = 'none';
        signinForm.classList.remove('active');
        signupForm.classList.remove('active');
        forgotPasswordForm.classList.add('active');
        ui.clearFormErrors(forgotPasswordForm);
      });
    }

    const showSignin = () => {
      tabsContainer.style.display = 'none';
      dividerSso.style.display = 'flex';
      ssoContainer.style.display = 'flex';
      forgotPasswordForm.classList.remove('active');
      resetPasswordForm.classList.remove('active');
      signinForm.classList.add('active');
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      ui.clearFormErrors(signinForm);
    };

    if (linkBack) linkBack.addEventListener('click', (e) => { e.preventDefault(); showSignin(); });
    if (linkResetBack) linkResetBack.addEventListener('click', (e) => { e.preventDefault(); showSignin(); });

    // 3. Password Visibility Toggles
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const input = btn.previousElementSibling;
        if (!input) return;
        
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const icon = btn.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          if (window.lucide) {
            window.lucide.createIcons();
          }
        }
      });
    });

    // 4. Sign In Submit
    if (signinForm) {
      signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.clearFormErrors(signinForm);
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;

        try {
          await api.signIn(email, password);
          window.location.reload();
        } catch (err) {
          displayError(signinForm, err);
        }
      });
    }

    // 5. Sign Up Submit
    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.clearFormErrors(signupForm);
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        try {
          const res = await api.signUp(name, email, password, confirmPassword);
          ui.showToast(res.message || 'Account created successfully!', 'success');
          showSignin();
        } catch (err) {
          displayError(signupForm, err);
        }
      });
    }

    // 6. Forgot Password Submit
    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.clearFormErrors(forgotPasswordForm);
        const email = document.getElementById('forgot-email').value.trim();

        try {
          await api.forgotPassword(email);
          ui.showToast('If this account exists, a password reset link has been sent to your email.', 'success');
          showSignin();
        } catch (err) {
          displayError(forgotPasswordForm, err);
        }
      });
    }

    // 7. Reset Password Submit
    if (resetPasswordForm) {
      resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.clearFormErrors(resetPasswordForm);
        const token = document.getElementById('reset-token').value;
        const password = document.getElementById('reset-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;

        try {
          await api.resetPassword(token, password, confirmPassword);
          ui.showToast('Password reset successful! You can now sign in.', 'success');
          // Clear hash parameter
          window.location.hash = '';
          showSignin();
        } catch (err) {
          displayError(resetPasswordForm, err);
        }
      });
    }

    // 8. Handle verified email parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
      ui.showToast('Email verified successfully! You can now sign in.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 9. Handle reset password link redirection (SPA routing)
    const hash = window.location.hash;
    if (hash.startsWith('#reset-password')) {
      const searchParts = hash.split('?')[1];
      if (searchParts) {
        const hashParams = new URLSearchParams(searchParts);
        const token = hashParams.get('token');
        if (token) {
          // Hide login controls
          tabsContainer.style.display = 'none';
          dividerSso.style.display = 'none';
          ssoContainer.style.display = 'none';
          
          signinForm.classList.remove('active');
          signupForm.classList.remove('active');
          forgotPasswordForm.classList.remove('active');
          
          resetPasswordForm.classList.add('active');
          document.getElementById('reset-token').value = token;
        }
      }
    }

    // Custom footer redirects for redesign
    document.getElementById('link-goto-signup')?.addEventListener('click', (e) => {
      e.preventDefault();
      tabSignUp?.click();
    });
    document.getElementById('link-goto-signin')?.addEventListener('click', (e) => {
      e.preventDefault();
      tabSignIn?.click();
    });
  }
};
export default auth;

// ==========================================
// SYNCRA AUTH CONTROLLER MODULE
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

const tabSignIn = document.getElementById('tab-signin');
const tabSignUp = document.getElementById('tab-signup');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');

export const auth = {
  init() {
    // 1. Tab Switching
    tabSignIn.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signinForm.classList.add('active');
      signupForm.classList.remove('active');
    });

    tabSignUp.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signupForm.classList.add('active');
      signinForm.classList.remove('active');
    });

    // 2. Sign In Form Submission
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;

      try {
        await api.signIn(email, password);
        window.location.reload();
      } catch (err) {
        console.error('Sign in error:', err);
        ui.showToast(err.message, 'error');
      }
    });

    // 3. Sign Up Form Submission
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;

      try {
        await api.signUp(name, email, password);
        ui.showToast('Account created successfully! Please Sign In.', 'success');
        tabSignIn.click();
      } catch (err) {
        console.error('Sign up error:', err);
        ui.showToast(err.message, 'error');
      }
    });
  }
};
export default auth;

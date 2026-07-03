import { Resend } from 'resend';
import config from '../config';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

if (resend) {
  console.log('[Email Service] Initialized Resend.com SDK Client');
} else {
  console.log('[Email Service] Running in simulation mode (console logs only)');
}

export async function sendVerificationEmail(to: string, name: string, link: string): Promise<void> {
  const subject = 'Verify your email address - Syncra';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e5bf0;">Welcome to Syncra, ${name}!</h2>
      <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
      <div style="margin: 24px 0;">
        <a href="${link}" style="background-color: #1e5bf0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="font-size: 0.85rem; color: #64748b;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="font-size: 0.85rem; color: #1e5bf0; word-break: break-all;">${link}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 0.85rem; color: #64748b;">If you didn't create a Syncra account, you can safely ignore this email.</p>
    </div>
  `;

  if (resend) {
    try {
      const result = await resend.emails.send({
        from: config.emailFrom,
        to,
        subject,
        html,
      });
      if (result.error) {
        console.error('[Email Service] Failed to send verification email via Resend:', result.error);
      } else {
        console.log(`[Email Service] Verification email successfully sent to ${to} (ID: ${result.data?.id})`);
      }
    } catch (err: any) {
      console.error('[Email Service] Error in Resend verification email delivery:', err.message || err);
    }
  } else {
    // Simulation fallback
    console.log('\n--- SIMULATED EMAIL OUTBOUND ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Link: ${link}`);
    console.log('--------------------------------\n');
  }
}

export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
  const subject = 'Reset your password - Syncra';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e5bf0;">Reset Password</h2>
      <p>Hello ${name},</p>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <div style="margin: 24px 0;">
        <a href="${link}" style="background-color: #1e5bf0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 0.85rem; color: #64748b;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 0.85rem; color: #1e5bf0; word-break: break-all;">${link}</p>
    </div>
  `;

  if (resend) {
    try {
      const result = await resend.emails.send({
        from: config.emailFrom,
        to,
        subject,
        html,
      });
      if (result.error) {
        console.error('[Email Service] Failed to send reset email via Resend:', result.error);
      } else {
        console.log(`[Email Service] Password reset email successfully sent to ${to} (ID: ${result.data?.id})`);
      }
    } catch (err: any) {
      console.error('[Email Service] Error in Resend reset email delivery:', err.message || err);
    }
  } else {
    // Simulation fallback
    console.log('\n--- SIMULATED EMAIL OUTBOUND ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Link: ${link}`);
    console.log('--------------------------------\n');
  }
}

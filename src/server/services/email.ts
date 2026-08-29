import 'server-only';
import { env, appUrl } from '@/lib/env';

/**
 * Provider-agnostic transactional email. `console` is the development default:
 * messages are logged instead of silently disappearing. Configure
 * EMAIL_PROVIDER=resend + RESEND_API_KEY in production.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  delivered: boolean;
  provider: string;
  detail?: string;
}

async function sendWithResend(message: EmailMessage): Promise<EmailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[email] resend delivery failed', response.status, detail);
    return { delivered: false, provider: 'resend', detail };
  }
  return { delivered: true, provider: 'resend' };
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    return sendWithResend(message);
  }
  console.warn(
    `[email:console] to=${message.to} subject="${message.subject}"\n${message.text ?? message.html}`,
  );
  return { delivered: false, provider: 'console', detail: 'Email provider not configured.' };
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#08080b;color:#f4f1ea;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="letter-spacing:.28em;font-size:12px;color:#d4af37;text-transform:uppercase">Boosie Network</div>
    <h1 style="font-size:26px;margin:16px 0 12px;color:#fff">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#c9c4b8">${bodyHtml}</div>
    <p style="margin-top:32px;font-size:12px;color:#6c675e">Boosie Network · ${appUrl}</p>
  </div></body></html>`;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: 'Reset your Boosie Network password',
    html: layout(
      'Reset your password',
      `<p>Use the link below to choose a new password. It expires in 60 minutes.</p>
       <p><a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#d4af37;color:#0a0a0c;text-decoration:none;font-weight:700;border-radius:2px">Reset password</a></p>
       <p>If you didn't request this, you can ignore this email.</p>`,
    ),
    text: `Reset your Boosie Network password: ${resetUrl} (expires in 60 minutes)`,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: 'Welcome to Boosie Network',
    html: layout(
      `Welcome, ${name}`,
      `<p>Your account is live. Explore Culture, Watch, Listen, Shop and Community.</p>
       <p><a href="${appUrl}" style="color:#d4af37">Open Boosie Network</a></p>`,
    ),
    text: `Welcome to Boosie Network, ${name}. ${appUrl}`,
  });
}

export async function sendOrderReceiptEmail(to: string, orderNumber: string, totalLabel: string) {
  return sendEmail({
    to,
    subject: `Order ${orderNumber} confirmed`,
    html: layout(
      'Order confirmed',
      `<p>Order <strong>${orderNumber}</strong> is confirmed. Total ${totalLabel}.</p>
       <p><a href="${appUrl}/account/orders" style="color:#d4af37">View your orders</a></p>`,
    ),
    text: `Order ${orderNumber} confirmed. Total ${totalLabel}. ${appUrl}/account/orders`,
  });
}

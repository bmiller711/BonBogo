// Optional email sending through Resend (https://resend.com).
// Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend).
// Without them, nothing is emailed: requests and posts still save, and you see
// them on the admin page.

export function emailConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(env, { to, subject, text, replyTo }) {
  if (!emailConfigured(env) || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

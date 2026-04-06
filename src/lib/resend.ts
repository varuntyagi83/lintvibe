import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.EMAIL_FROM ?? "VibeScan <noreply@vibescan.app>";

export async function sendMagicLink(to: string, url: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Sign in to VibeScan",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#18181b;border:1px solid #27272a;border-radius:12px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
      <div style="background:#450a0a;border-radius:8px;padding:6px 10px;border:1px solid #7f1d1d">
        <span style="font-size:16px">🛡️</span>
      </div>
      <span style="font-weight:700;font-size:18px;color:#fafafa">VibeScan</span>
    </div>

    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa">Sign in to your account</h1>
    <p style="margin:0 0 28px;color:#a1a1aa;font-size:14px;line-height:1.6">
      Click the button below to sign in. This link expires in 24 hours and can only be used once.
    </p>

    <a href="${url}" style="display:block;background:#dc2626;color:#fafafa;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:24px">
      Sign in to VibeScan →
    </a>

    <p style="margin:0 0 8px;color:#71717a;font-size:12px">Or copy this link into your browser:</p>
    <p style="margin:0 0 28px;color:#52525b;font-size:11px;word-break:break-all;background:#09090b;padding:10px;border-radius:6px;border:1px solid #27272a">${url}</p>

    <hr style="border:none;border-top:1px solid #27272a;margin:0 0 20px">
    <p style="margin:0;color:#52525b;font-size:11px">
      If you didn't request this email, you can safely ignore it. Someone may have entered your email by mistake.
    </p>
  </div>
</body>
</html>`,
  });
}

export async function sendWelcome(to: string, name: string | null): Promise<void> {
  const firstName = name?.split(" ")[0] ?? "there";
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to VibeScan — your first scan awaits",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#18181b;border:1px solid #27272a;border-radius:12px">
    <div style="margin-bottom:28px">
      <span style="font-weight:700;font-size:18px;color:#fafafa">🛡️ VibeScan</span>
    </div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700">Welcome, ${firstName}! 🎉</h1>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 20px">
      Your account is ready. VibeScan scans your AI-generated code for the exact vulnerability patterns
      that Copilot, Cursor, Lovable, and Bolt introduce — 41 detection rules covering IDOR, auth bypass, injection, secrets exposure, and more.
    </p>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px"><strong style="color:#fafafa">Free plan includes:</strong> 10 scans/month · 500 files per scan · 3 AI explanations</p>
    <a href="${process.env.NEXTAUTH_URL}/onboarding" style="display:block;background:#dc2626;color:#fafafa;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-weight:600;font-size:15px">
      Run your first scan →
    </a>
  </div>
</body>
</html>`,
  });
}

export async function sendSubscriptionConfirmation(to: string, plan: string, periodEnd: Date): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "VibeScan Pro — subscription confirmed",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#18181b;border:1px solid #27272a;border-radius:12px">
    <div style="margin-bottom:28px">
      <span style="font-weight:700;font-size:18px">🛡️ VibeScan</span>
    </div>
    <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:16px;margin-bottom:24px">
      <p style="margin:0;color:#4ade80;font-weight:700;font-size:16px">✅ Pro subscription active</p>
    </div>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 16px">
      You're now on <strong style="color:#fafafa">${plan}</strong>. Unlimited scans, AI Deep Scan, and all future features are unlocked.
    </p>
    <p style="color:#71717a;font-size:12px;margin:0 0 24px">Next billing date: ${periodEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
    <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display:block;background:#dc2626;color:#fafafa;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-weight:600;font-size:15px">
      Go to dashboard →
    </a>
  </div>
</body>
</html>`,
  });
}

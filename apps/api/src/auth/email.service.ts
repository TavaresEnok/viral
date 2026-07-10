import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Se não há config SMTP real, usa Ethereal/console (modo dev)
  if (!host || !user) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;

  constructor() {
    this.from = process.env.SMTP_FROM ?? 'ViralForge <noreply@viralforge.app>';
  }

  async send(options: SendEmailOptions): Promise<void> {
    const transporter = createTransporter();

    if (!transporter) {
      // Modo dev sem SMTP: loga o e-mail no console
      this.logger.warn({
        msg: '[EMAIL DEV MODE] E-mail não enviado (SMTP não configurado)',
        to: options.to,
        subject: options.subject,
      });
      this.logger.log({ msg: '[EMAIL BODY]', html: options.html });
      return;
    }

    try {
      await transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? options.html.replace(/<[^>]+>/g, ''),
      });
      this.logger.log({ msg: 'E-mail enviado', to: options.to, subject: options.subject });
    } catch (error) {
      this.logger.error({
        msg: 'Falha ao enviar e-mail',
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
      });
      // Não lança exceção para não bloquear o fluxo do usuário
    }
  }

  buildVerifyEmailHtml(name: string, verifyUrl: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid #1f1f2e;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#14b8a6 0%,#3b82f6 100%);height:4px;"></td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">ViralForge</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f9fafb;line-height:1.3;">Confirme seu e-mail</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">Olá, <strong style="color:#f9fafb;">${name}</strong>. Para ativar sua conta e começar a criar clips virais, confirme seu endereço de e-mail clicando no botão abaixo.</p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#14b8a6,#3b82f6);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
              Verificar e-mail
            </a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">O link expira em <strong>24 horas</strong>. Se você não criou esta conta, ignore este e-mail.</p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #1f1f2e;">
          <p style="margin:0;font-size:12px;color:#4b5563;">Ou copie e cole este link no seu navegador:<br>
          <span style="color:#14b8a6;word-break:break-all;">${verifyUrl}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  buildResetPasswordHtml(name: string, resetUrl: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#13131a;border-radius:16px;border:1px solid #1f1f2e;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);height:4px;"></td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">ViralForge</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f9fafb;line-height:1.3;">Redefinir senha</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">Olá, <strong style="color:#f9fafb;">${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta ViralForge. Clique no botão abaixo para criar uma nova senha.</p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
              Redefinir senha
            </a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">O link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha não será alterada.</p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #1f1f2e;">
          <p style="margin:0;font-size:12px;color:#4b5563;">Ou copie e cole este link no seu navegador:<br>
          <span style="color:#f59e0b;word-break:break-all;">${resetUrl}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}

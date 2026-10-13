const nodemailer = require('nodemailer');
require('dotenv').config();

const clean = (val) => typeof val === 'string' ? val.replace(/^[\"']|[\"']$/g, '').trim() : val;

function createTransporter() {
  const smtpHost = clean(process.env.SMTP_HOST) || 'smtp.gmail.com';
  const smtpPort = parseInt(clean(process.env.SMTP_PORT) || '587');
  const smtpSecure = clean(process.env.SMTP_SECURE);
  // port 465 = SSL; port 587 = STARTTLS (secure: false + requireTLS)
  const isSecure = smtpSecure === 'true' || smtpSecure === 'ssl' || smtpPort === 465;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: isSecure,
    requireTLS: !isSecure,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: clean(process.env.SMTP_PASS),
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

// Lazy transporter — created on first use
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = createTransporter();
  }
  return _transporter;
}

// Verify SMTP connection on startup (non-blocking)
setTimeout(() => {
  const t = getTransporter();
  t.verify((error) => {
    if (error) {
      console.error('[EMAIL] SMTP connection failed:', error.code, error.message);
      _transporter = null; // reset so next call retries
    } else {
      console.log('[EMAIL] SMTP server is ready to send emails');
    }
  });
}, 2000);

/**
 * Sends a welcome email to a new user.
 */
async function sendWelcomeEmail(email, nome, password) {
  try {
    const frontendUrl = clean(process.env.FRONTEND_URL) || 'https://gestao.scalabrinianos.com';
    const resetUrl = `${frontendUrl}/#/reset-password`;

    const info = await getTransporter().sendMail({
      from: `"Sistema Scalabrinianos" <${clean(process.env.SMTP_FROM) || clean(process.env.SMTP_USER)}>`,
      to: email,
      subject: "Seja bem-vindo ao Sistema Scalabrinianos",
      text: `Olá ${nome},\n\nSeu cadastro no Sistema Scalabrinianos foi realizado com sucesso.\n\nPara o seu primeiro acesso, utilize as credenciais abaixo:\n\nE-mail: ${email}\nSenha: ${password}\n\nSe desejar redefinir sua senha antes do primeiro login, acesse:\n${resetUrl}\n\nRecomendamos que você altere sua senha após o primeiro login.\n\nAtenciosamente,\nEquipe Scalabrinianos`,
      html: `
        <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #f8fafc; padding: 32px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%); padding: 32px; color: #ffffff;">
              <h1 style="margin: 0; font-size: 28px; letter-spacing: -0.5px;">Bem-vindo, ${nome}</h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: rgba(255,255,255,0.85);">Seu acesso ao Sistema Scalabrinianos foi criado com sucesso.</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 18px;">Olá <strong>${nome}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.8; color: #475569; margin: 0 0 24px;">Seu cadastro no <strong>Scalabrinianos</strong> está pronto. Use as credenciais abaixo para o primeiro acesso ao sistema:</p>
              <div style="border: 1px solid #e2e8f0; border-radius: 18px; padding: 22px; background: #f8fafc; margin-bottom: 28px;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #334155;"><strong>E-mail</strong>: ${email}</p>
                <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Senha</strong>: ${password}</p>
              </div>
              <a href="${resetUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 14px 26px; border-radius: 999px; text-decoration: none; font-weight: 700; box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);">Redefinir minha senha</a>
              <p style="margin: 24px 0 0; color: #64748b; font-size: 14px; line-height: 1.7;">Recomendamos que você altere sua senha após o primeiro login para manter sua conta segura.</p>
            </div>
            <div style="background: #f8fafc; padding: 24px 32px; color: #64748b; font-size: 13px;">
              <p style="margin: 0;">Atenciosamente,<br/><strong>Equipe Scalabrinianos</strong></p>
            </div>
          </div>
        </div>
      `,
    });
    console.log("[EMAIL] Welcome email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending welcome email:", error.code, error.message);
    return false;
  }
}

/**
 * Sends a first-access notification email to Registro Regional users.
 */
async function sendFirstAccessNotification(recipientEmail, missionarioNome, missionarioEmail, accessedAt) {
  try {
    const dateStr = accessedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = accessedAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await getTransporter().sendMail({
      from: `"Sistema Scalabrinianos" <${clean(process.env.SMTP_FROM) || clean(process.env.SMTP_USER)}>`,
      to: recipientEmail,
      subject: `🔔 Primeiro Acesso — ${missionarioNome}`,
      text: `Notificação de Primeiro Acesso\n\nO missionário abaixo realizou seu primeiro acesso ao Sistema Scalabrinianos:\n\nNome: ${missionarioNome}\nE-mail: ${missionarioEmail}\nData: ${dateStr}\nHorário: ${timeStr}\n\nAtenciosamente,\nEquipe Scalabrinianos`,
      html: `
        <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #f8fafc; padding: 32px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #7c3aed 100%); padding: 32px; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; letter-spacing: -0.5px;">🔔 Notificação de Primeiro Acesso</h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">Sistema Scalabrinianos — Registro Regional</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 15px; color: #475569; margin: 0 0 24px; line-height: 1.7;">
                Um missionário realizou seu <strong style="color: #1d4ed8;">primeiro acesso</strong> ao sistema.
              </p>
              <div style="border: 1.5px solid #e0e7ff; border-radius: 18px; padding: 24px; background: #f5f3ff; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6b7280; font-weight: 600; width: 100px;">Nome</td>
                    <td style="padding: 8px 0; font-size: 15px; color: #111827; font-weight: 700;">${missionarioNome}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6b7280; font-weight: 600;">E-mail</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #374151;">${missionarioEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Data</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #374151;">${dateStr}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6b7280; font-weight: 600;">Horário</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #374151;">${timeStr} (horário de Brasília)</td>
                  </tr>
                </table>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 20px 32px; color: #64748b; font-size: 13px;">
              <p style="margin: 0;">Atenciosamente,<br/><strong>Equipe Scalabrinianos</strong></p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[EMAIL] First-access notification sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send first-access notification:`, error.code, error.message);
    return false;
  }
}

/**
 * Sends a password recovery email to a user.
 */
async function sendPasswordResetEmail(email, nome) {
  const frontendUrl = clean(process.env.FRONTEND_URL) || 'https://gestao.scalabrinianos.com';
  const resetUrl = `${frontendUrl}/#/reset-password`;
  const fromAddr = clean(process.env.SMTP_FROM) || clean(process.env.SMTP_USER);

  console.log(`[EMAIL] Sending password reset to ${email} via ${clean(process.env.SMTP_HOST)}:${clean(process.env.SMTP_PORT)}`);

  const info = await getTransporter().sendMail({
    from: `"Sistema Scalabrinianos" <${fromAddr}>`,
    to: email,
    subject: "Recuperação de Senha — Sistema Scalabrinianos",
    text: `Olá ${nome},\n\nRecebemos uma solicitação de recuperação de senha.\n\nPara cadastrar uma nova senha, acesse:\n${resetUrl}\n\nSe você não solicitou esta alteração, desconsidere este e-mail.\n\nAtenciosamente,\nEquipe Scalabrinianos`,
    html: `
      <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #f8fafc; padding: 32px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%); padding: 32px; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">Recuperação de Senha</h1>
            <p style="margin: 8px 0 0; font-size: 15px; color: rgba(255,255,255,0.85);">Sistema Scalabrinianos</p>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; margin: 0 0 18px;">Olá <strong>${nome}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.8; color: #475569; margin: 0 0 24px;">Recebemos uma solicitação de recuperação de senha para a sua conta no <strong>Sistema Scalabrinianos</strong>.</p>
            <div style="margin-bottom: 28px; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 700; box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);">Redefinir Minha Senha</a>
            </div>
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.7;">Se você não solicitou esta redefinição, desconsidere este e-mail. Sua senha continuará a mesma.</p>
          </div>
          <div style="background: #f8fafc; padding: 24px 32px; color: #64748b; font-size: 13px;">
            <p style="margin: 0;">Atenciosamente,<br/><strong>Equipe Scalabrinianos</strong></p>
          </div>
        </div>
      </div>
    `,
  });

  console.log(`[EMAIL] Password reset email sent to ${email}: ${info.messageId}`);
  return true;
}

const escapeHtml = (val) => String(val ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Envia à Sede Regional o pedido de correção de dados/documentos feito pelo missionário.
 */
async function sendCorrecaoDadosEmail(recipientEmail, { missionarioNome, missionarioEmail, secao, campos = [], descricao, enviadoEm }) {
  try {
    const dateStr = enviadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = enviadoEm.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const row = (label, value) => `
                  <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #6b7280; font-weight: 600; width: 110px; vertical-align: top;">${label}</td>
                    <td style="padding: 8px 0; font-size: 14px; color: #111827;">${value}</td>
                  </tr>`;

    await getTransporter().sendMail({
      from: `"Sistema Scalabrinianos" <${clean(process.env.SMTP_FROM) || clean(process.env.SMTP_USER)}>`,
      to: recipientEmail,
      replyTo: missionarioEmail || undefined,
      subject: `Pedido de correção de dados — ${missionarioNome}`,
      text: `Pedido de correção de dados\n\nO missionário abaixo informou dados ou documentos incorretos no seu cadastro:\n\nMissionário: ${missionarioNome}\nE-mail: ${missionarioEmail || '-'}\nSeção: ${secao}\nCampos a alterar: ${campos.join(', ') || '-'}\nData: ${dateStr}\nHorário: ${timeStr} (horário de Brasília)\n\nObservação:\n${descricao}\n\nAtenciosamente,\nSistema Scalabrinianos`,
      html: `
        <div style="font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; background: #f8fafc; padding: 32px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
            <div style="background: linear-gradient(135deg, #013375 0%, #b45309 100%); padding: 32px; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; letter-spacing: -0.5px;">Pedido de correção de dados</h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">Sistema Scalabrinianos — Sede Regional</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 15px; color: #475569; margin: 0 0 24px; line-height: 1.7;">
                Um missionário informou <strong>dados ou documentos incorretos</strong> no seu cadastro.
              </p>
              <div style="border: 1.5px solid #fde68a; border-radius: 18px; padding: 24px; background: #fffbeb; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${row('Missionário', `<strong>${escapeHtml(missionarioNome)}</strong>`)}
                  ${row('E-mail', escapeHtml(missionarioEmail || '-'))}
                  ${row('Seção', escapeHtml(secao))}
                  ${row('Campos a alterar', campos.length ? campos.map(c => `<span style="display: inline-block; margin: 0 6px 6px 0; padding: 3px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 13px; font-weight: 700;">${escapeHtml(c)}</span>`).join('') : '-')}
                  ${row('Data', dateStr)}
                  ${row('Horário', `${timeStr} (horário de Brasília)`)}
                </table>
              </div>
              <p style="font-size: 13px; color: #6b7280; font-weight: 600; margin: 0 0 8px;">Observação do missionário</p>
              <div style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; background: #f8fafc; font-size: 14px; color: #1f2937; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(descricao)}</div>
            </div>
            <div style="background: #f8fafc; padding: 20px 32px; color: #64748b; font-size: 13px;">
              <p style="margin: 0;">Responda este e-mail para falar diretamente com o missionário.<br/><strong>Sistema Scalabrinianos</strong></p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[EMAIL] Correction request sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send correction request:', error.code, error.message);
    return false;
  }
}

module.exports = { sendWelcomeEmail, sendFirstAccessNotification, sendPasswordResetEmail, sendCorrecaoDadosEmail };

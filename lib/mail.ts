import nodemailer from 'nodemailer';
import { AppError } from './security';
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  messageId: string,
) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM)
    throw new AppError(503, 'Email delivery is not configured');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    messageId: `<${messageId}@relay-crm.local>`,
  });
}

// nucash-server/services/mailer.js
// The one place NUCash sends email from (emailService, login, adminauth and
// userdashboard all use it).
//
// With MAIL_FROM set to an address on our own domain (noreply@nucash.me), mail
// goes out through Amazon SES, signed for nucash.me, so Gmail and school
// inboxes trust it. If SES turns a message down — until AWS approves the
// account it only delivers to verified addresses — or SES is unreachable, the
// same message goes out through the Gmail account instead. Without MAIL_FROM
// everything uses Gmail, as before.
//
// SES needs no password here: the server's AWS role (nucash-server-ses) may
// send as nucash.me. Replies go to MAIL_REPLY_TO, or the Gmail inbox.
// EMAIL_DISABLED=1 (test servers): nothing is sent; the message is logged.

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const DISABLED = process.env.EMAIL_DISABLED === '1';
const MAIL_FROM = (process.env.MAIL_FROM || '').trim();
const REPLY_TO = (process.env.MAIL_REPLY_TO || process.env.EMAIL_USER || '').trim();

// Pooled connections, starting at most 1 email/second: bursts (e.g. a full
// shuttle boarding, or test runs) look like bulk mail to Gmail and push our
// messages toward spam (a burst on 2026-09-18 got "421 try again later").
// 3 connections so the queue still drains when Gmail is slow to accept.
const gmail = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  pool: true,
  maxConnections: 3,
  rateDelta: 1000,
  rateLimit: 1
});

let ses = null;
if (MAIL_FROM && !DISABLED) {
  const aws = await import('@aws-sdk/client-ses');
  ses = nodemailer.createTransport({
    SES: { ses: new aws.SESClient({ region: process.env.SES_REGION || 'ap-southeast-1' }), aws },
    sendingRate: 1 // the account's limit while AWS reviews it
  });
}

// Keep the sender's display name ("NUCash System", "NUCash Support") but send
// from our own address, which is the one SES is allowed to sign for.
const fromOurDomain = (from) => {
  const name = String(from || '').match(/^\s*"?([^"<]*?)"?\s*</)?.[1]?.trim() || 'NUCash';
  return `"${name}" <${MAIL_FROM}>`;
};

async function sendMail(options) {
  if (DISABLED) {
    const code = String(options.text || options.html || '').match(/\b\d{6}\b/);
    console.log('[EMAIL_DISABLED] would send:', options.to, '|', options.subject, code ? `| code ${code[0]}` : '');
    return { messageId: 'disabled' };
  }
  if (ses) {
    try {
      return await ses.sendMail({
        ...options,
        from: fromOurDomain(options.from),
        replyTo: options.replyTo || REPLY_TO || undefined
      });
    } catch (error) {
      console.warn(`⚠️ SES did not send "${options.subject}" (${error.name || error.code}: ${error.message}); sending through Gmail`);
    }
  }
  return gmail.sendMail(options);
}

if (!DISABLED) {
  gmail.verify((error) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error.message);
      console.error('   Check EMAIL_USER and EMAIL_PASSWORD in .env file');
      console.error('   For Gmail, you need an App Password (not your regular password)');
      console.error('   Go to: https://myaccount.google.com/apppasswords');
    } else {
      console.log(ses
        ? `✅ Email ready: sending as ${MAIL_FROM} through Amazon SES, Gmail as backup`
        : '✅ Email transporter is ready to send emails');
    }
  });
}

export default { sendMail };

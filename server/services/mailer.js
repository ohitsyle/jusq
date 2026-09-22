// nucash-server/services/mailer.js
// The one place NUCash sends email from (emailService, login, adminauth and
// userdashboard all use it).
//
// With MAIL_FROM set to an address on our own domain (noreply@nucash.me), mail
// goes out through a sending service that signs it for nucash.me, so Gmail and
// school inboxes trust it:
//   SMTP_HOST set  -> that SMTP relay (Brevo: smtp-relay.brevo.com, with
//                     SMTP_USER / SMTP_PASS from Brevo's "SMTP & API" page)
//   otherwise      -> Amazon SES, through the server's AWS role
//                     (nucash-server-ses; no password stored)
// If the service turns a message down (daily limit, not approved yet, outage),
// the same message goes out through the Gmail account instead. Without
// MAIL_FROM everything uses Gmail, as before.
//
// Replies go to MAIL_REPLY_TO, or the Gmail inbox.
// EMAIL_DISABLED=1 (test servers): nothing is sent; the message is logged.

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const DISABLED = process.env.EMAIL_DISABLED === '1';
const MAIL_FROM = (process.env.MAIL_FROM || '').trim();
const REPLY_TO = (process.env.MAIL_REPLY_TO || process.env.EMAIL_USER || '').trim();
const SMTP_HOST = (process.env.SMTP_HOST || '').trim();

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

let primary = null;
let primaryName = '';
if (MAIL_FROM && !DISABLED) {
  if (SMTP_HOST) {
    primaryName = SMTP_HOST;
    primary = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true,
      maxConnections: 2
    });
  } else {
    primaryName = 'Amazon SES';
    const aws = await import('@aws-sdk/client-ses');
    primary = nodemailer.createTransport({
      SES: { ses: new aws.SESClient({ region: process.env.SES_REGION || 'ap-southeast-1' }), aws },
      sendingRate: 1 // the account's limit while AWS reviews it
    });
  }
}

// Keep the sender's display name ("NUCash System", "NUCash Support") but send
// from our own address, which is the one the service is allowed to sign for.
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
  if (primary) {
    try {
      return await primary.sendMail({
        ...options,
        from: fromOurDomain(options.from),
        replyTo: options.replyTo || REPLY_TO || undefined
      });
    } catch (error) {
      console.warn(`⚠️ ${primaryName} did not send "${options.subject}" (${error.name || error.code}: ${error.message}); sending through Gmail`);
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
      console.log(primary
        ? `✅ Email ready: sending as ${MAIL_FROM} through ${primaryName}, Gmail as backup`
        : '✅ Email transporter is ready to send emails');
    }
  });
  // SES has no login to check; an SMTP relay does
  if (primary && SMTP_HOST) {
    primary.verify((error) => {
      if (error) console.error(`❌ ${SMTP_HOST} sign-in failed (${error.message}); emails will go through Gmail`);
    });
  }
}

export default { sendMail };

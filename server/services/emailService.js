// nucash-server/services/emailService.js
// FIXED: Added sendPinChangeOtpEmail function for PIN change with OTP

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create email transporter (using Gmail - you can change this)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error.message);
    console.error('   Check EMAIL_USER and EMAIL_PASSWORD in .env file');
    console.error('   For Gmail, you need an App Password (not your regular password)');
    console.error('   Go to: https://myaccount.google.com/apppasswords');
  } else {
    console.log('✅ Email transporter is ready to send emails');
  }
});

/**
 * Send payment receipt email
 */
export const sendReceipt = async (transaction) => {
  const { 
    userEmail, 
    userName, 
    fareAmount, 
    previousBalance, 
    newBalance, 
    timestamp, 
    merchantName, 
    driverName, 
    transactionId 
  } = transaction;

  if (!userEmail) {
    console.log('⚠️ No email for user, skipping receipt');
    return;
  }

  const wentNegative = newBalance < 0;
  const isAtLimit = newBalance <= -14;

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; font-weight: 500; }
    .value { color: #333; font-weight: 600; }
    .amount-paid { background: #181D40; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .amount-paid .label { color: rgba(255,255,255,0.8); font-size: 14px; }
    .amount-paid .value { color: #FFD41C; font-size: 28px; }
    .balance-row { background: #F8F9FA; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #E5E7EB; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
    .warning-box { background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #ff9800; }
    .warning-box strong { color: #f57c00; }
    .warning-box p { margin: 5px 0 0 0; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 NUCash Receipt</h1>
      <p>Payment Confirmation</p>
    </div>
    
    <div class="receipt-row">
      <span class="label">Transaction ID:</span>
      <span class="value">${transactionId}</span>
    </div>
    
    <div class="receipt-row">
      <span class="label">Date & Time:</span>
      <span class="value">${new Date(timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}</span>
    </div>
    
    <div class="receipt-row">
      <span class="label">Name:</span>
      <span class="value">${userName}</span>
    </div>
    
    ${merchantName ? `
    <div class="receipt-row">
      <span class="label">Merchant:</span>
      <span class="value">${merchantName}</span>
    </div>
    ` : ''}
    
    ${driverName ? `
    <div class="receipt-row">
      <span class="label">Driver:</span>
      <span class="value">${driverName}</span>
    </div>
    ` : ''}
    
    <div class="amount-paid">
      <div class="receipt-row" style="border: none;">
        <span class="label" style="font-size: 18px;">Amount Paid:</span>
        <span class="value">₱${fareAmount.toFixed(2)}</span>
      </div>
    </div>

    <div class="balance-row">
      <div class="receipt-row" style="border: none; margin-bottom: 8px;">
        <span class="label">Previous Balance:</span>
        <span class="value">₱${previousBalance.toFixed(2)}</span>
      </div>
      <div class="receipt-row" style="border: none;">
        <span class="label">New Balance:</span>
        <span class="value" style="color: ${newBalance < 0 ? '#EF4444' : '#22C55E'};">₱${newBalance.toFixed(2)}</span>
      </div>
    </div>
    
    ${wentNegative ? `
    <div class="warning-box">
      <strong>⚠️ Negative Balance Active</strong>
      <p>${isAtLimit 
        ? 'Your balance has reached the limit. Please recharge your NUCash account at the earliest.' 
        : 'Your balance is negative. Please recharge your NUCash account soon to continue using the service.'
      }</p>
    </div>
    ` : ''}
    
    <div class="footer">
      <p><strong style="color: #181D40;">Thank you for using NUCash!</strong></p>
      <p>This is an automated receipt. Please do not reply to this email.</p>
      <p style="margin-top: 15px;">National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `NUCash Receipt - ₱${fareAmount.toFixed(2)} Payment`,
    html: emailContent,
    text: `NUCash Receipt - Payment of ₱${fareAmount.toFixed(2)} confirmed. New Balance: ₱${newBalance.toFixed(2)}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Receipt sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Email send error:', error.message);
  }
};

/**
 * Send refund receipt email
 */
export const sendRefundReceipt = async (refundData) => {
  const { 
    userEmail, 
    userName, 
    refundAmount, 
    previousBalance,
    newBalance, 
    timestamp, 
    transactionId,
    originalTransactionId,
    reason
  } = refundData;

  if (!userEmail) {
    console.log('⚠️ No email for user, skipping refund receipt');
    return;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; font-weight: 500; }
    .value { color: #333; font-weight: 600; }
    .refund-amount { background: #181D40; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .refund-amount .label { color: rgba(255,255,255,0.8); font-size: 14px; }
    .refund-amount .value { color: #22C55E; font-size: 28px; }
    .balance-row { background: #F8F9FA; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #E5E7EB; }
    .info-box { background: #DCFCE7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #22C55E; }
    .info-box strong { color: #166534; }
    .info-box p { margin: 5px 0 0 0; color: #666; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 NUCash Refund</h1>
      <p>Refund Confirmation</p>
    </div>
    
    <div class="receipt-row">
      <span class="label">Refund ID:</span>
      <span class="value">${transactionId}</span>
    </div>

    ${originalTransactionId ? `
    <div class="receipt-row">
      <span class="label">Original Transaction:</span>
      <span class="value">${originalTransactionId}</span>
    </div>
    ` : ''}
    
    <div class="receipt-row">
      <span class="label">Date & Time:</span>
      <span class="value">${new Date(timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}</span>
    </div>
    
    <div class="receipt-row">
      <span class="label">Name:</span>
      <span class="value">${userName}</span>
    </div>

    ${reason ? `
    <div class="receipt-row">
      <span class="label">Reason:</span>
      <span class="value">${reason}</span>
    </div>
    ` : ''}
    
    <div class="refund-amount">
      <div class="receipt-row" style="border: none;">
        <span class="label" style="font-size: 18px;">Refund Amount:</span>
        <span class="value">+₱${refundAmount.toFixed(2)}</span>
      </div>
    </div>

    <div class="balance-row">
      <div class="receipt-row" style="border: none; margin-bottom: 8px;">
        <span class="label">Previous Balance:</span>
        <span class="value">₱${previousBalance.toFixed(2)}</span>
      </div>
      <div class="receipt-row" style="border: none;">
        <span class="label">New Balance:</span>
        <span class="value" style="color: #22C55E;">₱${newBalance.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="info-box">
      <strong>✅ Refund Processed</strong>
      <p>Your refund has been successfully processed and credited to your NUCash account.</p>
    </div>
    
    <div class="footer">
      <p><strong style="color: #181D40;">Thank you for using NUCash!</strong></p>
      <p>This is an automated receipt. Please do not reply to this email.</p>
      <p style="margin-top: 15px;">National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `NUCash Refund - ₱${refundAmount.toFixed(2)} Credited`,
    html: emailContent,
    text: `NUCash Refund - ₱${refundAmount.toFixed(2)} has been credited to your account. New Balance: ₱${newBalance.toFixed(2)}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Refund receipt sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Refund email error:', error.message);
  }
};

/**
 * Send generic email
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    console.log('⚠️ No recipient email provided, skipping email');
    return;
  }

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: html || text,
    text: text || undefined
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    throw error;
  }
};

/**
 * Send account activation OTP email
 */
export const sendActivationOTP = async (email, otp, fullName) => {
  if (!email) {
    console.log('⚠️ No email provided, skipping OTP');
    return;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .otp-box { background: #181D40; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #FFD41C; margin: 15px 0; font-family: monospace; }
    .otp-label { color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 600; margin: 0; }
    .otp-expiry { color: rgba(255,255,255,0.6); font-size: 13px; margin: 10px 0 0 0; }
    .info-box { background: #F0F9FF; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
    .info-box strong { color: #1D4ED8; }
    .warning-box { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
    .warning-box strong { color: #D97706; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Account Activation</h1>
      <p>NUCash System</p>
    </div>

    <p>Hello <strong>${fullName}</strong>,</p>

    <p>Welcome to NUCash! Your account is almost ready. Please verify your email address to complete the activation process.</p>

    <div class="otp-box">
      <p class="otp-label">Your Verification Code</p>
      <div class="otp-code">${otp}</div>
      <p class="otp-expiry">Valid for 10 minutes</p>
    </div>

    <div class="info-box">
      <strong>📝 How to use this code:</strong>
      <ol style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>Return to the activation page</li>
        <li>Enter the 6-digit code above</li>
        <li>Click "Verify & Activate"</li>
      </ol>
    </div>

    <div class="warning-box">
      <strong>⚠️ Security Notice:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>This code expires in <strong>10 minutes</strong></li>
        <li>Never share this code with anyone</li>
        <li>NUCash staff will never ask for this code</li>
        <li>If you didn't request this, please ignore this email</li>
      </ul>
    </div>

    <p>If you didn't request account activation, please disregard this email. Your account will remain inactive.</p>

    <p>Need help? Contact us at <a href="mailto:nucashsystem@gmail.com" style="color: #FFD41C; text-decoration: none; font-weight: 600;">nucashsystem@gmail.com</a></p>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash System</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 NUCash Account Activation - Verification Code',
    html: emailContent,
    text: `Your NUCash verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Activation OTP sent to ${email}`);
  } catch (error) {
    console.error('❌ Activation OTP send error:', error.message);
    throw error;
  }
};

/**
 * Send temporary PIN email for new user registration
 */
export const sendTemporaryPIN = async (email, pin, fullName, schoolUId) => {
  if (!email) {
    console.log('⚠️ No email provided, skipping PIN email');
    return false;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .welcome-box { background: #F8F9FA; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; border: 1px solid #E5E7EB; }
    .welcome-box h2 { color: #181D40; margin: 0 0 10px 0; }
    .pin-box { background: #181D40; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .pin-code { font-size: 48px; font-weight: bold; letter-spacing: 15px; color: #FFD41C; margin: 10px 0; font-family: monospace; }
    .pin-label { color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 600; margin: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; font-weight: 500; }
    .value { color: #333; font-weight: 600; }
    .steps-box { background: #F0F9FF; padding: 20px; border-left: 4px solid #3B82F6; margin: 20px 0; }
    .steps-box h3 { color: #1D4ED8; margin: 0 0 15px 0; }
    .steps-box ol { margin: 0; padding-left: 20px; }
    .steps-box li { margin: 8px 0; color: #333; }
    .warning-box { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
    .warning-box strong { color: #D97706; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Welcome to NUCash!</h1>
      <p>Your Digital Campus Wallet</p>
    </div>

    <div class="welcome-box">
      <h2>Hello, ${fullName}!</h2>
      <p>Your NUCash account has been created successfully.</p>
    </div>

    <div class="info-row">
      <span class="label">School ID:</span>
      <span class="value">${schoolUId}</span>
    </div>

    <div class="info-row">
      <span class="label">Email:</span>
      <span class="value">${email}</span>
    </div>

    <p style="margin-top: 20px;">Here is your temporary PIN to access your account:</p>

    <div class="pin-box">
      <p class="pin-label">Your Temporary PIN</p>
      <div class="pin-code">${pin}</div>
    </div>

    <div class="steps-box">
      <h3>📝 Next Steps:</h3>
      <ol>
        <li>Open the NUCash app or website</li>
        <li>Log in using your email and temporary PIN</li>
        <li>You will be prompted to change your PIN</li>
        <li>Create a new 6-digit PIN that only you know</li>
        <li>Your account will be activated after changing the PIN</li>
      </ol>
    </div>

    <div class="warning-box">
      <strong>⚠️ Important Security Notice:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>This temporary PIN is for <strong>first-time login only</strong></li>
        <li>You <strong>must change your PIN</strong> after your first login</li>
        <li>Never share your PIN with anyone</li>
        <li>NUCash staff will never ask for your PIN</li>
      </ul>
    </div>

    <p>If you did not request a NUCash account, please contact us immediately at <a href="mailto:nucashsystem@gmail.com" style="color: #FFD41C; text-decoration: none; font-weight: 600;">nucashsystem@gmail.com</a></p>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash System</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🎓 Welcome to NUCash - Your Temporary PIN',
    html: emailContent,
    text: `Welcome to NUCash, ${fullName}! Your temporary PIN is: ${pin}. Please change it after your first login.`
  };

  try {
    console.log(`📧 Attempting to send temporary PIN email to ${email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Temporary PIN email sent to ${email}`);
    console.log(`   Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Temporary PIN email error:', error.message);
    console.error('   Full error:', error);
    return false;
  }
};

/**
 * Send PIN change OTP email
 */
export const sendPinChangeOtpEmail = async (email, userName, otp) => {
  if (!email) {
    console.log('⚠️ No email provided, skipping PIN change OTP');
    return false;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .otp-box { background: #181D40; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #FFD41C; margin: 15px 0; font-family: monospace; }
    .otp-label { color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 600; margin: 0; }
    .otp-expiry { color: rgba(255,255,255,0.6); font-size: 13px; margin: 10px 0 0 0; }
    .info-box { background: #F0F9FF; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
    .info-box strong { color: #1D4ED8; }
    .warning-box { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
    .warning-box strong { color: #D97706; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 PIN Change Request</h1>
      <p>NUCash Verification Code</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>

    <p>You have requested to change your NUCash PIN. To proceed with this change, please use the verification code below:</p>

    <div class="otp-box">
      <p class="otp-label">Your Verification Code</p>
      <div class="otp-code">${otp}</div>
      <p class="otp-expiry">Valid for 10 minutes</p>
    </div>

    <div class="info-box">
      <strong>🔒 Security Reminder:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>This code is valid for <strong>10 minutes</strong></li>
        <li>Never share this code with anyone</li>
        <li>NUCash staff will never ask for this code</li>
      </ul>
    </div>

    <div class="warning-box">
      <strong>⚠️ If you did not request this:</strong>
      <p style="margin: 5px 0 0 0;">Please ignore this email and ensure your account is secure. If you suspect unauthorized access, contact us immediately at <a href="mailto:nucashsystem@gmail.com" style="color: #F59E0B; text-decoration: none; font-weight: 600;">nucashsystem@gmail.com</a></p>
    </div>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash System</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 NUCash - PIN Change Verification Code',
    html: emailContent,
    text: `Your NUCash PIN change verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ PIN change OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ PIN change OTP email error:', error.message);
    throw error;
  }
};

/**
 * Send concern status update email (In Progress)
 */
export const sendConcernInProgressEmail = async (userEmail, userName, concernData) => {
  if (!userEmail) {
    console.log('⚠️ No email provided, skipping concern update email');
    return false;
  }

  const { concernId, subject, reportTo } = concernData;

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #FFD41C; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .status-box { background: #181D40; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .status-box .status-icon { font-size: 36px; margin-bottom: 10px; }
    .status-box .status-text { font-size: 18px; font-weight: bold; color: #FFD41C; margin: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; font-weight: 500; }
    .value { color: #333; font-weight: 600; }
    .message-box { background: #F0F9FF; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3B82F6; }
    .message-box h3 { color: #1D4ED8; margin: 0 0 10px 0; }
    .message-box p { margin: 0; color: #333; line-height: 1.6; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Concern Update</h1>
      <p>NUCash Support Team</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>

    <p>We wanted to let you know that your concern is now being reviewed by our team.</p>

    <div class="status-box">
      <div class="status-icon">📋</div>
      <p class="status-text">IN PROGRESS</p>
    </div>

    <div class="info-row">
      <span class="label">Reference ID:</span>
      <span class="value" style="font-family: monospace;">${concernId}</span>
    </div>

    <div class="info-row">
      <span class="label">Subject:</span>
      <span class="value">${subject}</span>
    </div>

    <div class="info-row">
      <span class="label">Assigned To:</span>
      <span class="value">${reportTo}</span>
    </div>

    <div class="message-box">
      <h3>📝 What's Next?</h3>
      <p>Our team is currently looking into your concern. We'll get back to you with a resolution as soon as possible.</p>
      <p style="margin-top: 10px;">You can track the status of your concern anytime by logging into your NUCash dashboard and visiting the "My Concerns" section.</p>
    </div>

    <p>Thank you for your patience!</p>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash Support Team</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash Support" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `🔄 Your Concern is Being Reviewed - ${concernId}`,
    html: emailContent,
    text: `Your concern (${concernId}) is now being reviewed. Subject: ${subject}. We'll get back to you soon.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Concern in-progress email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Concern in-progress email error:', error.message);
    return false;
  }
};

/**
 * Send concern note email (while in progress)
 */
export const sendConcernNoteEmail = async (userEmail, userName, concernData) => {
  if (!userEmail) {
    console.log('⚠️ No email provided, skipping concern note email');
    return false;
  }

  const { concernId, subject, reportTo, noteMessage, adminName, noteTimestamp } = concernData;

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: #181D40;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #FFD41C;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.7);
    }
    .content {
      padding: 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .info-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: #6B7280;
      font-weight: 600;
    }
    .info-value {
      color: #111827;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(59, 130, 246, 0.1);
      color: #3B82F6;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .note-box {
      background: white;
      border-left: 4px solid #3B82F6;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .note-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    .note-from {
      color: #3B82F6;
      font-weight: 700;
      font-size: 14px;
    }
    .note-time {
      color: #9CA3AF;
      font-size: 12px;
    }
    .note-message {
      color: #374151;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message-text {
      margin: 16px 0;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      padding: 20px 30px;
      background: #F9FAFB;
      border-top: 1px solid #E5E7EB;
    }
    .footer p {
      margin: 4px 0;
      font-size: 12px;
      color: #6B7280;
    }
    .divider {
      height: 1px;
      background: #E5E7EB;
      margin: 24px 0;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .content {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 Concern Update</h1>
      <p>We have an update regarding your concern</p>
    </div>
    
    <div class="content">
      <p class="greeting">Hi <strong>${userName}</strong>,</p>
      
      <p class="message-text">
        We wanted to update you regarding your concern to the <strong>${reportTo}</strong>. 
        Your concern is currently being reviewed and we're working on it.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Concern ID:</span>
          <span class="info-value">${concernId || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subject:</span>
          <span class="info-value">${subject}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="status-badge">In Progress</span>
        </div>
      </div>

      <div class="note-box">
        <div class="note-header">
          <span class="note-from">📨 Update from ${adminName}</span>
          <span class="note-time">${new Date(noteTimestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}</span>
        </div>
        <div class="note-message">${noteMessage}</div>
      </div>

      <div class="divider"></div>

      <p class="message-text">
        We're actively working on your concern. If you have any additional information or questions, 
        please feel free to submit another concern or contact the ${reportTo} directly.
      </p>

      <p class="message-text" style="margin-top: 24px; font-size: 14px; color: #6B7280;">
        Thank you for your patience as we work to address your concern.
      </p>
    </div>

    <div class="footer">
      <p><strong>This is an automated message from the ${reportTo}</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash Support" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `💬 Update on Your Concern: ${subject}`,
    html: emailContent,
    text: `Update on your concern (${concernId}): ${noteMessage.substring(0, 100)}...`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Concern note email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Concern note email error:', error.message);
    return false;
  }
};

/**
 * Send concern resolved email with admin reply
 */
export const sendConcernResolvedEmail = async (userEmail, userName, concernData) => {
  if (!userEmail) {
    console.log('⚠️ No email provided, skipping concern resolved email');
    return false;
  }

  const { concernId, subject, reportTo, adminReply, resolvedBy } = concernData;

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #22C55E; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .status-box { background: #22C55E; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .status-box .status-icon { font-size: 36px; margin-bottom: 10px; }
    .status-box .status-text { font-size: 18px; font-weight: bold; color: #FFFFFF; margin: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; font-weight: 500; }
    .value { color: #333; font-weight: 600; }
    .reply-box { background: #DCFCE7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #22C55E; }
    .reply-box h3 { color: #166534; margin: 0 0 15px 0; }
    .reply-box .reply-content { color: #333; white-space: pre-wrap; line-height: 1.6; background: white; padding: 15px; border-radius: 8px; border: 1px solid #BBF7D0; }
    .next-steps { background: #F0F9FF; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
    .next-steps p { margin: 0; color: #333; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Concern Resolved</h1>
      <p>NUCash Support Team</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>

    <p>Great news! Your concern has been reviewed and resolved by our team.</p>

    <div class="status-box">
      <div class="status-icon">✅</div>
      <p class="status-text">RESOLVED</p>
    </div>

    <div class="info-row">
      <span class="label">Reference ID:</span>
      <span class="value" style="font-family: monospace;">${concernId}</span>
    </div>

    <div class="info-row">
      <span class="label">Subject:</span>
      <span class="value">${subject}</span>
    </div>

    <div class="info-row">
      <span class="label">Handled By:</span>
      <span class="value">${reportTo}</span>
    </div>

    ${resolvedBy ? `
    <div class="info-row">
      <span class="label">Resolved By:</span>
      <span class="value">${resolvedBy}</span>
    </div>
    ` : ''}

    <div class="reply-box">
      <h3>📝 Response from ${reportTo}:</h3>
      <div class="reply-content">${adminReply}</div>
    </div>

    <div class="next-steps">
      <p>If you have any further questions or if the issue persists, please don't hesitate to submit a new concern through your NUCash dashboard.</p>
    </div>

    <p>Thank you for using NUCash!</p>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash Support Team</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"NUCash Support" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `✅ Your Concern Has Been Resolved - ${concernId}`,
    html: emailContent,
    text: `Your concern (${concernId}) has been resolved! Subject: ${subject}. Check your email for the full response.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Concern resolved email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Concern resolved email error:', error.message);
    return false;
  }
};

/**
 * Send deactivation OTP email
 */
export const sendDeactivationOtpEmail = async (email, userName, otp) => {
  const mailOptions = {
    from: `"NUCash System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '⚠️ NUCash - Account Deactivation Verification Code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; background: #181D40; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; padding: 30px; }
    .header h1 { color: #EF4444; margin: 0; }
    .header p { color: rgba(255,255,255,0.7); margin: 8px 0 0 0; }
    .otp-box { background: #181D40; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 12px; color: #EF4444; margin: 15px 0; font-family: monospace; }
    .otp-label { color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 600; margin: 0; }
    .otp-expiry { color: rgba(255,255,255,0.6); font-size: 13px; margin: 10px 0 0 0; }
    .warning-box { background: #FEF2F2; padding: 15px; border-left: 4px solid #EF4444; margin: 20px 0; }
    .warning-box strong { color: #DC2626; }
    .info-box { background: #F0F9FF; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
    .info-box strong { color: #1D4ED8; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Account Deactivation Request</h1>
      <p>NUCash Verification Code</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>

    <p>You have requested to deactivate your NUCash account. To proceed with this request, please use the verification code below:</p>

    <div class="otp-box">
      <p class="otp-label">Your Verification Code</p>
      <div class="otp-code">${otp}</div>
      <p class="otp-expiry">Valid for 10 minutes</p>
    </div>

    <div class="warning-box">
      <strong>⚠️ Important Warning:</strong>
      <p>Account deactivation will:</p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>Disable your ability to use NUCash services</li>
        <li>Require administrator approval to process</li>
        <li>Any remaining balance must be settled with the Treasury Office</li>
      </ul>
    </div>

    <div class="info-box">
      <strong>📝 If you did not request this:</strong>
      <p style="margin: 5px 0 0 0;">Please ignore this email and consider changing your PIN for security. Your account will remain active.</p>
    </div>

    <p>Need help? Contact the Treasury Office or email <a href="mailto:nucashsystem@gmail.com" style="color: #FFD41C; text-decoration: none; font-weight: 600;">nucashsystem@gmail.com</a></p>

    <div class="footer">
      <p><strong style="color: #181D40;">NUCash System</strong></p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Your NUCash deactivation code is: ${otp}. Valid for 10 minutes. Do not share this code.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Deactivation OTP sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send deactivation OTP email:', error);
    throw error;
  }
};

export default { 
  sendReceipt, 
  sendRefundReceipt, 
  sendEmail, 
  sendTemporaryPIN, 
  sendActivationOTP,
  sendPinChangeOtpEmail,
  sendConcernInProgressEmail, 
  sendConcernNoteEmail,
  sendConcernResolvedEmail, 
  sendDeactivationOtpEmail 
};
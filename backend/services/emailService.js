const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify email service connection
const verifyEmailService = async () => {
  try {
    await transporter.verify();
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};

// Send verification email
const sendVerificationEmail = async (email, token) => {
  try {
    // Check if FRONTEND_URL is set
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL environment variable is not set');
    }

    // Ensure the URL ends without a trailing slash
    const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"JustBet" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify your JustBet account',
      html: `
        <h1>Welcome to JustBet!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}" style="
          display: inline-block;
          padding: 10px 20px;
          background-color: #4CAF50;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        ">Verify Email</a>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

module.exports = {
  verifyEmailService,
  sendVerificationEmail
}; 
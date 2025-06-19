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
       <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #f0f0f5; color: #202020; padding: 20px 0; margin: 0; min-height: 100vh;">
  <center> <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="500" style="background: #1a1a2e; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4); overflow: hidden; margin: 0 auto;">
            <tr>
              <td style="background: linear-gradient(135deg, #4a00e0 0%, #8e2de2 100%); padding: 28px 0; text-align: center;">
                <span style="font-size: 2.5rem; font-weight: bold; color: #ffffff; letter-spacing: 1.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">JustBet</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px; color: #e0e0e0;">
                <h2 style="color: #ffffff; font-size: 1.8rem; margin-bottom: 16px; text-align: center;">Action Required: Verify Your Email</h2>
                <p style="color: #c0c0c0; font-size: 1.05rem; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                  Welcome to JustBet! To get started and ensure the security of your account, please verify your email address.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" style="display: inline-block; padding: 14px 35px; background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%); color: #ffffff; font-weight: bold; font-size: 1.15rem; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 15px rgba(0, 198, 255, 0.4); transition: all 0.3s ease;">
                    Verify My Email
                  </a>
                </div>
                <p style="color: #a0a0a0; font-size: 0.95rem; margin-top: 30px; text-align: center;">
                  Alternatively, you can copy and paste the link below into your browser:
                </p>
                <p style="word-break: break-all; color: #8e2de2; font-size: 0.95rem; margin: 8px 0 25px 0; text-align: center;">
                  <a href="${verificationUrl}" style="color: #8e2de2; text-decoration: none; font-weight: 500;">${verificationUrl}</a>
                </p>
                <div style="background: rgba(0, 198, 255, 0.1); color: #00c6ff; font-weight: bold; border-radius: 6px; padding: 12px 20px; margin-top: 25px; text-align: center; font-size: 0.9rem; border: 1px solid rgba(0, 198, 255, 0.3);">
                  This verification link is valid for the next 24 hours.
                </div>
                <p style="color: #a0a0a0; font-size: 0.9rem; margin-top: 25px; text-align: center;">
                  If you did not create a JustBet account, please disregard this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</div>
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

// Send password reset email
const sendPasswordResetEmail = async (email, token) => {
  try {
    // Check if FRONTEND_URL is set
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL environment variable is not set');
    }

    // Ensure the URL ends without a trailing slash
    const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"JustBet" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset your JustBet password',
      html: `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #f0f0f5; color: #202020; padding: 20px 0; margin: 0; min-height: 100vh;">
  <center>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="500" style="background: #1a1a2e; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4); overflow: hidden; margin: 0 auto;">
            <tr>
              <td style="background: linear-gradient(135deg, #4a00e0 0%, #8e2de2 100%); padding: 28px 0; text-align: center;">
                <span style="font-size: 2.5rem; font-weight: bold; color: #ffffff; letter-spacing: 1.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">JustBet</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px; color: #e0e0e0;">
                <h2 style="color: #ffffff; font-size: 1.8rem; margin-bottom: 16px; text-align: center;">Reset Your JustBet Password</h2>
                <p style="color: #c0c0c0; font-size: 1.05rem; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                  We received a request to reset the password for your JustBet account. If you made this request, click the button below to set a new password.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetUrl}" style="display: inline-block; padding: 14px 35px; background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%); color: #ffffff; font-weight: bold; font-size: 1.15rem; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 15px rgba(0, 198, 255, 0.4); transition: all 0.3s ease;">
                    Set New Password
                  </a>
                </div>
                <p style="color: #a0a0a0; font-size: 0.95rem; margin-top: 30px; text-align: center;">
                  Alternatively, you can copy and paste the link below into your browser:
                </p>
                <p style="word-break: break-all; color: #8e2de2; font-size: 0.95rem; margin: 8px 0 25px 0; text-align: center;">
                  <a href="${resetUrl}" style="color: #8e2de2; text-decoration: none; font-weight: 500;">${resetUrl}</a>
                </p>
                <div style="background: rgba(0, 198, 255, 0.1); color: #00c6ff; font-weight: bold; border-radius: 6px; padding: 12px 20px; margin-top: 25px; text-align: center; font-size: 0.9rem; border: 1px solid rgba(0, 198, 255, 0.3);">
                  This link is valid for 1 hour.
                </div>
                <p style="color: #a0a0a0; font-size: 0.9rem; margin-top: 25px; text-align: center;">
                  If you did not request a password reset, please ignore this email. Your account remains secure.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully!');
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  verifyEmailService,
  sendVerificationEmail,
  sendPasswordResetEmail
}; 
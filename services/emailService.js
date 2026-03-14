// backend/services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configuration du transporteur Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Mot de passe d'application
      },
    });
  }

  async sendVerificationCode(email, code, username) {
    const mailOptions = {
      from: `"Asmay" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Code de vérification Asmay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #203447ff;">Asmay</h1>
            <p style="color: #666;">Vérification de votre adresse email</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="font-size: 16px; color: #333;">Bonjour <strong>${username}</strong>,</p>
            <p style="font-size: 16px; color: #333;">Votre code de vérification est :</p>
            <div style="background-color: #203447ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: white; font-size: 36px; letter-spacing: 5px; margin: 0;">${code}</h2>
            </div>
            <p style="font-size: 14px; color: #666;">Ce code est valable pendant 10 minutes.</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© 2026 Asmay. Tous droits réservés.</p>
          </div>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de vérification envoyé à ${email}`);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, username) {
    const mailOptions = {
      from: `"Asmay" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🎉 Bienvenue sur Asmay !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #203447ff;">Asmay</h1>
            <p style="color: #666;">Bienvenue dans la communauté !</p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <p style="font-size: 16px; color: #333;">Bonjour <strong>${username}</strong>,</p>
            <p style="font-size: 16px; color: #333;">Votre compte a été créé avec succès !</p>
            <p style="font-size: 14px; color: #666;">Vous pouvez maintenant :</p>
            <ul style="color: #666;">
              <li>✅ Découvrir des personnes proches</li>
              <li>💬 Envoyer des signaux</li>
              <li>🎤 Envoyer des messages vocaux</li>
              <li>📱 Chatter en temps réel</li>
            </ul>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de bienvenue envoyé à ${email}`);
    } catch (error) {
      console.error('❌ Erreur envoi email bienvenue:', error);
    }
  }
}

module.exports = new EmailService();
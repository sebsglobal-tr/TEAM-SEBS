import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string = '';

  constructor(configService: ConfigService) {
    const host = configService.get<string>('SMTP_HOST');
    const port = configService.get<number>('SMTP_PORT', 587);
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.fromAddress = configService.get<string>('SMTP_FROM', 'noreply@worktrack.app');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`E-posta servisi yapılandırıldı: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP yapılandırması eksik. E-posta gönderimi devre dışı.');
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(`E-posta gönderilemedi (SMTP yapılandırılmamış): ${subject} -> ${to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`E-posta gönderildi: ${subject} -> ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`E-posta gönderilemedi: ${(err as Error).message}`);
      return false;
    }
  }

  // Template helpers
  taskAssignedEmail(userName: string, taskTitle: string, taskUrl: string) {
    return {
      subject: `🔔 Yeni Görev: ${taskTitle}`,
      html: `<h2>Merhaba ${userName},</h2><p>Size yeni bir görev atandı:</p><h3>${taskTitle}</h3><p><a href="${taskUrl}" style="padding:10px 20px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px">Görevi Görüntüle</a></p>`,
    };
  }

  leaveStatusEmail(userName: string, leaveType: string, status: string, reason?: string) {
    const statusText = status === 'APPROVED' ? 'onaylandı' : 'reddedildi';
    const color = status === 'APPROVED' ? '#10b981' : '#ef4444';
    return {
      subject: `📅 İzin Talebin ${statusText}`,
      html: `<h2>Merhaba ${userName},</h2><p><strong>${leaveType}</strong> izin talebiniz <span style="color:${color};font-weight:600">${statusText}</span>.${reason ? `<br>Gerekçe: ${reason}` : ''}</p>`,
    };
  }

  reportFeedbackEmail(userName: string, reportTitle: string) {
    return {
      subject: `💬 Geri Bildirim: ${reportTitle}`,
      html: `<h2>Merhaba ${userName},</h2><p><strong>${reportTitle}</strong> raporunuza yeni bir geri bildirim yapıldı.</p>`,
    };
  }
}

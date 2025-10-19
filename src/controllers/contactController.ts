import { Request, Response } from 'express';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
}

// Async function to submit contact form
export const submitContactForm = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, company, subject, message }: ContactFormData = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, subject, and message are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Prepare email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Contact Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        </div>
        
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0;">Message Details</h3>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #7c3aed;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>This message was sent from the DocAI contact form.</p>
          <p>Reply directly to this email to respond to ${name}.</p>
        </div>
      </div>
    `;

    // Send email using SendGrid
    const msg = {
      to: 'raneesk12@gmail.com',
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@docaibackend.com',
        name: 'DocAI Contact Form'
      },
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: emailContent,
      text: `
        New Contact Form Submission
        
        Name: ${name}
        Email: ${email}
        ${phone ? `Phone: ${phone}` : ''}
        ${company ? `Company: ${company}` : ''}
        
        Subject: ${subject}
        Message: ${message}
        
        Reply directly to this email to respond to ${name}.
      `
    };

    await sgMail.send(msg);

    // Send confirmation email to the user
    const confirmationMsg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@docaibackend.com',
        name: 'DocAI Team'
      },
      subject: 'Thank you for contacting us!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">Thank you for reaching out!</h2>
          
          <p>Hi ${name},</p>
          
          <p>Thank you for contacting us! We've received your message and will get back to you as soon as possible.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Your Message Summary</h3>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #7c3aed;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <p>We typically respond within 24 hours during business days.</p>
          
          <p>Best regards,<br>The DocAI Team</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>This is an automated confirmation email. Please do not reply to this message.</p>
          </div>
        </div>
      `,
      text: `
        Thank you for reaching out!
        
        Hi ${name},
        
        Thank you for contacting us! We've received your message and will get back to you as soon as possible.
        
        Your Message Summary:
        Subject: ${subject}
        Message: ${message}
        
        We typically respond within 24 hours during business days.
        
        Best regards,
        The DocAI Team
        
        This is an automated confirmation email. Please do not reply to this message.
      `
    };

    await sgMail.send(confirmationMsg);

    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!'
    });

  } catch (error: any) {
    console.error('Error sending contact form:', error);
    
    // Handle SendGrid specific errors
    if (error.code === 403) {
      console.error('SendGrid 403 Error Details:', error.response?.body);
      return res.status(500).json({
        success: false,
        message: 'Email service configuration error. Please contact support.'
      });
    }
    
    if (error.code === 401) {
      return res.status(500).json({
        success: false,
        message: 'Email service authentication failed. Please contact support.'
      });
    }
    
    if (error.code === 400) {
      return res.status(500).json({
        success: false,
        message: 'Invalid email configuration. Please contact support.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

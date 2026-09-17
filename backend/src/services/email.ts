/**
 * Email notification service using Nodemailer.
 * In development, uses Ethereal fake SMTP to capture outgoing emails
 * without sending real mail. View sent messages at https://ethereal.email/login.
 */

import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter;

// Create an Ethereal test account and configure the transporter
export async function initEmail() {
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log(`Email test account: ${testAccount.user}`);
  console.log(`View sent emails at: https://ethereal.email/login`);
}

// Send a dose reminder email with a one-click "Mark as Taken" button
export async function sendDoseReminder(
  to: string,
  medName: string,
  dosage: string,
  label: string,
  confirmUrl: string
) {
  const info = await transporter.sendMail({
    from: '"MedReminder" <noreply@medreminder.app>',
    to,
    subject: `Take your ${medName} - ${label} dose`,
    html: `
      <h2>Medication Reminder</h2>
      <p>Time to take <strong>${medName} ${dosage}</strong> (${label} dose).</p>
      <p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Mark as Taken</a></p>
      <p style="color:#666;font-size:12px;">If the button doesn't work, open your MedReminder dashboard to confirm.</p>
    `,
  });

  console.log(`Dose reminder sent to ${to}: ${nodemailer.getTestMessageUrl(info)}`);
}

// Send a refill warning when the user's pill supply is running low
export async function sendRefillReminder(
  to: string,
  medName: string,
  remaining: number,
  daysLeft: number
) {
  const info = await transporter.sendMail({
    from: '"MedReminder" <noreply@medreminder.app>',
    to,
    subject: `Refill reminder: ${medName}`,
    html: `
      <h2>Refill Reminder</h2>
      <p>You have <strong>${remaining} pills</strong> of ${medName} left (~${Math.floor(daysLeft)} days).</p>
      <p>Time to call your pharmacy and schedule a refill.</p>
    `,
  });

  console.log(`Refill reminder sent to ${to}: ${nodemailer.getTestMessageUrl(info)}`);
}

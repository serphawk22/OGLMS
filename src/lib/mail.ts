import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Generate test account automatically for local development
    const testAccount = await nodemailer.createTestAccount();
    console.log("Creating Ethereal test email account:", testAccount.user);
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
  return transporter;
}

/**
 * Low-level email sender. Errors are caught and logged so callers are never broken.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const t = await getTransporter();
  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || '"LMS Platform" <noreply@lms-platform.com>',
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
    });

    console.log(`Email sent successfully! Message ID: ${info.messageId}`);

    // Ethereal provides a preview URL since it doesn't actually deliver to real inboxes
    if (!process.env.SMTP_USER) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    console.error("[sendEmail] Failed to send email:", error);
    // Intentionally NOT re-throwing — email failure must never break the caller
  }
}

/**
 * Sends a rich HTML live-class notification email to one or more students.
 * Wraps sendEmail() so errors are silently swallowed and class creation is unaffected.
 */
export async function sendLiveClassEmail({
  to,
  courseName,
  sessionTitle,
  scheduledAt,
  instructorName,
  joinLink,
}: {
  to: string | string[];
  courseName: string;
  sessionTitle: string;
  scheduledAt: Date;
  instructorName: string;
  joinLink: string;
}) {
  const formattedDate = scheduledAt.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = scheduledAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Live Class Scheduled</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);max-width:600px;">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3b82f6 100%);padding:40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Live Class Scheduled!</h1>
              <p style="margin:10px 0 0;color:#bfdbfe;font-size:14px;">A new session has been added to your course</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.7;">
                A new live class has been scheduled for your course
                <strong style="color:#1e3a8a;">${courseName}</strong>.
                Join the class using the link below.
              </p>

              <!-- CLASS DETAILS CARD -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:28px;">

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Course</span>
                          <p style="margin:5px 0 0;color:#0f172a;font-size:15px;font-weight:700;">${courseName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Session Title</span>
                          <p style="margin:5px 0 0;color:#0f172a;font-size:15px;font-weight:700;">${sessionTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</span>
                          <p style="margin:5px 0 0;color:#0f172a;font-size:15px;font-weight:700;">${formattedDate} &nbsp;·&nbsp; ${formattedTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0;">
                          <span style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Instructor</span>
                          <p style="margin:5px 0 0;color:#0f172a;font-size:15px;font-weight:700;">${instructorName}</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- JOIN BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <a href="${joinLink}" target="_blank"
                      style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:10px;font-size:16px;font-weight:800;letter-spacing:0.2px;box-shadow:0 6px 20px rgba(37,99,235,0.40);">
                      Join Live Class
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.7;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${joinLink}" style="color:#2563eb;word-break:break-all;">${joinLink}</a>
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                This is an automated notification from your LMS Platform. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await sendEmail({
    to,
    subject: `Live Class: "${sessionTitle}" — ${courseName}`,
    html,
  });
}

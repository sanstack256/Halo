import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured"
    );
  }

  const resend = getResendClient();
  const { error } =
    await resend.emails.send({
      from: "Halo <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

  if (error) {
    throw new Error(
      `Failed to send email: ${error.message}`
    );
  }
}
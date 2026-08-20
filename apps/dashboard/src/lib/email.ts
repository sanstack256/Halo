import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

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
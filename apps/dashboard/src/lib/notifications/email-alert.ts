import { prisma } from "../prisma";
import { Resend } from "resend";

export interface SendAlertEmailResult {
    success: boolean;
    delivered: boolean;
    skipped?: boolean;
    notificationId?: string;
    destination?: string;
    error?: string;
}

function getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
        return null;
    }
    return new Resend(apiKey);
}

/**
 * Sends a real email alert via Resend when a monitor fires.
 * Enforces idempotency to prevent duplicate emails for the same continuous alert episode.
 */
export async function sendMonitorAlertEmail(alertId: string): Promise<SendAlertEmailResult> {
    const alert = await prisma.monitorAlert.findUnique({
        where: { id: alertId },
        include: {
            monitor: {
                include: {
                    project: {
                        include: {
                            organization: {
                                include: {
                                    owner: true,
                                },
                            },
                        },
                    },
                    creator: true,
                },
            },
            notifications: {
                where: {
                    channel: "EMAIL",
                    outcome: "DELIVERED",
                },
            },
        },
    });

    if (!alert) {
        return { success: false, delivered: false, error: `Alert with ID ${alertId} not found` };
    }

    // 1. Check if email notifications are enabled in monitor config
    const alertConfig = alert.monitor.alertConfig as Record<string, any> | null;
    const notifyEmail = alertConfig?.notifyEmail !== false; // defaults to true if config object exists or not explicitly disabled
    if (!notifyEmail) {
        return { success: true, delivered: false, skipped: true, error: "Email notifications disabled in monitor config" };
    }

    // 2. Idempotency protection: do not send duplicate email for the same alert episode
    if (alert.notifications.length > 0) {
        return {
            success: true,
            delivered: false,
            skipped: true,
            destination: alert.notifications[0].destination || undefined,
            error: "Notification already delivered for this alert episode",
        };
    }

    // 3. Resolve recipient email
    let recipientEmail = alert.monitor.creator?.email;
    if (!recipientEmail && alert.monitor.project?.organization?.owner?.email) {
        recipientEmail = alert.monitor.project.organization.owner.email;
    }

    if (!recipientEmail) {
        recipientEmail = "admin@halo.run";
    }

    const resend = getResendClient();
    const appUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const alertUrl = `${appUrl}/monitors/alerts/${alert.id}`;
    const monitorUrl = `${appUrl}/monitors/${alert.monitor.id}`;

    if (!resend) {
        const failReason = "RESEND_API_KEY is not configured in server environment.";
        console.warn(`[Halo Email Alert] Failed to send email for alert ${alert.id}: ${failReason}`);

        const notification = await prisma.monitorAlertNotification.create({
            data: {
                alertId: alert.id,
                channel: "EMAIL",
                destination: recipientEmail,
                outcome: "FAILED",
                failReason,
                attemptedAt: new Date(),
            },
        });

        return {
            success: false,
            delivered: false,
            notificationId: notification.id,
            destination: recipientEmail,
            error: failReason,
        };
    }

    // 4. Construct professional dynamic HTML template
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "UTC",
    }).format(alert.triggeredAt) + " UTC";

    const filterText = alert.monitor.query ? alert.monitor.query : "All matching events in project";

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Halo Alert: ${escapeHtml(alert.monitor.name)} is FIRING</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #111827; border: 1px solid #374151; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: #1f2937; border-bottom: 1px solid #374151;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <span style="font-size: 16px; font-weight: 700; color: #6366f1; letter-spacing: 1px;">HALO OBSERVABILITY</span>
                                    </td>
                                    <td align="right">
                                        <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #f87171; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; text-transform: uppercase;">
                                            ● FIRING
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Title & Summary -->
                    <tr>
                        <td style="padding: 32px 32px 16px 32px;">
                            <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                                ${escapeHtml(alert.monitor.name)}
                            </h1>
                            <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.5;">
                                ${escapeHtml(alert.conditionSummary)}
                            </p>
                        </td>
                    </tr>

                    <!-- Metric Breakdown -->
                    <tr>
                        <td style="padding: 0 32px 24px 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 8px; font-size: 13px; font-family: monospace;">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af; width: 140px;">Project</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #ffffff; font-weight: 600;">${escapeHtml(alert.monitor.project?.name || "Unknown")}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">Observed Value</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #f87171; font-weight: 700;">${alert.observedValue ?? "—"} matching events</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">Configured Threshold</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #d1d5db;">&gt;= ${alert.thresholdValue ?? alert.monitor.thresholdValue ?? "—"}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">Evaluation Window</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #d1d5db;">${alert.monitor.thresholdWindow ?? 10} minutes</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">Filter Expression</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #6366f1;">${escapeHtml(filterText)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">Triggered At</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #1f2937; color: #9ca3af;">${formattedDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; color: #9ca3af;">Alert ID</td>
                                    <td style="padding: 12px 16px; color: #6b7280; font-size: 11px;">${alert.id}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Actions -->
                    <tr>
                        <td style="padding: 0 32px 32px 32px;">
                            <table cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding-right: 12px;">
                                        <a href="${alertUrl}" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 600; color: #ffffff; background-color: #6366f1; border-radius: 6px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                            View Alert Details &rarr;
                                        </a>
                                    </td>
                                    <td>
                                        <a href="${monitorUrl}" style="display: inline-block; padding: 10px 20px; font-size: 13px; font-weight: 600; color: #d1d5db; background-color: #1f2937; border: 1px solid #374151; border-radius: 6px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                            Monitor Settings
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; font-size: 12px; color: #6b7280;">
                            This notification was dispatched automatically by Halo Observability based on your monitor alerting configuration.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    try {
        const { data, error } = await resend.emails.send({
            from: "Halo Observability <onboarding@resend.dev>",
            to: recipientEmail,
            subject: `[ALERT FIRING] ${alert.monitor.name} (${alert.conditionSummary})`,
            html,
        });

        if (error) {
            console.error(`[Halo Email Alert] Resend rejected alert email for ${alert.id}:`, error);
            const notification = await prisma.monitorAlertNotification.create({
                data: {
                    alertId: alert.id,
                    channel: "EMAIL",
                    destination: recipientEmail,
                    outcome: "FAILED",
                    failReason: error.message || "Resend API error",
                    attemptedAt: new Date(),
                },
            });

            return {
                success: false,
                delivered: false,
                notificationId: notification.id,
                destination: recipientEmail,
                error: error.message,
            };
        }

        const notification = await prisma.monitorAlertNotification.create({
            data: {
                alertId: alert.id,
                channel: "EMAIL",
                destination: recipientEmail,
                outcome: "DELIVERED",
                attemptedAt: new Date(),
            },
        });

        return {
            success: true,
            delivered: true,
            notificationId: notification.id,
            destination: recipientEmail,
        };
    } catch (err: any) {
        const message = err instanceof Error ? err.message : "Unexpected email dispatch failure";
        console.error(`[Halo Email Alert] Failed to dispatch email for alert ${alert.id}:`, err);

        const notification = await prisma.monitorAlertNotification.create({
            data: {
                alertId: alert.id,
                channel: "EMAIL",
                destination: recipientEmail,
                outcome: "FAILED",
                failReason: message,
                attemptedAt: new Date(),
            },
        });

        return {
            success: false,
            delivered: false,
            notificationId: notification.id,
            destination: recipientEmail,
            error: message,
        };
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

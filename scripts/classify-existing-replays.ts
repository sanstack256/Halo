import { prisma } from "../apps/dashboard/src/lib/prisma";

async function classifyAndMigrateReplays() {
    console.log("Starting forensic audit of existing ReplaySession records...");

    const allSessions = await prisma.replaySession.findMany({
        include: {
            chunks: {
                select: {
                    id: true,
                    sequence: true,
                    eventCount: true,
                    events: true,
                    startedAt: true,
                    endedAt: true,
                },
                orderBy: { sequence: "asc" },
            },
        },
    });

    console.log(`Total ReplaySession records in DB: ${allSessions.length}`);

    let validCount = 0;
    let invalidCount = 0;
    let updatedCount = 0;

    for (const session of allSessions) {
        let isValid = false;
        let reason = "";

        if (session.chunks.length === 0) {
            isValid = false;
            reason = "No chunks present";
        } else {
            // Check if chunks have events and contain at least one FullSnapshot (type 2)
            let totalEvents = 0;
            let hasFullSnapshot = false;

            for (const chunk of session.chunks) {
                if (Array.isArray(chunk.events)) {
                    totalEvents += chunk.events.length;
                    for (const ev of chunk.events as any[]) {
                        if (ev?.type === 2) {
                            hasFullSnapshot = true;
                        }
                    }
                }
            }

            if (totalEvents === 0) {
                isValid = false;
                reason = "Zero events in all chunks";
            } else if (
                session.triggerType === null &&
                session.errorAt === null &&
                session.issueId === null &&
                (session.totalDurationMs ?? 0) <= 2000
            ) {
                isValid = false;
                reason = "Untriggered clip <= 2000ms";
            } else if (!hasFullSnapshot && (session.totalDurationMs ?? 0) < 5000 && !session.issueId) {
                isValid = false;
                reason = "Missing FullSnapshot root and short duration";
            } else {
                isValid = true;
                reason = "Valid reconstructable replay";
            }
        }

        if (isValid) {
            validCount++;
        } else {
            invalidCount++;
            // If currently marked AVAILABLE or RECORDING, safely transition to EXPIRED
            if (session.status === "AVAILABLE" || session.status === "RECORDING") {
                await prisma.replaySession.update({
                    where: { id: session.id },
                    data: {
                        status: "EXPIRED",
                    },
                });
                updatedCount++;
            }
        }
    }

    console.log("Classification Results:");
    console.log(`  VALID replays preserved: ${validCount}`);
    console.log(`  INVALID/INCOMPLETE replays identified: ${invalidCount}`);
    console.log(`  Records updated to EXPIRED status: ${updatedCount}`);
}

classifyAndMigrateReplays()
    .catch((err) => {
        console.error("Migration error:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

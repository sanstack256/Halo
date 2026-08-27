# Diff Details

Date : 2026-08-24 22:51:45

Directory /Users/nssanjeev/Development/Halo

Total : 231 files,  30063 codes, 4565 comments, 4075 blanks, all 38703 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [apps/dashboard/package.json](/apps/dashboard/package.json) | JSON | 3 | 0 | 0 | 3 |
| [apps/dashboard/src/actions/event.ts](/apps/dashboard/src/actions/event.ts) | TypeScript | 211 | 54 | 65 | 330 |
| [apps/dashboard/src/actions/explore.ts](/apps/dashboard/src/actions/explore.ts) | TypeScript | 107 | 0 | 26 | 133 |
| [apps/dashboard/src/actions/issue.ts](/apps/dashboard/src/actions/issue.ts) | TypeScript | 425 | 96 | 67 | 588 |
| [apps/dashboard/src/actions/overview.ts](/apps/dashboard/src/actions/overview.ts) | TypeScript | 376 | 14 | 46 | 436 |
| [apps/dashboard/src/actions/project-metrics.ts](/apps/dashboard/src/actions/project-metrics.ts) | TypeScript | 258 | 26 | 49 | 333 |
| [apps/dashboard/src/actions/project.ts](/apps/dashboard/src/actions/project.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/actions/release.ts](/apps/dashboard/src/actions/release.ts) | TypeScript | 89 | 0 | 17 | 106 |
| [apps/dashboard/src/actions/replay.ts](/apps/dashboard/src/actions/replay.ts) | TypeScript | 155 | 2 | 20 | 177 |
| [apps/dashboard/src/actions/search.ts](/apps/dashboard/src/actions/search.ts) | TypeScript | 95 | 6 | 16 | 117 |
| [apps/dashboard/src/actions/services.ts](/apps/dashboard/src/actions/services.ts) | TypeScript | 101 | 0 | 16 | 117 |
| [apps/dashboard/src/actions/settings.ts](/apps/dashboard/src/actions/settings.ts) | TypeScript | 73 | 0 | 17 | 90 |
| [apps/dashboard/src/app/(dashboard)/dashboards/layout.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/layout.tsx) | TypeScript JSX | 12 | 0 | 2 | 14 |
| [apps/dashboard/src/app/(dashboard)/dashboards/page.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/page.tsx) | TypeScript JSX | 40 | 0 | 6 | 46 |
| [apps/dashboard/src/app/(dashboard)/dashboards/services/page.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/services/page.tsx) | TypeScript JSX | 42 | 0 | 5 | 47 |
| [apps/dashboard/src/app/(dashboard)/dashboards/slo/page.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/slo/page.tsx) | TypeScript JSX | 94 | 5 | 12 | 111 |
| [apps/dashboard/src/app/(dashboard)/dashboards/system/page.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/system/page.tsx) | TypeScript JSX | 130 | 3 | 13 | 146 |
| [apps/dashboard/src/app/(dashboard)/explore/database/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/database/page.tsx) | TypeScript JSX | 18 | 0 | 3 | 21 |
| [apps/dashboard/src/app/(dashboard)/explore/errors/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/errors/page.tsx) | TypeScript JSX | 48 | 0 | 5 | 53 |
| [apps/dashboard/src/app/(dashboard)/explore/infrastructure/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/infrastructure/page.tsx) | TypeScript JSX | 18 | 0 | 3 | 21 |
| [apps/dashboard/src/app/(dashboard)/explore/layout.tsx](/apps/dashboard/src/app/(dashboard)/explore/layout.tsx) | TypeScript JSX | 12 | 0 | 2 | 14 |
| [apps/dashboard/src/app/(dashboard)/explore/logs/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/logs/page.tsx) | TypeScript JSX | 48 | 0 | 5 | 53 |
| [apps/dashboard/src/app/(dashboard)/explore/metrics/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/metrics/page.tsx) | TypeScript JSX | 30 | 0 | 6 | 36 |
| [apps/dashboard/src/app/(dashboard)/explore/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/page.tsx) | TypeScript JSX | 77 | 2 | 10 | 89 |
| [apps/dashboard/src/app/(dashboard)/explore/requests/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/requests/page.tsx) | TypeScript JSX | 46 | 0 | 5 | 51 |
| [apps/dashboard/src/app/(dashboard)/explore/traces/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/traces/page.tsx) | TypeScript JSX | 46 | 0 | 5 | 51 |
| [apps/dashboard/src/app/(dashboard)/explore/universal-search-client.tsx](/apps/dashboard/src/app/(dashboard)/explore/universal-search-client.tsx) | TypeScript JSX | 130 | 3 | 13 | 146 |
| [apps/dashboard/src/app/(dashboard)/investigate/active/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/active/page.tsx) | TypeScript JSX | 62 | 0 | 9 | 71 |
| [apps/dashboard/src/app/(dashboard)/investigate/layout.tsx](/apps/dashboard/src/app/(dashboard)/investigate/layout.tsx) | TypeScript JSX | 11 | 0 | 1 | 12 |
| [apps/dashboard/src/app/(dashboard)/investigate/mine/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/mine/page.tsx) | TypeScript JSX | 64 | 0 | 9 | 73 |
| [apps/dashboard/src/app/(dashboard)/investigate/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/page.tsx) | TypeScript JSX | 76 | 1 | 11 | 88 |
| [apps/dashboard/src/app/(dashboard)/investigate/recent/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/recent/page.tsx) | TypeScript JSX | 61 | 0 | 9 | 70 |
| [apps/dashboard/src/app/(dashboard)/investigate/saved/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/saved/page.tsx) | TypeScript JSX | 24 | 0 | 3 | 27 |
| [apps/dashboard/src/app/(dashboard)/investigate/team/page.tsx](/apps/dashboard/src/app/(dashboard)/investigate/team/page.tsx) | TypeScript JSX | 64 | 0 | 9 | 73 |
| [apps/dashboard/src/app/(dashboard)/issues/errors/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/errors/page.tsx) | TypeScript JSX | 57 | 0 | 5 | 62 |
| [apps/dashboard/src/app/(dashboard)/issues/ignored/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/ignored/page.tsx) | TypeScript JSX | 51 | 0 | 5 | 56 |
| [apps/dashboard/src/app/(dashboard)/issues/issues-list-client.tsx](/apps/dashboard/src/app/(dashboard)/issues/issues-list-client.tsx) | TypeScript JSX | 173 | 5 | 19 | 197 |
| [apps/dashboard/src/app/(dashboard)/issues/layout.tsx](/apps/dashboard/src/app/(dashboard)/issues/layout.tsx) | TypeScript JSX | 12 | 0 | 2 | 14 |
| [apps/dashboard/src/app/(dashboard)/issues/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/page.tsx) | TypeScript JSX | 16 | 0 | 4 | 20 |
| [apps/dashboard/src/app/(dashboard)/issues/recurring/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/recurring/page.tsx) | TypeScript JSX | 57 | 0 | 5 | 62 |
| [apps/dashboard/src/app/(dashboard)/issues/regressions/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/regressions/page.tsx) | TypeScript JSX | 57 | 0 | 5 | 62 |
| [apps/dashboard/src/app/(dashboard)/issues/resolved/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/resolved/page.tsx) | TypeScript JSX | 51 | 0 | 5 | 56 |
| [apps/dashboard/src/app/(dashboard)/issues/warnings/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/warnings/page.tsx) | TypeScript JSX | 57 | 0 | 5 | 62 |
| [apps/dashboard/src/app/(dashboard)/layout.tsx](/apps/dashboard/src/app/(dashboard)/layout.tsx) | TypeScript JSX | 0 | 2 | -6 | -4 |
| [apps/dashboard/src/app/(dashboard)/monitors/firing/page.tsx](/apps/dashboard/src/app/(dashboard)/monitors/firing/page.tsx) | TypeScript JSX | 61 | 0 | 5 | 66 |
| [apps/dashboard/src/app/(dashboard)/monitors/healthy/page.tsx](/apps/dashboard/src/app/(dashboard)/monitors/healthy/page.tsx) | TypeScript JSX | 52 | 0 | 5 | 57 |
| [apps/dashboard/src/app/(dashboard)/monitors/layout.tsx](/apps/dashboard/src/app/(dashboard)/monitors/layout.tsx) | TypeScript JSX | 12 | 0 | 2 | 14 |
| [apps/dashboard/src/app/(dashboard)/monitors/page.tsx](/apps/dashboard/src/app/(dashboard)/monitors/page.tsx) | TypeScript JSX | 72 | 0 | 11 | 83 |
| [apps/dashboard/src/app/(dashboard)/monitors/slos/page.tsx](/apps/dashboard/src/app/(dashboard)/monitors/slos/page.tsx) | TypeScript JSX | 16 | 0 | 3 | 19 |
| [apps/dashboard/src/app/(dashboard)/overview/page.tsx](/apps/dashboard/src/app/(dashboard)/overview/page.tsx) | TypeScript JSX | 308 | 7 | 33 | 348 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/events/\[eventId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/events/%5BeventId%5D/page.tsx) | TypeScript JSX | 167 | 9 | 10 | 186 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/events/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/events/page.tsx) | TypeScript JSX | 125 | 0 | 3 | 128 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/investigations/new/no-events-modal.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/investigations/new/no-events-modal.tsx) | TypeScript JSX | 61 | 3 | 9 | 73 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/investigations/new/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/investigations/new/page.tsx) | TypeScript JSX | 310 | 15 | 29 | 354 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/issues/\[issueId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/issues/%5BissueId%5D/page.tsx) | TypeScript JSX | -82 | -3 | -52 | -137 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/layout.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/layout.tsx) | TypeScript JSX | 22 | 4 | 5 | 31 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/page.tsx) | TypeScript JSX | 55 | 4 | 11 | 70 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/sdk/code-snippet.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/sdk/code-snippet.tsx) | TypeScript JSX | 40 | 0 | 6 | 46 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/sdk/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/sdk/page.tsx) | TypeScript JSX | 217 | 8 | 31 | 256 |
| [apps/dashboard/src/app/(dashboard)/services/critical/page.tsx](/apps/dashboard/src/app/(dashboard)/services/critical/page.tsx) | TypeScript JSX | 48 | 0 | 5 | 53 |
| [apps/dashboard/src/app/(dashboard)/services/degraded/page.tsx](/apps/dashboard/src/app/(dashboard)/services/degraded/page.tsx) | TypeScript JSX | 48 | 0 | 5 | 53 |
| [apps/dashboard/src/app/(dashboard)/services/dependencies/page.tsx](/apps/dashboard/src/app/(dashboard)/services/dependencies/page.tsx) | TypeScript JSX | 45 | 0 | 5 | 50 |
| [apps/dashboard/src/app/(dashboard)/services/healthy/page.tsx](/apps/dashboard/src/app/(dashboard)/services/healthy/page.tsx) | TypeScript JSX | 48 | 0 | 5 | 53 |
| [apps/dashboard/src/app/(dashboard)/services/layout.tsx](/apps/dashboard/src/app/(dashboard)/services/layout.tsx) | TypeScript JSX | 12 | 0 | 2 | 14 |
| [apps/dashboard/src/app/(dashboard)/services/page.tsx](/apps/dashboard/src/app/(dashboard)/services/page.tsx) | TypeScript JSX | 56 | 0 | 5 | 61 |
| [apps/dashboard/src/app/(dashboard)/settings/account-details-client.tsx](/apps/dashboard/src/app/(dashboard)/settings/account-details-client.tsx) | TypeScript JSX | 199 | 7 | 18 | 224 |
| [apps/dashboard/src/app/(dashboard)/settings/alerts/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/alerts/page.tsx) | TypeScript JSX | 44 | 0 | 5 | 49 |
| [apps/dashboard/src/app/(dashboard)/settings/audit/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/audit/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/autofix/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/autofix/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/billing/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/billing/page.tsx) | TypeScript JSX | 89 | 2 | 8 | 99 |
| [apps/dashboard/src/app/(dashboard)/settings/close/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/close/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/custom/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/custom/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/emails/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/emails/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/engine/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/engine/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/filters/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/filters/page.tsx) | TypeScript JSX | 38 | 0 | 5 | 43 |
| [apps/dashboard/src/app/(dashboard)/settings/integrations/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/integrations/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/keys/client-keys-manager.tsx](/apps/dashboard/src/app/(dashboard)/settings/keys/client-keys-manager.tsx) | TypeScript JSX | 142 | 3 | 15 | 160 |
| [apps/dashboard/src/app/(dashboard)/settings/keys/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/keys/page.tsx) | TypeScript JSX | 27 | 0 | 6 | 33 |
| [apps/dashboard/src/app/(dashboard)/settings/legal/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/legal/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/mcp/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/mcp/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/members/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/members/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/oauth/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/oauth/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/organization/organization-settings-form.tsx](/apps/dashboard/src/app/(dashboard)/settings/organization/organization-settings-form.tsx) | TypeScript JSX | 151 | 4 | 16 | 171 |
| [apps/dashboard/src/app/(dashboard)/settings/organization/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/organization/page.tsx) | TypeScript JSX | 35 | 0 | 6 | 41 |
| [apps/dashboard/src/app/(dashboard)/settings/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/page.tsx) | TypeScript JSX | 21 | 0 | 5 | 26 |
| [apps/dashboard/src/app/(dashboard)/settings/privacy/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/privacy/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/project/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/project/page.tsx) | TypeScript JSX | 35 | 0 | 7 | 42 |
| [apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx](/apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx) | TypeScript JSX | 297 | 6 | 25 | 328 |
| [apps/dashboard/src/app/(dashboard)/settings/repos/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/repos/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/security/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/security/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/teams/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/teams/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/tokens/org/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/tokens/org/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/tokens/personal/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/tokens/personal/page.tsx) | TypeScript JSX | 21 | 0 | 4 | 25 |
| [apps/dashboard/src/app/(dashboard)/settings/usage/page.tsx](/apps/dashboard/src/app/(dashboard)/settings/usage/page.tsx) | TypeScript JSX | 73 | 1 | 9 | 83 |
| [apps/dashboard/src/app/api/ingest/events/route.ts](/apps/dashboard/src/app/api/ingest/events/route.ts) | TypeScript | 14 | 0 | 1 | 15 |
| [apps/dashboard/src/app/api/ingest/replay/route.ts](/apps/dashboard/src/app/api/ingest/replay/route.ts) | TypeScript | 170 | 6 | 20 | 196 |
| [apps/dashboard/src/app/forgot-password/page.tsx](/apps/dashboard/src/app/forgot-password/page.tsx) | TypeScript JSX | 20 | 0 | 4 | 24 |
| [apps/dashboard/src/app/globals.css](/apps/dashboard/src/app/globals.css) | PostCSS | 1,751 | 92 | 344 | 2,187 |
| [apps/dashboard/src/app/pricing/page.tsx](/apps/dashboard/src/app/pricing/page.tsx) | TypeScript JSX | 49 | 2 | 5 | 56 |
| [apps/dashboard/src/app/pricing/pricing-grid.tsx](/apps/dashboard/src/app/pricing/pricing-grid.tsx) | TypeScript JSX | 192 | 10 | 19 | 221 |
| [apps/dashboard/src/app/reset-password/page.tsx](/apps/dashboard/src/app/reset-password/page.tsx) | TypeScript JSX | 9 | 0 | 2 | 11 |
| [apps/dashboard/src/app/reset-password/reset-password-form.tsx](/apps/dashboard/src/app/reset-password/reset-password-form.tsx) | TypeScript JSX | 132 | 0 | 22 | 154 |
| [apps/dashboard/src/components/auth/forgot-password-form.tsx](/apps/dashboard/src/components/auth/forgot-password-form.tsx) | TypeScript JSX | 95 | 0 | 14 | 109 |
| [apps/dashboard/src/components/auth/sign-in-form.tsx](/apps/dashboard/src/components/auth/sign-in-form.tsx) | TypeScript JSX | 124 | 0 | 13 | 137 |
| [apps/dashboard/src/components/auth/sign-up-form.tsx](/apps/dashboard/src/components/auth/sign-up-form.tsx) | TypeScript JSX | 79 | 0 | 7 | 86 |
| [apps/dashboard/src/components/issues/issue-card.tsx](/apps/dashboard/src/components/issues/issue-card.tsx) | TypeScript JSX | 10 | 0 | -13 | -3 |
| [apps/dashboard/src/components/issues/issue-detail-view.tsx](/apps/dashboard/src/components/issues/issue-detail-view.tsx) | TypeScript JSX | 360 | 17 | 38 | 415 |
| [apps/dashboard/src/components/overview/sidebar.tsx](/apps/dashboard/src/components/overview/sidebar.tsx) | TypeScript JSX | 338 | -1 | -10 | 327 |
| [apps/dashboard/src/components/overview/topbar.tsx](/apps/dashboard/src/components/overview/topbar.tsx) | TypeScript JSX | 82 | 3 | -5 | 80 |
| [apps/dashboard/src/components/overview/user-profile-menu.tsx](/apps/dashboard/src/components/overview/user-profile-menu.tsx) | TypeScript JSX | 120 | 3 | 15 | 138 |
| [apps/dashboard/src/components/projects/api-keys-section.tsx](/apps/dashboard/src/components/projects/api-keys-section.tsx) | TypeScript JSX | 44 | 4 | 31 | 79 |
| [apps/dashboard/src/components/projects/create-api-key-dialog.tsx](/apps/dashboard/src/components/projects/create-api-key-dialog.tsx) | TypeScript JSX | 22 | 0 | -11 | 11 |
| [apps/dashboard/src/components/projects/create-project-dialog.tsx](/apps/dashboard/src/components/projects/create-project-dialog.tsx) | TypeScript JSX | 16 | 0 | -1 | 15 |
| [apps/dashboard/src/components/projects/project-navigation.tsx](/apps/dashboard/src/components/projects/project-navigation.tsx) | TypeScript JSX | 63 | 0 | -2 | 61 |
| [apps/dashboard/src/components/projects/project-overview.tsx](/apps/dashboard/src/components/projects/project-overview.tsx) | TypeScript JSX | 715 | 13 | 167 | 895 |
| [apps/dashboard/src/components/projects/project-quick-start.tsx](/apps/dashboard/src/components/projects/project-quick-start.tsx) | TypeScript JSX | 80 | 4 | 5 | 89 |
| [apps/dashboard/src/components/replay/replay-player-client.tsx](/apps/dashboard/src/components/replay/replay-player-client.tsx) | TypeScript JSX | 448 | 22 | 59 | 529 |
| [apps/dashboard/src/components/replay/replay-status.tsx](/apps/dashboard/src/components/replay/replay-status.tsx) | TypeScript JSX | 139 | 0 | 10 | 149 |
| [apps/dashboard/src/components/replay/replay-view.tsx](/apps/dashboard/src/components/replay/replay-view.tsx) | TypeScript JSX | 37 | 0 | 8 | 45 |
| [apps/dashboard/src/components/ui/back-button.tsx](/apps/dashboard/src/components/ui/back-button.tsx) | TypeScript JSX | 35 | 0 | 6 | 41 |
| [apps/dashboard/src/components/ui/dialog.tsx](/apps/dashboard/src/components/ui/dialog.tsx) | TypeScript JSX | -19 | 0 | 0 | -19 |
| [apps/dashboard/src/components/ui/feature-gate.tsx](/apps/dashboard/src/components/ui/feature-gate.tsx) | TypeScript JSX | 102 | 20 | 14 | 136 |
| [apps/dashboard/src/components/ui/usage-bar.tsx](/apps/dashboard/src/components/ui/usage-bar.tsx) | TypeScript JSX | 55 | 5 | 9 | 69 |
| [apps/dashboard/src/generated/prisma/browser.ts](/apps/dashboard/src/generated/prisma/browser.ts) | TypeScript | 4 | 16 | 0 | 20 |
| [apps/dashboard/src/generated/prisma/client.ts](/apps/dashboard/src/generated/prisma/client.ts) | TypeScript | 4 | 16 | 0 | 20 |
| [apps/dashboard/src/generated/prisma/commonInputTypes.ts](/apps/dashboard/src/generated/prisma/commonInputTypes.ts) | TypeScript | 179 | 0 | 18 | 197 |
| [apps/dashboard/src/generated/prisma/enums.ts](/apps/dashboard/src/generated/prisma/enums.ts) | TypeScript | 16 | 0 | 6 | 22 |
| [apps/dashboard/src/generated/prisma/internal/class.ts](/apps/dashboard/src/generated/prisma/internal/class.ts) | TypeScript | 4 | 32 | 4 | 40 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespace.ts) | TypeScript | 387 | 12 | 27 | 426 |
| [apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts](/apps/dashboard/src/generated/prisma/internal/prismaNamespaceBrowser.ts) | TypeScript | 83 | 0 | 15 | 98 |
| [apps/dashboard/src/generated/prisma/models.ts](/apps/dashboard/src/generated/prisma/models.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/generated/prisma/models/Environment.ts](/apps/dashboard/src/generated/prisma/models/Environment.ts) | TypeScript | 100 | 15 | 11 | 126 |
| [apps/dashboard/src/generated/prisma/models/Event.ts](/apps/dashboard/src/generated/prisma/models/Event.ts) | TypeScript | 956 | 34 | 39 | 1,029 |
| [apps/dashboard/src/generated/prisma/models/Issue.ts](/apps/dashboard/src/generated/prisma/models/Issue.ts) | TypeScript | 115 | 15 | 10 | 140 |
| [apps/dashboard/src/generated/prisma/models/Organization.ts](/apps/dashboard/src/generated/prisma/models/Organization.ts) | TypeScript | 39 | 0 | 1 | 40 |
| [apps/dashboard/src/generated/prisma/models/Project.ts](/apps/dashboard/src/generated/prisma/models/Project.ts) | TypeScript | 453 | 45 | 33 | 531 |
| [apps/dashboard/src/generated/prisma/models/Release.ts](/apps/dashboard/src/generated/prisma/models/Release.ts) | TypeScript | 946 | 677 | 127 | 1,750 |
| [apps/dashboard/src/generated/prisma/models/ReplayChunk.ts](/apps/dashboard/src/generated/prisma/models/ReplayChunk.ts) | TypeScript | 779 | 653 | 110 | 1,542 |
| [apps/dashboard/src/generated/prisma/models/ReplaySession.ts](/apps/dashboard/src/generated/prisma/models/ReplaySession.ts) | TypeScript | 1,671 | 689 | 142 | 2,502 |
| [apps/dashboard/src/generated/prisma/models/TelemetrySession.ts](/apps/dashboard/src/generated/prisma/models/TelemetrySession.ts) | TypeScript | 1,033 | 667 | 134 | 1,834 |
| [apps/dashboard/src/lib/auth.ts](/apps/dashboard/src/lib/auth.ts) | TypeScript | 83 | 0 | 9 | 92 |
| [apps/dashboard/src/lib/cors.ts](/apps/dashboard/src/lib/cors.ts) | TypeScript | 50 | 7 | 10 | 67 |
| [apps/dashboard/src/lib/email.ts](/apps/dashboard/src/lib/email.ts) | TypeScript | 31 | 0 | 4 | 35 |
| [apps/dashboard/src/lib/entitlements.ts](/apps/dashboard/src/lib/entitlements.ts) | TypeScript | 81 | 34 | 24 | 139 |
| [apps/dashboard/src/lib/investigation/evidence.ts](/apps/dashboard/src/lib/investigation/evidence.ts) | TypeScript | 190 | 40 | 62 | 292 |
| [apps/dashboard/src/lib/investigation/interpreter.ts](/apps/dashboard/src/lib/investigation/interpreter.ts) | TypeScript | 784 | 51 | 97 | 932 |
| [apps/dashboard/src/lib/investigation/run.ts](/apps/dashboard/src/lib/investigation/run.ts) | TypeScript | 23 | 96 | 3 | 122 |
| [apps/dashboard/src/lib/plans.ts](/apps/dashboard/src/lib/plans.ts) | TypeScript | 201 | 46 | 11 | 258 |
| [packages/investigation-engine/src/detection/deterministic/patterns.ts](/packages/investigation-engine/src/detection/deterministic/patterns.ts) | TypeScript | 137 | 0 | 8 | 145 |
| [packages/investigation-engine/src/detection/deterministic/security.ts](/packages/investigation-engine/src/detection/deterministic/security.ts) | TypeScript | 59 | 2 | 8 | 69 |
| [packages/investigation-engine/src/detection/statistical/baselines.ts](/packages/investigation-engine/src/detection/statistical/baselines.ts) | TypeScript | 49 | 0 | 11 | 60 |
| [packages/investigation-engine/src/detection/statistical/distribution.ts](/packages/investigation-engine/src/detection/statistical/distribution.ts) | TypeScript | 48 | 1 | 9 | 58 |
| [packages/investigation-engine/src/detection/statistical/latency.ts](/packages/investigation-engine/src/detection/statistical/latency.ts) | TypeScript | 50 | 1 | 8 | 59 |
| [packages/investigation-engine/src/detection/statistical/rate-burst.ts](/packages/investigation-engine/src/detection/statistical/rate-burst.ts) | TypeScript | 64 | 3 | 12 | 79 |
| [packages/investigation-engine/src/detection/temporal/cascade.ts](/packages/investigation-engine/src/detection/temporal/cascade.ts) | TypeScript | 62 | 1 | 13 | 76 |
| [packages/investigation-engine/src/detection/temporal/sequences.ts](/packages/investigation-engine/src/detection/temporal/sequences.ts) | TypeScript | 54 | 2 | 10 | 66 |
| [packages/investigation-engine/src/engine.ts](/packages/investigation-engine/src/engine.ts) | TypeScript | 93 | 0 | 7 | 100 |
| [packages/investigation-engine/src/graph/builder.ts](/packages/investigation-engine/src/graph/builder.ts) | TypeScript | 105 | 4 | 19 | 128 |
| [packages/investigation-engine/src/graph/propagation.ts](/packages/investigation-engine/src/graph/propagation.ts) | TypeScript | 102 | 2 | 24 | 128 |
| [packages/investigation-engine/src/hypotheses/deployment.ts](/packages/investigation-engine/src/hypotheses/deployment.ts) | TypeScript | 211 | 10 | 27 | 248 |
| [packages/investigation-engine/src/hypotheses/dynamic-anomaly.ts](/packages/investigation-engine/src/hypotheses/dynamic-anomaly.ts) | TypeScript | 57 | 4 | 9 | 70 |
| [packages/investigation-engine/src/hypotheses/resource-saturation.ts](/packages/investigation-engine/src/hypotheses/resource-saturation.ts) | TypeScript | 45 | 0 | 7 | 52 |
| [packages/investigation-engine/src/hypotheses/security-incident.ts](/packages/investigation-engine/src/hypotheses/security-incident.ts) | TypeScript | 43 | 0 | 6 | 49 |
| [packages/investigation-engine/src/index.ts](/packages/investigation-engine/src/index.ts) | TypeScript | 10 | 0 | 0 | 10 |
| [packages/investigation-engine/src/normalization/clock.ts](/packages/investigation-engine/src/normalization/clock.ts) | TypeScript | 38 | 8 | 6 | 52 |
| [packages/investigation-engine/src/normalization/parser.ts](/packages/investigation-engine/src/normalization/parser.ts) | TypeScript | 198 | 10 | 33 | 241 |
| [packages/investigation-engine/src/normalization/scrubber.ts](/packages/investigation-engine/src/normalization/scrubber.ts) | TypeScript | 54 | 18 | 13 | 85 |
| [packages/investigation-engine/src/novelty/novelty-detector.ts](/packages/investigation-engine/src/novelty/novelty-detector.ts) | TypeScript | 68 | 1 | 11 | 80 |
| [packages/investigation-engine/src/novelty/template-miner.ts](/packages/investigation-engine/src/novelty/template-miner.ts) | TypeScript | 74 | 16 | 22 | 112 |
| [packages/investigation-engine/src/pipeline/build-context.ts](/packages/investigation-engine/src/pipeline/build-context.ts) | TypeScript | 93 | 1 | 15 | 109 |
| [packages/investigation-engine/src/pipeline/changes.ts](/packages/investigation-engine/src/pipeline/changes.ts) | TypeScript | 3 | 0 | 0 | 3 |
| [packages/investigation-engine/src/pipeline/correlate.ts](/packages/investigation-engine/src/pipeline/correlate.ts) | TypeScript | 588 | -31 | 98 | 655 |
| [packages/investigation-engine/src/pipeline/evaluate.ts](/packages/investigation-engine/src/pipeline/evaluate.ts) | TypeScript | 541 | 178 | 89 | 808 |
| [packages/investigation-engine/src/pipeline/hypotheses.ts](/packages/investigation-engine/src/pipeline/hypotheses.ts) | TypeScript | 334 | -29 | 58 | 363 |
| [packages/investigation-engine/src/pipeline/impact.ts](/packages/investigation-engine/src/pipeline/impact.ts) | TypeScript | 70 | 0 | 7 | 77 |
| [packages/investigation-engine/src/pipeline/normalize.ts](/packages/investigation-engine/src/pipeline/normalize.ts) | TypeScript | 157 | 1 | 46 | 204 |
| [packages/investigation-engine/src/pipeline/rank.ts](/packages/investigation-engine/src/pipeline/rank.ts) | TypeScript | 194 | 160 | 30 | 384 |
| [packages/investigation-engine/src/pipeline/recommend.ts](/packages/investigation-engine/src/pipeline/recommend.ts) | TypeScript | 431 | 0 | 87 | 518 |
| [packages/investigation-engine/src/pipeline/report.ts](/packages/investigation-engine/src/pipeline/report.ts) | TypeScript | 224 | 0 | 27 | 251 |
| [packages/investigation-engine/src/pipeline/root-cause.ts](/packages/investigation-engine/src/pipeline/root-cause.ts) | TypeScript | 128 | 0 | 21 | 149 |
| [packages/investigation-engine/src/pipeline/timeline.ts](/packages/investigation-engine/src/pipeline/timeline.ts) | TypeScript | 24 | 0 | 7 | 31 |
| [packages/investigation-engine/src/pipeline/validate.ts](/packages/investigation-engine/src/pipeline/validate.ts) | TypeScript | 676 | 187 | 91 | 954 |
| [packages/investigation-engine/src/rules/pre-existing-error.ts](/packages/investigation-engine/src/rules/pre-existing-error.ts) | TypeScript | -15 | 0 | -14 | -29 |
| [packages/investigation-engine/src/rules/recovery.ts](/packages/investigation-engine/src/rules/recovery.ts) | TypeScript | 10 | 0 | 5 | 15 |
| [packages/investigation-engine/src/suppression/health-checks.ts](/packages/investigation-engine/src/suppression/health-checks.ts) | TypeScript | 33 | 2 | 10 | 45 |
| [packages/investigation-engine/src/suppression/retry-storms.ts](/packages/investigation-engine/src/suppression/retry-storms.ts) | TypeScript | 30 | 2 | 7 | 39 |
| [packages/investigation-engine/src/types/anomaly.ts](/packages/investigation-engine/src/types/anomaly.ts) | TypeScript | 43 | 0 | 5 | 48 |
| [packages/investigation-engine/src/types/confidence.ts](/packages/investigation-engine/src/types/confidence.ts) | TypeScript | 22 | 0 | 5 | 27 |
| [packages/investigation-engine/src/types/context.ts](/packages/investigation-engine/src/types/context.ts) | TypeScript | 5 | 0 | 3 | 8 |
| [packages/investigation-engine/src/types/evidence-score.ts](/packages/investigation-engine/src/types/evidence-score.ts) | TypeScript | 0 | 0 | 2 | 2 |
| [packages/investigation-engine/src/types/evidence.ts](/packages/investigation-engine/src/types/evidence.ts) | TypeScript | 15 | -104 | 11 | -78 |
| [packages/investigation-engine/src/types/graph.ts](/packages/investigation-engine/src/types/graph.ts) | TypeScript | 3 | 0 | 6 | 9 |
| [packages/investigation-engine/src/types/hypothesis.ts](/packages/investigation-engine/src/types/hypothesis.ts) | TypeScript | 0 | 0 | 2 | 2 |
| [packages/investigation-engine/src/types/impact.ts](/packages/investigation-engine/src/types/impact.ts) | TypeScript | 5 | 0 | 1 | 6 |
| [packages/investigation-engine/src/types/investigation.ts](/packages/investigation-engine/src/types/investigation.ts) | TypeScript | 15 | 0 | 3 | 18 |
| [packages/investigation-engine/src/types/telemetry.ts](/packages/investigation-engine/src/types/telemetry.ts) | TypeScript | 13 | 0 | 1 | 14 |
| [packages/investigation-engine/src/types/template.ts](/packages/investigation-engine/src/types/template.ts) | TypeScript | 18 | 0 | 2 | 20 |
| [packages/replay/dist/index.cjs](/packages/replay/dist/index.cjs) | JavaScript | 357 | 11 | 6 | 374 |
| [packages/replay/dist/index.d.cts](/packages/replay/dist/index.d.cts) | TypeScript | 69 | 60 | 4 | 133 |
| [packages/replay/dist/index.d.ts](/packages/replay/dist/index.d.ts) | TypeScript | 69 | 60 | 4 | 133 |
| [packages/replay/dist/index.js](/packages/replay/dist/index.js) | JavaScript | 334 | 9 | 4 | 347 |
| [packages/replay/package.json](/packages/replay/package.json) | JSON | 42 | 0 | 1 | 43 |
| [packages/replay/src/index.ts](/packages/replay/src/index.ts) | TypeScript | 2 | 0 | 1 | 3 |
| [packages/replay/src/masker.ts](/packages/replay/src/masker.ts) | TypeScript | 90 | 0 | 11 | 101 |
| [packages/replay/src/recorder.ts](/packages/replay/src/recorder.ts) | TypeScript | 138 | 12 | 24 | 174 |
| [packages/replay/src/ring-buffer.ts](/packages/replay/src/ring-buffer.ts) | TypeScript | 43 | 3 | 11 | 57 |
| [packages/replay/src/types.ts](/packages/replay/src/types.ts) | TypeScript | 41 | 57 | 4 | 102 |
| [packages/replay/src/uploader.ts](/packages/replay/src/uploader.ts) | TypeScript | 96 | 1 | 15 | 112 |
| [packages/replay/tsconfig.json](/packages/replay/tsconfig.json) | JSON with Comments | 16 | 0 | 1 | 17 |
| [packages/replay/tsup.config.ts](/packages/replay/tsup.config.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [packages/sdk/README.md](/packages/sdk/README.md) | Markdown | 272 | 0 | 107 | 379 |
| [packages/sdk/dist/index.cjs](/packages/sdk/dist/index.cjs) | JavaScript | 608 | 16 | 7 | 631 |
| [packages/sdk/dist/index.d.cts](/packages/sdk/dist/index.d.cts) | TypeScript | 86 | 30 | 3 | 119 |
| [packages/sdk/dist/index.d.ts](/packages/sdk/dist/index.d.ts) | TypeScript | 86 | 30 | 3 | 119 |
| [packages/sdk/dist/index.js](/packages/sdk/dist/index.js) | JavaScript | 585 | 14 | 5 | 604 |
| [packages/sdk/package.json](/packages/sdk/package.json) | JSON | 35 | 0 | 0 | 35 |
| [packages/sdk/src/capture.ts](/packages/sdk/src/capture.ts) | TypeScript | 12 | 8 | 4 | 24 |
| [packages/sdk/src/client.ts](/packages/sdk/src/client.ts) | TypeScript | 9 | 0 | 3 | 12 |
| [packages/sdk/src/halo.ts](/packages/sdk/src/halo.ts) | TypeScript | 170 | 17 | 57 | 244 |
| [packages/sdk/src/http.ts](/packages/sdk/src/http.ts) | TypeScript | 386 | 80 | 87 | 553 |
| [packages/sdk/src/request-context.ts](/packages/sdk/src/request-context.ts) | TypeScript | 58 | 0 | 17 | 75 |
| [packages/sdk/src/types.ts](/packages/sdk/src/types.ts) | TypeScript | 21 | 30 | 19 | 70 |
| [packages/sdk/tsup.config.ts](/packages/sdk/tsup.config.ts) | TypeScript | 9 | 0 | 1 | 10 |
| [pnpm-lock.yaml](/pnpm-lock.yaml) | YAML | 751 | 0 | 205 | 956 |
| [pnpm-workspace.yaml](/pnpm-workspace.yaml) | YAML | 2 | 0 | 1 | 3 |
| [prisma/migrations/20260811083815\_add\_project\_telemetry/migration.sql](/prisma/migrations/20260811083815_add_project_telemetry/migration.sql) | MS SQL | 30 | 13 | 14 | 57 |
| [prisma/migrations/20260811101729\_add\_releases/migration.sql](/prisma/migrations/20260811101729_add_releases/migration.sql) | MS SQL | 22 | 10 | 11 | 43 |
| [prisma/migrations/20260811133328\_add\_http\_correlation/migration.sql](/prisma/migrations/20260811133328_add_http_correlation/migration.sql) | MS SQL | 2 | 1 | 1 | 4 |
| [prisma/migrations/20260811134655\_add\_http\_correlation/migration.sql](/prisma/migrations/20260811134655_add_http_correlation/migration.sql) | MS SQL | 2 | 2 | 2 | 6 |
| [prisma/migrations/20260822165541\_add\_org\_plan/migration.sql](/prisma/migrations/20260822165541_add_org_plan/migration.sql) | MS SQL | 2 | 2 | 2 | 6 |
| [prisma/migrations/20260822175221\_add\_session\_replay/migration.sql](/prisma/migrations/20260822175221_add_session_replay/migration.sql) | MS SQL | 51 | 15 | 17 | 83 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details
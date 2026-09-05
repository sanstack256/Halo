# Diff Details

Date : 2026-09-06 00:31:29

Directory /Users/nssanjeev/Development/Halo

Total : 164 files,  25567 codes, 1230 comments, 2404 blanks, all 29201 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [apps/dashboard/package.json](/apps/dashboard/package.json) | JSON | 2 | 0 | 0 | 2 |
| [apps/dashboard/src/actions/analytics.ts](/apps/dashboard/src/actions/analytics.ts) | TypeScript | 16 | 3 | 9 | 28 |
| [apps/dashboard/src/actions/explore.ts](/apps/dashboard/src/actions/explore.ts) | TypeScript | 261 | 11 | 35 | 307 |
| [apps/dashboard/src/actions/issue.ts](/apps/dashboard/src/actions/issue.ts) | TypeScript | 288 | 1 | 26 | 315 |
| [apps/dashboard/src/actions/overview.ts](/apps/dashboard/src/actions/overview.ts) | TypeScript | 130 | 34 | 13 | 177 |
| [apps/dashboard/src/actions/project.ts](/apps/dashboard/src/actions/project.ts) | TypeScript | 6 | 0 | 0 | 6 |
| [apps/dashboard/src/actions/services.ts](/apps/dashboard/src/actions/services.ts) | TypeScript | 80 | 3 | 7 | 90 |
| [apps/dashboard/src/app/(dashboard)/dashboards/page.tsx](/apps/dashboard/src/app/(dashboard)/dashboards/page.tsx) | TypeScript JSX | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/app/(dashboard)/explore/database/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/database/page.tsx) | TypeScript JSX | 6 | 0 | 2 | 8 |
| [apps/dashboard/src/app/(dashboard)/explore/errors/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/errors/page.tsx) | TypeScript JSX | -19 | 0 | 0 | -19 |
| [apps/dashboard/src/app/(dashboard)/explore/infrastructure/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/infrastructure/page.tsx) | TypeScript JSX | 7 | 0 | 2 | 9 |
| [apps/dashboard/src/app/(dashboard)/explore/logs/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/logs/page.tsx) | TypeScript JSX | -15 | 0 | 0 | -15 |
| [apps/dashboard/src/app/(dashboard)/explore/metrics/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/metrics/page.tsx) | TypeScript JSX | -5 | 0 | -1 | -6 |
| [apps/dashboard/src/app/(dashboard)/explore/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/page.tsx) | TypeScript JSX | -37 | -2 | -5 | -44 |
| [apps/dashboard/src/app/(dashboard)/explore/requests/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/requests/page.tsx) | TypeScript JSX | -19 | 0 | 0 | -19 |
| [apps/dashboard/src/app/(dashboard)/explore/traces/page.tsx](/apps/dashboard/src/app/(dashboard)/explore/traces/page.tsx) | TypeScript JSX | -19 | 0 | 0 | -19 |
| [apps/dashboard/src/app/(dashboard)/issues/evidence-gaps/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/evidence-gaps/page.tsx) | TypeScript JSX | 31 | 0 | 6 | 37 |
| [apps/dashboard/src/app/(dashboard)/issues/evolution/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/evolution/page.tsx) | TypeScript JSX | 31 | 0 | 6 | 37 |
| [apps/dashboard/src/app/(dashboard)/issues/impact/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/impact/page.tsx) | TypeScript JSX | 31 | 0 | 6 | 37 |
| [apps/dashboard/src/app/(dashboard)/issues/layout.tsx](/apps/dashboard/src/app/(dashboard)/issues/layout.tsx) | TypeScript JSX | 58 | 3 | 7 | 68 |
| [apps/dashboard/src/app/(dashboard)/issues/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/page.tsx) | TypeScript JSX | 15 | 0 | 2 | 17 |
| [apps/dashboard/src/app/(dashboard)/issues/patterns/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/patterns/page.tsx) | TypeScript JSX | 31 | 0 | 6 | 37 |
| [apps/dashboard/src/app/(dashboard)/issues/resolution/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/resolution/page.tsx) | TypeScript JSX | 31 | 0 | 6 | 37 |
| [apps/dashboard/src/app/(dashboard)/issues/triage/page.tsx](/apps/dashboard/src/app/(dashboard)/issues/triage/page.tsx) | TypeScript JSX | 2 | 0 | 1 | 3 |
| [apps/dashboard/src/app/(dashboard)/overview/page.tsx](/apps/dashboard/src/app/(dashboard)/overview/page.tsx) | TypeScript JSX | 80 | 10 | -3 | 87 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/investigations/new/page.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/investigations/new/page.tsx) | TypeScript JSX | 473 | 15 | 16 | 504 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/layout.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/layout.tsx) | TypeScript JSX | 17 | 0 | 2 | 19 |
| [apps/dashboard/src/app/(dashboard)/projects/\[id\]/settings/github-settings-card.tsx](/apps/dashboard/src/app/(dashboard)/projects/%5Bid%5D/settings/github-settings-card.tsx) | TypeScript JSX | 3 | 0 | 0 | 3 |
| [apps/dashboard/src/app/(dashboard)/services/\[serviceId\]/page.tsx](/apps/dashboard/src/app/(dashboard)/services/%5BserviceId%5D/page.tsx) | TypeScript JSX | 34 | 0 | 5 | 39 |
| [apps/dashboard/src/app/(dashboard)/services/critical/page.tsx](/apps/dashboard/src/app/(dashboard)/services/critical/page.tsx) | TypeScript JSX | -48 | 0 | -5 | -53 |
| [apps/dashboard/src/app/(dashboard)/services/degraded/page.tsx](/apps/dashboard/src/app/(dashboard)/services/degraded/page.tsx) | TypeScript JSX | -48 | 0 | -5 | -53 |
| [apps/dashboard/src/app/(dashboard)/services/dependencies/page.tsx](/apps/dashboard/src/app/(dashboard)/services/dependencies/page.tsx) | TypeScript JSX | -15 | 0 | 0 | -15 |
| [apps/dashboard/src/app/(dashboard)/services/health/page.tsx](/apps/dashboard/src/app/(dashboard)/services/health/page.tsx) | TypeScript JSX | 32 | 0 | 5 | 37 |
| [apps/dashboard/src/app/(dashboard)/services/healthy/page.tsx](/apps/dashboard/src/app/(dashboard)/services/healthy/page.tsx) | TypeScript JSX | -48 | 0 | -5 | -53 |
| [apps/dashboard/src/app/(dashboard)/services/page.tsx](/apps/dashboard/src/app/(dashboard)/services/page.tsx) | TypeScript JSX | -20 | 0 | 0 | -20 |
| [apps/dashboard/src/app/(dashboard)/settings/account-details-client.tsx](/apps/dashboard/src/app/(dashboard)/settings/account-details-client.tsx) | TypeScript JSX | 9 | 0 | 5 | 14 |
| [apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx](/apps/dashboard/src/app/(dashboard)/settings/project/project-settings-form.tsx) | TypeScript JSX | 7 | 0 | 2 | 9 |
| [apps/dashboard/src/app/docs/docs-client.tsx](/apps/dashboard/src/app/docs/docs-client.tsx) | TypeScript JSX | 1,585 | 42 | 103 | 1,730 |
| [apps/dashboard/src/app/docs/page.tsx](/apps/dashboard/src/app/docs/page.tsx) | TypeScript JSX | 10 | 0 | 3 | 13 |
| [apps/dashboard/src/app/docs/search-index.ts](/apps/dashboard/src/app/docs/search-index.ts) | TypeScript | 323 | 0 | 2 | 325 |
| [apps/dashboard/src/app/globals.css](/apps/dashboard/src/app/globals.css) | PostCSS | 715 | 22 | 83 | 820 |
| [apps/dashboard/src/app/layout.tsx](/apps/dashboard/src/app/layout.tsx) | TypeScript JSX | 8 | 0 | 0 | 8 |
| [apps/dashboard/src/app/page.tsx](/apps/dashboard/src/app/page.tsx) | TypeScript JSX | 9 | 0 | 2 | 11 |
| [apps/dashboard/src/app/pricing/page.tsx](/apps/dashboard/src/app/pricing/page.tsx) | TypeScript JSX | 5 | 0 | 0 | 5 |
| [apps/dashboard/src/app/reset-password/reset-password-form.tsx](/apps/dashboard/src/app/reset-password/reset-password-form.tsx) | TypeScript JSX | -4 | 0 | 0 | -4 |
| [apps/dashboard/src/components/alerts/alert-detail-actions.tsx](/apps/dashboard/src/components/alerts/alert-detail-actions.tsx) | TypeScript JSX | -1 | 0 | 0 | -1 |
| [apps/dashboard/src/components/auth/forgot-password-form.tsx](/apps/dashboard/src/components/auth/forgot-password-form.tsx) | TypeScript JSX | -4 | 0 | 0 | -4 |
| [apps/dashboard/src/components/auth/sign-in-form.tsx](/apps/dashboard/src/components/auth/sign-in-form.tsx) | TypeScript JSX | -4 | 0 | 0 | -4 |
| [apps/dashboard/src/components/auth/sign-up-form.tsx](/apps/dashboard/src/components/auth/sign-up-form.tsx) | TypeScript JSX | -4 | 0 | 0 | -4 |
| [apps/dashboard/src/components/dashboards/blast-radius-panel.tsx](/apps/dashboard/src/components/dashboards/blast-radius-panel.tsx) | TypeScript JSX | -1 | 0 | 0 | -1 |
| [apps/dashboard/src/components/dashboards/change-explanation-panel.tsx](/apps/dashboard/src/components/dashboards/change-explanation-panel.tsx) | TypeScript JSX | 34 | 3 | 1 | 38 |
| [apps/dashboard/src/components/dashboards/change-impact-modal.tsx](/apps/dashboard/src/components/dashboards/change-impact-modal.tsx) | TypeScript JSX | 9 | 0 | 0 | 9 |
| [apps/dashboard/src/components/dashboards/change-intelligence-client.tsx](/apps/dashboard/src/components/dashboards/change-intelligence-client.tsx) | TypeScript JSX | 12 | 1 | 1 | 14 |
| [apps/dashboard/src/components/dashboards/change-timeline-view.tsx](/apps/dashboard/src/components/dashboards/change-timeline-view.tsx) | TypeScript JSX | -38 | 1 | -6 | -43 |
| [apps/dashboard/src/components/dashboards/dashboard-filter-bar.tsx](/apps/dashboard/src/components/dashboards/dashboard-filter-bar.tsx) | TypeScript JSX | -7 | 0 | 1 | -6 |
| [apps/dashboard/src/components/dashboards/dashboard-provenance-modal.tsx](/apps/dashboard/src/components/dashboards/dashboard-provenance-modal.tsx) | TypeScript JSX | 16 | 1 | 1 | 18 |
| [apps/dashboard/src/components/dashboards/dependency-intelligence-client.tsx](/apps/dashboard/src/components/dashboards/dependency-intelligence-client.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/components/dashboards/dependency-topology-graph.tsx](/apps/dashboard/src/components/dashboards/dependency-topology-graph.tsx) | TypeScript JSX | 203 | 4 | 11 | 218 |
| [apps/dashboard/src/components/dashboards/multi-signal-timeline-chart.tsx](/apps/dashboard/src/components/dashboards/multi-signal-timeline-chart.tsx) | TypeScript JSX | 551 | 37 | 60 | 648 |
| [apps/dashboard/src/components/dashboards/recurring-pattern-modal.tsx](/apps/dashboard/src/components/dashboards/recurring-pattern-modal.tsx) | TypeScript JSX | 47 | 1 | 7 | 55 |
| [apps/dashboard/src/components/dashboards/reliability-lab-client.tsx](/apps/dashboard/src/components/dashboards/reliability-lab-client.tsx) | TypeScript JSX | -5 | 0 | 0 | -5 |
| [apps/dashboard/src/components/dashboards/reliability-posture-view.tsx](/apps/dashboard/src/components/dashboards/reliability-posture-view.tsx) | TypeScript JSX | -12 | -4 | -5 | -21 |
| [apps/dashboard/src/components/dashboards/reliability-trajectory-chart.tsx](/apps/dashboard/src/components/dashboards/reliability-trajectory-chart.tsx) | TypeScript JSX | 411 | 30 | 45 | 486 |
| [apps/dashboard/src/components/dashboards/service-inspector-drawer.tsx](/apps/dashboard/src/components/dashboards/service-inspector-drawer.tsx) | TypeScript JSX | 18 | 3 | 2 | 23 |
| [apps/dashboard/src/components/dashboards/service-landscape-client.tsx](/apps/dashboard/src/components/dashboards/service-landscape-client.tsx) | TypeScript JSX | -7 | 1 | -3 | -9 |
| [apps/dashboard/src/components/dashboards/service-matrix-table.tsx](/apps/dashboard/src/components/dashboards/service-matrix-table.tsx) | TypeScript JSX | -139 | 0 | -2 | -141 |
| [apps/dashboard/src/components/dashboards/synchronized-timeline.tsx](/apps/dashboard/src/components/dashboards/synchronized-timeline.tsx) | TypeScript JSX | -213 | -14 | -24 | -251 |
| [apps/dashboard/src/components/dashboards/system-explorer-client.tsx](/apps/dashboard/src/components/dashboards/system-explorer-client.tsx) | TypeScript JSX | 40 | 7 | 0 | 47 |
| [apps/dashboard/src/components/events/breadcrumbs.tsx](/apps/dashboard/src/components/events/breadcrumbs.tsx) | TypeScript JSX | -3 | 0 | 0 | -3 |
| [apps/dashboard/src/components/events/event-detail-view.tsx](/apps/dashboard/src/components/events/event-detail-view.tsx) | TypeScript JSX | 7 | 0 | 0 | 7 |
| [apps/dashboard/src/components/explore/copy-button.tsx](/apps/dashboard/src/components/explore/copy-button.tsx) | TypeScript JSX | 35 | 1 | 6 | 42 |
| [apps/dashboard/src/components/explore/database-attribution-client.tsx](/apps/dashboard/src/components/explore/database-attribution-client.tsx) | TypeScript JSX | 229 | 7 | 15 | 251 |
| [apps/dashboard/src/components/explore/detail-drawer.tsx](/apps/dashboard/src/components/explore/detail-drawer.tsx) | TypeScript JSX | 355 | 14 | 24 | 393 |
| [apps/dashboard/src/components/explore/empty-state.tsx](/apps/dashboard/src/components/explore/empty-state.tsx) | TypeScript JSX | 63 | 0 | 6 | 69 |
| [apps/dashboard/src/components/explore/error-recipe-client.tsx](/apps/dashboard/src/components/explore/error-recipe-client.tsx) | TypeScript JSX | 261 | 9 | 19 | 289 |
| [apps/dashboard/src/components/explore/evidence-badge.tsx](/apps/dashboard/src/components/explore/evidence-badge.tsx) | TypeScript JSX | 85 | 0 | 3 | 88 |
| [apps/dashboard/src/components/explore/explore-context-bar.tsx](/apps/dashboard/src/components/explore/explore-context-bar.tsx) | TypeScript JSX | 173 | 6 | 17 | 196 |
| [apps/dashboard/src/components/explore/explore-header.tsx](/apps/dashboard/src/components/explore/explore-header.tsx) | TypeScript JSX | 42 | 0 | 5 | 47 |
| [apps/dashboard/src/components/explore/log-threader-client.tsx](/apps/dashboard/src/components/explore/log-threader-client.tsx) | TypeScript JSX | 222 | 7 | 19 | 248 |
| [apps/dashboard/src/components/explore/metric-twin-client.tsx](/apps/dashboard/src/components/explore/metric-twin-client.tsx) | TypeScript JSX | 329 | 11 | 20 | 360 |
| [apps/dashboard/src/components/explore/request-reconstruction-client.tsx](/apps/dashboard/src/components/explore/request-reconstruction-client.tsx) | TypeScript JSX | 349 | 13 | 30 | 392 |
| [apps/dashboard/src/components/explore/runtime-fingerprint-client.tsx](/apps/dashboard/src/components/explore/runtime-fingerprint-client.tsx) | TypeScript JSX | 241 | 7 | 19 | 267 |
| [apps/dashboard/src/components/explore/search-needle-client.tsx](/apps/dashboard/src/components/explore/search-needle-client.tsx) | TypeScript JSX | 521 | 18 | 27 | 566 |
| [apps/dashboard/src/components/explore/trace-divergence-client.tsx](/apps/dashboard/src/components/explore/trace-divergence-client.tsx) | TypeScript JSX | 315 | 11 | 24 | 350 |
| [apps/dashboard/src/components/investigation/causal-chain-view.tsx](/apps/dashboard/src/components/investigation/causal-chain-view.tsx) | TypeScript JSX | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/components/investigation/regression-detection-view.tsx](/apps/dashboard/src/components/investigation/regression-detection-view.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/components/issues/evidence-gaps-view.tsx](/apps/dashboard/src/components/issues/evidence-gaps-view.tsx) | TypeScript JSX | 139 | 7 | 15 | 161 |
| [apps/dashboard/src/components/issues/evolution-view.tsx](/apps/dashboard/src/components/issues/evolution-view.tsx) | TypeScript JSX | 318 | 11 | 22 | 351 |
| [apps/dashboard/src/components/issues/impact-view.tsx](/apps/dashboard/src/components/issues/impact-view.tsx) | TypeScript JSX | 250 | 6 | 16 | 272 |
| [apps/dashboard/src/components/issues/issue-detail-view.tsx](/apps/dashboard/src/components/issues/issue-detail-view.tsx) | TypeScript JSX | -9 | -1 | 0 | -10 |
| [apps/dashboard/src/components/issues/issues-filter-bar.tsx](/apps/dashboard/src/components/issues/issues-filter-bar.tsx) | TypeScript JSX | 119 | 7 | 19 | 145 |
| [apps/dashboard/src/components/issues/patterns-view.tsx](/apps/dashboard/src/components/issues/patterns-view.tsx) | TypeScript JSX | 234 | 9 | 15 | 258 |
| [apps/dashboard/src/components/issues/resolution-view.tsx](/apps/dashboard/src/components/issues/resolution-view.tsx) | TypeScript JSX | 261 | 8 | 15 | 284 |
| [apps/dashboard/src/components/issues/triage-view.tsx](/apps/dashboard/src/components/issues/triage-view.tsx) | TypeScript JSX | 329 | 15 | 24 | 368 |
| [apps/dashboard/src/components/landing/landing-page.tsx](/apps/dashboard/src/components/landing/landing-page.tsx) | TypeScript JSX | 1,634 | 56 | 87 | 1,777 |
| [apps/dashboard/src/components/monitors/monitor-detail-header.tsx](/apps/dashboard/src/components/monitors/monitor-detail-header.tsx) | TypeScript JSX | -1 | 0 | 0 | -1 |
| [apps/dashboard/src/components/monitors/monitor-form.tsx](/apps/dashboard/src/components/monitors/monitor-form.tsx) | TypeScript JSX | 6 | 0 | 2 | 8 |
| [apps/dashboard/src/components/monitors/monitor-future-investigation-slot.tsx](/apps/dashboard/src/components/monitors/monitor-future-investigation-slot.tsx) | TypeScript JSX | -1 | 0 | 0 | -1 |
| [apps/dashboard/src/components/overview/sidebar.tsx](/apps/dashboard/src/components/overview/sidebar.tsx) | TypeScript JSX | 8 | 0 | 0 | 8 |
| [apps/dashboard/src/components/projects/project-overview.tsx](/apps/dashboard/src/components/projects/project-overview.tsx) | TypeScript JSX | -24 | 0 | 0 | -24 |
| [apps/dashboard/src/components/services/service-dependencies-client.tsx](/apps/dashboard/src/components/services/service-dependencies-client.tsx) | TypeScript JSX | 497 | 16 | 35 | 548 |
| [apps/dashboard/src/components/services/service-detail-client.tsx](/apps/dashboard/src/components/services/service-detail-client.tsx) | TypeScript JSX | 499 | 15 | 26 | 540 |
| [apps/dashboard/src/components/services/service-health-client.tsx](/apps/dashboard/src/components/services/service-health-client.tsx) | TypeScript JSX | 483 | 10 | 34 | 527 |
| [apps/dashboard/src/components/services/services-inventory-client.tsx](/apps/dashboard/src/components/services/services-inventory-client.tsx) | TypeScript JSX | 558 | 22 | 46 | 626 |
| [apps/dashboard/src/components/ui/card.tsx](/apps/dashboard/src/components/ui/card.tsx) | TypeScript JSX | -3 | 0 | 0 | -3 |
| [apps/dashboard/src/lib/analytics/\_\_tests\_\_/analytics.test.ts](/apps/dashboard/src/lib/analytics/__tests__/analytics.test.ts) | TypeScript | 599 | 82 | 92 | 773 |
| [apps/dashboard/src/lib/analytics/\_\_tests\_\_/run-analytics-audit.ts](/apps/dashboard/src/lib/analytics/__tests__/run-analytics-audit.ts) | TypeScript | 113 | 6 | 10 | 129 |
| [apps/dashboard/src/lib/analytics/blast-radius.ts](/apps/dashboard/src/lib/analytics/blast-radius.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/lib/analytics/change-intelligence.ts](/apps/dashboard/src/lib/analytics/change-intelligence.ts) | TypeScript | 82 | 3 | 7 | 92 |
| [apps/dashboard/src/lib/analytics/dependency-intelligence.ts](/apps/dashboard/src/lib/analytics/dependency-intelligence.ts) | TypeScript | 10 | 1 | 0 | 11 |
| [apps/dashboard/src/lib/analytics/graph-layout.ts](/apps/dashboard/src/lib/analytics/graph-layout.ts) | TypeScript | 148 | 10 | 22 | 180 |
| [apps/dashboard/src/lib/analytics/occurrence-comparison.ts](/apps/dashboard/src/lib/analytics/occurrence-comparison.ts) | TypeScript | 89 | 5 | 12 | 106 |
| [apps/dashboard/src/lib/analytics/reliability-lab.ts](/apps/dashboard/src/lib/analytics/reliability-lab.ts) | TypeScript | 134 | 0 | 5 | 139 |
| [apps/dashboard/src/lib/analytics/service-landscape.ts](/apps/dashboard/src/lib/analytics/service-landscape.ts) | TypeScript | 177 | 5 | 16 | 198 |
| [apps/dashboard/src/lib/analytics/system-explorer.ts](/apps/dashboard/src/lib/analytics/system-explorer.ts) | TypeScript | 206 | 3 | 20 | 229 |
| [apps/dashboard/src/lib/analytics/time.ts](/apps/dashboard/src/lib/analytics/time.ts) | TypeScript | 29 | 0 | 3 | 32 |
| [apps/dashboard/src/lib/analytics/types.ts](/apps/dashboard/src/lib/analytics/types.ts) | TypeScript | 145 | 0 | 8 | 153 |
| [apps/dashboard/src/lib/date-format.ts](/apps/dashboard/src/lib/date-format.ts) | TypeScript | 79 | 12 | 1 | 92 |
| [apps/dashboard/src/lib/explore/\_\_tests\_\_/explore-suite.test.ts](/apps/dashboard/src/lib/explore/__tests__/explore-suite.test.ts) | TypeScript | 170 | 34 | 31 | 235 |
| [apps/dashboard/src/lib/explore/canonical-evidence-access.ts](/apps/dashboard/src/lib/explore/canonical-evidence-access.ts) | TypeScript | 439 | 10 | 37 | 486 |
| [apps/dashboard/src/lib/explore/db-attribution.ts](/apps/dashboard/src/lib/explore/db-attribution.ts) | TypeScript | 206 | 3 | 24 | 233 |
| [apps/dashboard/src/lib/explore/error-recipe.ts](/apps/dashboard/src/lib/explore/error-recipe.ts) | TypeScript | 346 | 8 | 43 | 397 |
| [apps/dashboard/src/lib/explore/evidence-needle.ts](/apps/dashboard/src/lib/explore/evidence-needle.ts) | TypeScript | 339 | 21 | 41 | 401 |
| [apps/dashboard/src/lib/explore/evidence-sufficiency.ts](/apps/dashboard/src/lib/explore/evidence-sufficiency.ts) | TypeScript | 229 | 17 | 28 | 274 |
| [apps/dashboard/src/lib/explore/evidence-types.ts](/apps/dashboard/src/lib/explore/evidence-types.ts) | TypeScript | 70 | 4 | 6 | 80 |
| [apps/dashboard/src/lib/explore/log-threader.ts](/apps/dashboard/src/lib/explore/log-threader.ts) | TypeScript | 267 | 10 | 43 | 320 |
| [apps/dashboard/src/lib/explore/metric-twin.ts](/apps/dashboard/src/lib/explore/metric-twin.ts) | TypeScript | 270 | 7 | 42 | 319 |
| [apps/dashboard/src/lib/explore/request-reconstruction.ts](/apps/dashboard/src/lib/explore/request-reconstruction.ts) | TypeScript | 279 | 8 | 31 | 318 |
| [apps/dashboard/src/lib/explore/runtime-fingerprint.ts](/apps/dashboard/src/lib/explore/runtime-fingerprint.ts) | TypeScript | 152 | 5 | 22 | 179 |
| [apps/dashboard/src/lib/explore/telemetry-repository.ts](/apps/dashboard/src/lib/explore/telemetry-repository.ts) | TypeScript | 238 | 1 | 25 | 264 |
| [apps/dashboard/src/lib/explore/trace-divergence.ts](/apps/dashboard/src/lib/explore/trace-divergence.ts) | TypeScript | 254 | 4 | 31 | 289 |
| [apps/dashboard/src/lib/investigation/\_\_tests\_\_/analyze-entrypoints.test.ts](/apps/dashboard/src/lib/investigation/__tests__/analyze-entrypoints.test.ts) | TypeScript | 200 | 2 | 22 | 224 |
| [apps/dashboard/src/lib/investigation/evidence-boundary.ts](/apps/dashboard/src/lib/investigation/evidence-boundary.ts) | TypeScript | 254 | 10 | 32 | 296 |
| [apps/dashboard/src/lib/investigation/interpreter.ts](/apps/dashboard/src/lib/investigation/interpreter.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [apps/dashboard/src/lib/investigation/regression/regression-detector.ts](/apps/dashboard/src/lib/investigation/regression/regression-detector.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [apps/dashboard/src/lib/investigation/run.ts](/apps/dashboard/src/lib/investigation/run.ts) | TypeScript | 222 | 9 | 19 | 250 |
| [apps/dashboard/src/lib/issues/\_\_tests\_\_/issue-intelligence.test.ts](/apps/dashboard/src/lib/issues/__tests__/issue-intelligence.test.ts) | TypeScript | 363 | 71 | 65 | 499 |
| [apps/dashboard/src/lib/issues/issue-intelligence.ts](/apps/dashboard/src/lib/issues/issue-intelligence.ts) | TypeScript | 1,427 | 56 | 166 | 1,649 |
| [apps/dashboard/src/lib/monitors/\_\_tests\_\_/evaluator.test.ts](/apps/dashboard/src/lib/monitors/__tests__/evaluator.test.ts) | TypeScript | -8 | 0 | -2 | -10 |
| [apps/dashboard/src/lib/services/\_\_tests\_\_/service-registry.test.ts](/apps/dashboard/src/lib/services/__tests__/service-registry.test.ts) | TypeScript | 149 | 0 | 23 | 172 |
| [apps/dashboard/src/lib/services/service-registry.ts](/apps/dashboard/src/lib/services/service-registry.ts) | TypeScript | 757 | 35 | 82 | 874 |
| [apps/dashboard/src/lib/session.ts](/apps/dashboard/src/lib/session.ts) | TypeScript | 33 | 0 | 1 | 34 |
| [apps/dashboard/src/lib/timezone-server.ts](/apps/dashboard/src/lib/timezone-server.ts) | TypeScript | 12 | 3 | 3 | 18 |
| [apps/dashboard/src/lib/timezone.ts](/apps/dashboard/src/lib/timezone.ts) | TypeScript | 56 | 15 | 10 | 81 |
| [packages/investigation-engine/src/graph/propagation.ts](/packages/investigation-engine/src/graph/propagation.ts) | TypeScript | 10 | 0 | 0 | 10 |
| [packages/investigation-engine/src/pipeline/normalize.ts](/packages/investigation-engine/src/pipeline/normalize.ts) | TypeScript | 1 | 0 | 0 | 1 |
| [packages/investigation-engine/src/pipeline/rank.ts](/packages/investigation-engine/src/pipeline/rank.ts) | TypeScript | 0 | 5 | 4 | 9 |
| [packages/investigation-engine/src/types/evidence.ts](/packages/investigation-engine/src/types/evidence.ts) | TypeScript | 2 | 0 | 2 | 4 |
| [packages/sdk/dist/index.cjs](/packages/sdk/dist/index.cjs) | JavaScript | 3 | 0 | 0 | 3 |
| [packages/sdk/dist/index.d.cts](/packages/sdk/dist/index.d.cts) | TypeScript | 4 | 0 | 0 | 4 |
| [packages/sdk/dist/index.d.ts](/packages/sdk/dist/index.d.ts) | TypeScript | 4 | 0 | 0 | 4 |
| [packages/sdk/dist/index.js](/packages/sdk/dist/index.js) | JavaScript | 3 | 0 | 0 | 3 |
| [packages/sdk/src/halo.ts](/packages/sdk/src/halo.ts) | TypeScript | 7 | 0 | 2 | 9 |
| [packages/sdk/src/types.ts](/packages/sdk/src/types.ts) | TypeScript | 1 | 0 | 1 | 2 |
| [pnpm-lock.yaml](/pnpm-lock.yaml) | YAML | 34 | 0 | 8 | 42 |
| [scratch/browser-e2e-results.json](/scratch/browser-e2e-results.json) | JSON | 227 | 0 | 0 | 227 |
| [scratch/e2e-manifest.json](/scratch/e2e-manifest.json) | JSON | 95 | 0 | 0 | 95 |
| [scratch/e2e-report.json](/scratch/e2e-report.json) | JSON | 170 | 0 | 0 | 170 |
| [scratch/final-audit-results.json](/scratch/final-audit-results.json) | JSON | 385 | 0 | 0 | 385 |
| [scripts/browser-e2e-suite.ts](/scripts/browser-e2e-suite.ts) | TypeScript | 638 | 88 | 115 | 841 |
| [scripts/e2e-telemetry-generator.ts](/scripts/e2e-telemetry-generator.ts) | TypeScript | 596 | 50 | 68 | 714 |
| [scripts/final-validation-audit.ts](/scripts/final-validation-audit.ts) | TypeScript | 746 | 71 | 100 | 917 |
| [scripts/test-playwright-chrome.ts](/scripts/test-playwright-chrome.ts) | TypeScript | 31 | 0 | 3 | 34 |
| [scripts/verify-e2e-explore.ts](/scripts/verify-e2e-explore.ts) | TypeScript | 590 | 58 | 63 | 711 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details
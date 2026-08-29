-- AddColumn: githubRepoOwner, githubRepoName, githubToken, githubDefaultBranch, githubInstallationId
-- These columns support the GitHub integration for source code context in investigation reports.
-- They were added to schema.prisma and the local development database but lacked a corresponding migration,
-- causing the production Neon database to be missing these columns.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubRepoOwner" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubRepoName" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubToken" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubDefaultBranch" TEXT DEFAULT 'main';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "githubInstallationId" TEXT;

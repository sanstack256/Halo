# Halo Trace — Team Plan Phase 1 Foundation Forensic Report

**Document Name:** `svgforensic_team_phase1_foundation_report.md`  
**Phase:** Phase 1 — Database Schema + Multi-Member Entitlements Foundation  
**Phase Status:** `COMPLETE`  
**Date:** October 2, 2026  
**Auditor:** Antigravity Autonomous Agent  

---

# 1. Existing Architecture

Before introducing any modifications, the existing Halo Trace repository was forensically mapped:

- **User Model:** User identity is managed via Better-Auth in [`apps/dashboard/src/lib/auth.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/auth.ts) and backed by PostgreSQL `User` in [`prisma/schema.prisma`](file:///Users/nssanjeev/Development/Halo/prisma/schema.prisma).
- **Organization / Workspace Model:** The canonical workspace abstraction in Halo is `Organization`. Each organization has an `id`, `name`, `slug`, `createdAt`, `updatedAt`, `plan` (`FREE`, `DEVELOPER`, `TEAM`), and `projects`.
- **Project Model:** Projects belong to an `Organization` via `Project.organizationId`. Project access was traditionally resolved by matching `organizationId: organization.id`.
- **Membership Model:** Prior to Phase 1, there was **no multi-member relationship**. Each `Organization` had a single 1-to-1 relationship with its creator via `User.organizationId @unique` and `Organization.owner User?`. There were no roles, no membership status, and no intermediate membership table.
- **Subscription Model:** Subscriptions are tied directly to the `Organization` (`Organization.plan`). The organization is the canonical billing entity. Centralized plan metadata (prices, limits, and feature flags) is maintained in [`apps/dashboard/src/lib/plans.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/plans.ts).

---

# 2. Changes Made

| File | Reason | Change |
| :--- | :--- | :--- |
| [`prisma/schema.prisma`](file:///Users/nssanjeev/Development/Halo/prisma/schema.prisma) | Establish multi-member relationships and role hierarchy | Added `OrganizationRole` enum (`OWNER`, `ADMIN`, `MEMBER`), `MembershipStatus` enum (`ACTIVE`, `SUSPENDED`), and `OrganizationMember` model with cascade deletion. Added `members` relation to `Organization` and `memberships` relation to `User`. |
| [`apps/dashboard/src/lib/capabilities.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/capabilities.ts) | Establish central semantic capability registry | Created registry distinguishing resource limits from business capabilities (`TEAM_INVESTIGATION_ROOMS`, `TEAM_INCIDENT_COORDINATION`, etc.) and defined `planHasCapability`. |
| [`apps/dashboard/src/lib/authorization.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/authorization.ts) | Centralize server-side authorization and limit enforcement | Created authoritative server-side guard functions: `requireAuthenticatedUser`, `requireOrganizationMembership`, `requireOrganizationRole`, `requireProjectAccess`, `requireCapability`, and `assertResourceLimit`. |
| [`apps/dashboard/src/lib/organization.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/organization.ts) | Support multi-member resolution and owner initialization | Updated `getOrganization` to check `OrganizationMember` records. Updated `ensureOrganization` to atomically create the `OrganizationMember` with `role = OWNER` in a transaction. |
| [`apps/dashboard/src/lib/entitlements.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/lib/entitlements.ts) | Extend entitlement checks for multi-member organizations | Updated `getOrgIdForUser` to check `OrganizationMember`, exported `getOrgPlan`, and added `canUse(orgId, capability)`. |
| [`apps/dashboard/src/actions/project.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/actions/project.ts) | Enforce project limits and role authorization on creation | In `createProject`, enforced `requireOrganizationRole(["OWNER", "ADMIN"])` and `assertResourceLimit("maxProjects")` server-side before database mutation. |
| [`apps/dashboard/src/actions/organization-members.ts`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/actions/organization-members.ts) | Manage team seats, roles, and member invitations | Created server actions with server-side checks: `getOrganizationMembers`, `addOrganizationMember`, `updateMemberRole`, `removeOrganizationMember`. Enforced seat limits, owner protection, and privilege escalation prevention. |
| [`apps/dashboard/src/components/team/members-client.tsx`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/components/team/members-client.tsx) | Minimal UI foundation for member management | Implemented interactive team capacity stats, active seats display, role dropdowns, member invite form, and capacity limit alerts. |
| [`apps/dashboard/src/app/(dashboard)/settings/members/page.tsx`](file:///Users/nssanjeev/Development/Halo/apps/dashboard/src/app/(dashboard)/settings/members/page.tsx) | Wire members settings view to server-side foundation | Connected page to `getOrganizationMembers()` and rendered `MembersClient`. |
| [`scripts/test-phase1-foundation.ts`](file:///Users/nssanjeev/Development/Halo/scripts/test-phase1-foundation.ts) | Exhaustive test suite for Phase 1 invariants | Built and executed 24 automated tests verifying authentication, roles, limits, tenant isolation, and plan transitions. |

---

# 3. Database Changes

### New Enums & Models in PostgreSQL
1. **`enum OrganizationRole`**:
   - Values: `OWNER`, `ADMIN`, `MEMBER`
2. **`enum MembershipStatus`**:
   - Values: `ACTIVE`, `SUSPENDED`
3. **`model OrganizationMember`**:
   - `id`: `String` (`@id @default(cuid())`)
   - `organizationId`: `String` (foreign key to `Organization.id`, `onDelete: Cascade`)
   - `userId`: `String` (foreign key to `User.id`, `onDelete: Cascade`)
   - `role`: `OrganizationRole` (`@default(MEMBER)`)
   - `status`: `MembershipStatus` (`@default(ACTIVE)`)
   - `createdAt`: `DateTime` (`@default(now())`)
   - `updatedAt`: `DateTime` (`@updatedAt`)
   - Constraints:
     - `@@unique([organizationId, userId])`
     - `@@index([organizationId])`
     - `@@index([userId])`

### Relation Updates
- `Organization`: added `members OrganizationMember[]`
- `User`: added `memberships OrganizationMember[]`

---

# 4. Authorization Model

Authorization is enforced strictly server-side through a layered security hierarchy:

```
1. Authentication (requireAuthenticatedUser)
      ↓
2. Organization Membership (requireOrganizationMembership)
      ↓
3. Role Authorization (requireOrganizationRole: OWNER | ADMIN | MEMBER)
      ↓
4. Project Boundary (requireProjectAccess: resolves project & verifies user belongs to owning org)
      ↓
5. Capability Verification (requireCapability: checks semantic capability against Organization.plan)
      ↓
6. Resource Limit Assertion (assertResourceLimit: maxProjects, maxMembers)
      ↓
7. Mutation Execution
```

### Role Semantics & Hierarchy
- **`OWNER`**: Can manage members, projects, organization configuration, and billing. Cannot be removed or demoted.
- **`ADMIN`**: Can manage members, projects, and organization settings. Cannot remove the `OWNER`, demote other `ADMIN`s, or change billing.
- **`MEMBER`**: Can access permitted projects and features. Cannot modify member roles, invite new members, alter billing, or promote self.

---

# 5. Entitlement Model

Resource limits and product capabilities are strictly separated:

### Resource Limits
- `maxProjects`: Free = 1, Developer = 5, Team = 10
- `maxMembers`: Free = 2, Developer = 1, Team = 10
- `maxEventsPerMonth`: Free = 50,000, Developer = 1,000,000, Team = 5,000,000
- `retentionDays`: Free = 7, Developer = 30, Team = 90

### Semantic Capabilities (`TeamCapability`)
- `TEAM_INVESTIGATION_ROOMS` (Team plan)
- `TEAM_INCIDENT_COORDINATION` (Team plan)
- `TEAM_OWNERSHIP_INTELLIGENCE` (Team plan)
- `TEAM_ORGANIZATIONAL_MEMORY` (Team plan)
- `TEAM_CROSS_SERVICE_TOPOLOGY` (Team plan)
- `TEAM_EVIDENCE_AUTOMATION` (Team plan)
- `SHARED_DASHBOARDS` (Team plan)
- `AUDIT_LOG` (Team plan)
- `ADVANCED_NOTIFICATIONS` (Team plan)

---

# 6. Plan Resolution

The server resolves plans authoritatively from the database:
1. `getOrganizationPlan(organizationId)` queries `Organization.plan` from PostgreSQL.
2. Client-provided cookies, query parameters, or local storage are never trusted.
3. Subscription upgrades (`DEVELOPER -> TEAM`) immediately unlock Team capabilities across all server actions without requiring re-login.

---

# 7. Security Audit

- **Tenant Isolation:** A user belonging to Organization A cannot access projects belonging to Organization B, cannot query Organization B's members, and cannot perform mutations on Organization B. All queries resolve the user's authorized organization membership before executing.
- **Privilege Escalation Prevention:**
  - Members attempting to submit `role = OWNER` are rejected with `FORBIDDEN`.
  - Members attempting to change their own role are rejected with `FORBIDDEN`.
  - Admins attempting to remove other Admins or the Owner are rejected with `FORBIDDEN`.
- **Owner Protection:**
  - The Organization Owner cannot be removed from the organization.
  - The Organization Owner cannot be demoted.

---

# 8. Migration Safety

- **Zero Data Loss:** All existing users, organizations, projects, telemetry sessions, replay records, and events were preserved.
- **Deterministic Backfill:** For all 5 existing organizations in the database, an `OrganizationMember` row with `role = OWNER` and `status = ACTIVE` was backfilled cleanly.
- **Downgrade Safety:** Downgrading an organization from Team to Developer (or Free) does **not** delete projects or data. If an organization has 7 projects and downgrades to Developer (limit 5), all 7 projects remain accessible, but new project creation is rejected until usage drops below the limit.

---

# 9. Test Matrix

All 24 automated checks in `scripts/test-phase1-foundation.ts` passed:

| Test | Expected | Actual | Result |
| :--- | :--- | :--- | :---: |
| **TEST A: Unauthenticated access rejected** | `UNAUTHENTICATED` | `UNAUTHENTICATED` | **PASS** |
| **TEST B: Non-member user rejected from Org A** | `NOT_A_MEMBER` | `NOT_A_MEMBER` | **PASS** |
| **TEST C: Developer plan rejected from TEAM_INVESTIGATION_ROOMS** | `TEAM_PLAN_REQUIRED` | `TEAM_PLAN_REQUIRED` | **PASS** |
| **TEST D: Team plan allowed for TEAM_INVESTIGATION_ROOMS** | `ALLOWED` | `ALLOWED` | **PASS** |
| **Role Check: OWNER accepted for owner actions** | `ALLOWED` | `ALLOWED` | **PASS** |
| **Role Check: MEMBER rejected from OWNER actions** | `INSUFFICIENT_ROLE` | `INSUFFICIENT_ROLE` | **PASS** |
| **Role Check: ADMIN accepted for administrative actions** | `ALLOWED` | `ALLOWED` | **PASS** |
| **Role Check: MEMBER rejected from ADMIN actions** | `INSUFFICIENT_ROLE` | `INSUFFICIENT_ROLE` | **PASS** |
| **Privilege Escalation: Member cannot modify their own role** | `FORBIDDEN` | `FORBIDDEN` | **PASS** |
| **Privilege Escalation: Cannot promote invited member to OWNER** | `FORBIDDEN` | `FORBIDDEN` | **PASS** |
| **Owner Protection: Organization Owner cannot be removed** | `FORBIDDEN` | `FORBIDDEN` | **PASS** |
| **Admin Protection: Admin cannot remove another Admin** | `FORBIDDEN` | `FORBIDDEN` | **PASS** |
| **Limit Check: 6th project rejected on 5-project Developer plan** | `LIMIT_REACHED` | `LIMIT_REACHED` | **PASS** |
| **Limit Check: 2nd member rejected on 1-member Developer plan** | `LIMIT_REACHED` | `LIMIT_REACHED` | **PASS** |
| **Member Count Semantics: Suspended member does not consume seat** | `1` | `1` | **PASS** |
| **Cross-Tenant: User A accessing Project B rejected** | `NOT_A_MEMBER` | `NOT_A_MEMBER` | **PASS** |
| **Cross-Tenant: User B accessing Project A rejected** | `NOT_A_MEMBER` | `NOT_A_MEMBER` | **PASS** |
| **Cross-Tenant: User B querying Org A membership rejected** | `NOT_A_MEMBER` | `NOT_A_MEMBER` | **PASS** |
| **Setup: Org A has 7 projects on TEAM plan** | `7` | `7` | **PASS** |
| **Plan Transition: Org A downgraded to DEVELOPER** | `DEVELOPER` | `DEVELOPER` | **PASS** |
| **Downgrade Safety: All 7 existing projects preserved without deletion** | `7` | `7` | **PASS** |
| **Downgrade Safety: Over-limit creation rejected after downgrade** | `LIMIT_REACHED` | `LIMIT_REACHED` | **PASS** |
| **Plan Transition: Org A upgraded back to TEAM** | `TEAM` | `TEAM` | **PASS** |
| **Upgrade Safety: Team capability immediately unlocked upon upgrade** | `true` | `true` | **PASS** |

---

# 10. Existing Regression Tests

All pre-existing test suites were executed against the modified database schema and verified with zero failures:

1. **`scripts/test-multistep-cascade.ts`**:
   - **33 / 33 checks passed (100%)**.
   - Verified that multi-step causal cascade, error anchoring, and replay triggers remain completely functional.
2. **`scripts/test-adversarial-audit.ts`**:
   - **42 / 42 checks passed (100%)**.
   - Verified concurrent replay session creation, write-once `issueId`, out-of-order chunk retries, and cross-session isolation invariants.
3. **Total Invariants Passed:** **99 / 99 checks passed (100%)**.

---

# 11. Known Limitations

- **Project-Level Permissions:** Permissions are currently scoped at the Organization level (`OrganizationMember`). All active members of an organization have access to that organization's projects according to their role (`OWNER`, `ADMIN`, `MEMBER`). Granular per-project member assignment is not yet implemented.
- **Invitation Tokens / Magic Links:** Invitations currently require the target user to register or exist in the Halo database before being added to an organization. Email invitation tokens for non-registered users will be handled in a dedicated invitation phase.

---

# 12. Phase Status

`COMPLETE`

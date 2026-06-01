# Paytm Craft — Postgres schema (planned)

Logical schema for **workspaces, files, versions, comments, assets, teams, and permissions**. Types are illustrative; Prisma (or SQL migrations) will refine nullability, indexes, and enums.

## Core identity

**`users`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `email` | `citext` | unique |
| `password_hash` | `text` | nullable if SSO-only |
| `display_name` | `text` | |
| `avatar_url` | `text` | optional |
| `created_at` | `timestamptz` | |

**`sessions`** (if cookie sessions)

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → users |
| `expires_at` | `timestamptz` | |
| `user_agent` | `text` | |

## Teams & access

**`teams`**

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `name` | `text` |
| `slug` | `text` unique |
| `created_at` | `timestamptz` |

**`team_members`**

| Column | Type | Notes |
|--------|------|--------|
| `team_id` | `uuid` | FK |
| `user_id` | `uuid` | FK |
| `role` | `enum` | `owner`, `admin`, `member`, `guest` |
| PK | `(team_id, user_id)` | |

**`workspaces`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK |
| `team_id` | `uuid` | FK |
| `name` | `text` | |
| `slug` | `text` | unique per team |

**`workspace_members`** (optional override of team-wide access)

| Column | Type |
|--------|------|
| `workspace_id` | `uuid` |
| `user_id` | `uuid` |
| `role` | `enum` |

## Projects & files

**`projects`**

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `workspace_id` | `uuid` FK |
| `name` | `text` |

**`files`** (design document metadata)

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK |
| `project_id` | `uuid` FK nullable |
| `workspace_id` | `uuid` FK |
| `name` | `text` | |
| `kind` | `enum` | `design`, `library`, … |
| `current_version_id` | `uuid` | FK → file_versions |
| `yjs_state_vector` | `bytea` | optional cache |
| `updated_at` | `timestamptz` | |

**`file_versions`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK |
| `file_id` | `uuid` FK |
| `author_id` | `uuid` FK users |
| `created_at` | `timestamptz` | |
| `snapshot_json` | `jsonb` | optional full snapshot |
| `yjs_update` | `bytea` | optional binary update |

Index: `(file_id, created_at DESC)`.

## Comments

**`comments`**

| Column | Type |
|--------|------|
| `id` | `uuid` PK |
| `file_id` | `uuid` FK |
| `version_id` | `uuid` FK nullable |
| `author_id` | `uuid` |
| `anchor` | `jsonb` | node id, x, y, thread id |
| `body` | `text` |
| `resolved` | `boolean` |
| `created_at` / `updated_at` | `timestamptz` |

**`comment_replies`** (or nested `thread_id` on comments)

## Assets

**`assets`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK |
| `workspace_id` | `uuid` | |
| `storage_key` | `text` | key in R2/S3 |
| `mime` | `text` | |
| `byte_size` | `bigint` | |
| `width` / `height` | `int` | optional |
| `created_by` | `uuid` | |

## Plugins (install registry)

**`user_plugin_installs`**

| Column | Type |
|--------|------|
| `user_id` | `uuid` |
| `plugin_id` | `text` |
| `installed_at` | `timestamptz` |
| PK | `(user_id, plugin_id)` |

Workspace-scoped installs are optional (`workspace_plugin_installs`).

## Indexes & housekeeping

- Foreign keys indexed by default patterns; add partial indexes for “active files per workspace”.
- **Retention**: async job to purge soft-deleted files after N days.
- **Migrations**: versioned SQL or Prisma migrate; never rewrite history of `file_versions` in place (append-only).

## Redis (not Postgres)

Presence, typing, and connection counts live in Redis — see [realtime-collaboration.md](./realtime-collaboration.md).

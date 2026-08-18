/**
 * workspace domain zod schemas (names derived from map keys). The
 * WorkspaceId brand cast lives in sessions.schema (see the note there) and
 * is re-exported here as the domain-local name.
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { WorkspaceFilePreview, WorkspaceGitDiff, WorkspaceGitStatus, WorkspaceTreeLevel, WorkspaceView } from './workspace.ts'
import { sessionIdSchema, workspaceIdSchema } from './sessions.schema.ts'

export { workspaceIdSchema } from './sessions.schema.ts'

/** WorkspaceView row of every workspace.* response. */
export const workspaceViewSchema = z.object({
  workspaceId: workspaceIdSchema,
  path: z.string(),
  title: z.string(),
  sessionIds: z.array(sessionIdSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<Wire<WorkspaceView>>

/** workspace.list request payload (empty object literal). */
export const workspaceListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'workspace.list'>>>

/** workspace.list response value. */
export const workspaceListValueSchema = z.object({
  items: z.array(workspaceViewSchema),
  archivedSessionIds: z.array(sessionIdSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.list'>>>

/** workspace.create request payload: the existing directory to adopt. */
export const workspaceCreateRequestSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'workspace.create'>>>

/** workspace.create response value. */
export const workspaceCreateValueSchema = z.object({
  workspace: workspaceViewSchema,
  created: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.create'>>>

/** workspace.rename request payload: the new title must be non-blank. */
export const workspaceRenameRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string(),
}).refine(
  payload => payload.title.trim() !== '',
  { message: 'workspace.rename requires a non-blank title' },
) satisfies z.ZodType<Wire<RequestPayload<'workspace.rename'>>>

/** workspace.rename response value. */
export const workspaceRenameValueSchema = z.object({
  workspace: workspaceViewSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.rename'>>>

/** workspace.delete request payload. */
export const workspaceDeleteRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'workspace.delete'>>>

/** workspace.delete response value. */
export const workspaceDeleteValueSchema = z.object({
  deleted: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.delete'>>>

/** workspace.insertBefore request payload (anchor omitted = append to end). */
export const workspaceInsertBeforeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  beforeWorkspaceId: workspaceIdSchema.optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'workspace.insertBefore'>>>

/** workspace.insertBefore response value: the complete durable display order. */
export const workspaceInsertBeforeValueSchema = z.object({
  workspaceIds: z.array(workspaceIdSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.insertBefore'>>>

/** workspace.insertSessionBefore request payload (anchor omitted = append to end). */
export const workspaceInsertSessionBeforeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  sessionId: sessionIdSchema,
  beforeSessionId: sessionIdSchema.optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'workspace.insertSessionBefore'>>>

/** workspace.insertSessionBefore response value. */
export const workspaceInsertSessionBeforeValueSchema = z.object({
  workspace: workspaceViewSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.insertSessionBefore'>>>

/** workspace.archiveSession request payload. */
export const workspaceArchiveSessionRequestSchema = z.object({
  sessionId: sessionIdSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'workspace.archiveSession'>>>

/** workspace.archiveSession response value: the full updated archive set. */
export const workspaceArchiveSessionValueSchema = z.object({
  archivedSessionIds: z.array(sessionIdSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'workspace.archiveSession'>>>
const treeEntrySchema = z.object({ path: z.string(), name: z.string(), type: z.enum(['file', 'directory', 'other']), size: z.number().optional(), hidden: z.boolean() })
/** workspace.listTreeLevel request: workspace id plus the optional relative directory. */
export const workspaceListTreeLevelRequestSchema = z.object({ workspaceId: workspaceIdSchema, path: z.string().optional() }) satisfies z.ZodType<Wire<RequestPayload<'workspace.listTreeLevel'>>>
/** workspace.listTreeLevel response value: one directory level with the truncation flag. */
export const workspaceListTreeLevelValueSchema = z.object({
  path: z.string(),
  entries: z.array(treeEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<WorkspaceTreeLevel>>
/** workspace.readFilePreview request: workspace id plus the relative file path. */
export const workspaceReadFilePreviewRequestSchema = z.object({ workspaceId: workspaceIdSchema, path: z.string().min(1) }) satisfies z.ZodType<Wire<RequestPayload<'workspace.readFilePreview'>>>
/** workspace.readFilePreview response value: bounded text, total size, optional language hint. */
export const workspaceReadFilePreviewValueSchema = z.object({
  path: z.string(),
  text: z.string(),
  totalBytes: z.number(),
  language: z.string().optional(),
}) satisfies z.ZodType<Wire<WorkspaceFilePreview>>
const gitFileSchema = z.object({ path: z.string(), index: z.string(), worktree: z.string(), originalPath: z.string().optional() })
/** workspace.gitStatus request: the workspace id only. */
export const workspaceGitStatusRequestSchema = z.object({ workspaceId: workspaceIdSchema }) satisfies z.ZodType<Wire<RequestPayload<'workspace.gitStatus'>>>
/** workspace.gitStatus response value: branch, ahead/behind counts, uncommitted files, truncation flag. */
export const workspaceGitStatusValueSchema = z.object({
  branch: z.string().optional(),
  ahead: z.number(),
  behind: z.number(),
  files: z.array(gitFileSchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<WorkspaceGitStatus>>
/** workspace.gitFileDiff request: workspace id, relative path, and the comparison basis. */
export const workspaceGitFileDiffRequestSchema = z.object({ workspaceId: workspaceIdSchema, path: z.string().min(1), basis: z.enum(['staged', 'worktree']) }) satisfies z.ZodType<Wire<RequestPayload<'workspace.gitFileDiff'>>>
/** workspace.gitFileDiff response value: old/new text on the requested basis. */
export const workspaceGitFileDiffValueSchema = z.object({ path: z.string(), basis: z.enum(['staged', 'worktree']), oldText: z.string().nullable(), newText: z.string() }) satisfies z.ZodType<Wire<WorkspaceGitDiff>>

# Agent Note: rc.8 session lifecycle operations

Status: implemented

English | [中文](2026-08-20-session-lifecycle-rc8.zh.md)

## Problem

The pre-0.8.0 local session controls were temporarily restored through a separate `SessionPersistenceAdmin` service with `destroy` and `relocate` methods. That duplicated ownership outside the rc.8 write coordinator and allowed physical mutations to bypass coordinator state and per-id serialization.

## Decision

The rc.8 `SessionPersistence` service remains the upstream read/write seam. Detached-session operations are exposed through the optional `SessionLifecycle` service (`ctx.sessionLifecycle`). First-party providers register that service while delegating its operations to the same `PersistenceCoordinator`; the coordinator guards live and retiring sessions, serializes each operation with pending writes, and invalidates detached state after removal. The backend hook names remain `removeArtifact` and `moveArtifact`, so storage-specific byte or row changes stay behind the coordinator without exposing the old compatibility vocabulary or widening the rc.8 service.

JSONL moves the durable artifact and rewrites its header atomically at the destination; SQLite updates the session row in one transaction. Both providers treat an absent id as an idempotent no-op. Host delete/move first dispose a proxy-owned live agent and then call the persistence service; workspace accounting and archive membership are updated after the durable operation succeeds.

## Consequences

Third-party rc.8 persistence implementations can omit `SessionLifecycle`; Host and Workspace fail explicitly when lifecycle RPCs are requested without it. No `SessionPersistenceAdmin`, `destroy`, or `relocate` API remains. Focused backend, workspace, stop, and carrier tests cover the restored behavior and its wire contracts.

## Alternatives considered

- Keep `remove` and `move` on `SessionPersistence`: rejected because it widens the rc.8 upstream service and makes every future persistence interface merge carry local lifecycle changes.
- Restore a separate `SessionPersistenceAdmin`: rejected because it exposed the old ownership vocabulary and split the coordinator's per-id serialization from the service that owns durable writes.

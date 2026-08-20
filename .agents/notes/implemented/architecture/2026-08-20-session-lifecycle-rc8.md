# Agent Note: rc.8 session lifecycle operations

Status: implemented

## Problem

The pre-0.8.0 local session controls were temporarily restored through a separate `SessionPersistenceAdmin` service with `destroy` and `relocate` methods. That duplicated ownership outside the rc.8 write coordinator and allowed physical mutations to bypass coordinator state and per-id serialization.

## Decision

The rc.8 `SessionPersistence` service now owns the semantic detached-session operations `remove(id)` and `move(id, newCwd)`. `PersistenceCoordinator` guards live and retiring sessions, serializes each operation with pending writes, and invalidates detached state after removal. The backend hook names are `removeArtifact` and `moveArtifact`, so storage-specific byte or row changes remain behind the coordinator without exposing the old compatibility vocabulary.

JSONL moves the durable artifact and rewrites its header atomically at the destination; SQLite updates the session row in one transaction. Both providers treat an absent id as an idempotent no-op. Host delete/move first dispose a proxy-owned live agent and then call the persistence service; workspace accounting and archive membership are updated after the durable operation succeeds.

## Consequences

Third-party persistence implementations that do not support lifecycle changes retain the default service methods, which reject explicitly. No `SessionPersistenceAdmin`, `destroy`, or `relocate` API remains. Focused backend, workspace, stop, and carrier tests cover the restored behavior and its wire contracts.

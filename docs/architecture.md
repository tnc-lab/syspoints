# Syspoints – System Architecture

## Stack
- Frontend: Vite + React
- Backend: Node.js (REST API)
- Database: PostgreSQL
- Blockchain: Syscoin (hash storage only)

## High-level principles
- Reviews are immutable (cannot be edited or deleted)
- Backend is the source of truth
- Blockchain stores only hashed review metadata
- Points are computed off-chain

## Current focus
Backend review indexer and API

## C4 Container Diagram

```mermaid
flowchart LR

    %% USERS
    user[User / Client]

    %% FRONTEND
    frontend[Frontend Web<br>Vite + React]

    %% BACKEND CORE
    api[Backend API<br>Node.js REST]
    indexer[Review Indexer Service]
    points[Points Engine<br>off-chain]
    hashsvc[Hashing Service]

    %% DATABASE
    db[(PostgreSQL)]

    %% BLOCKCHAIN
    chain[Syscoin Blockchain<br>Hash storage only]

    %% FLOW
    user --> frontend
    frontend --> api

    %% REVIEW FLOW
    api --> indexer
    indexer --> db
    indexer --> hashsvc
    hashsvc --> chain

    %% DATA ACCESS
    api --> db

    %% POINTS
    points --> db
    api --> points

    %% READ FLOW
    db --> api
    api --> frontend

    %% PRINCIPLES
    subgraph Principles
        p1[Backend = Source of Truth]
        p2[Reviews Immutable]
        p3[Points computed off-chain]
        p4[Blockchain stores only hashes]
    end

    api -.enforces.-> p1
    indexer -.ensures.-> p2
    points -.logic.-> p3
    chain -.stores.-> p4
```
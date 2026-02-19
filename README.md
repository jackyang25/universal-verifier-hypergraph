# Verified Protocol Hypergraph

A formally verified obstetrics decision support system. Clinical protocols are encoded as hyperedge rules, verified against safety invariants by a Lean 4 kernel ([Cohere](https://github.com/jackyang25/cohere)), and served through an interactive dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org/)
[![Lean 4](https://img.shields.io/badge/Lean-4-blue.svg)](https://lean-lang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

---

## Architecture

Two repositories, three layers:

| Layer | Repo | Role |
|-------|------|------|
| **Frontend** | this | Next.js 16 dashboard -- 4-step clinical workflow + Build console |
| **Backend** | this | FastAPI service -- ontology normalization, hypergraph retrieval, kernel store |
| **Kernel** | [cohere](https://github.com/jackyang25/cohere) | Lean 4 verifier -- derivation, invariants, soundness proofs |

The frontend talks to the backend over REST. The backend shells out to the `cohere-verify` binary (compiled from Lean and bundled via Docker) for formal verification at publish time. The two repos are fully decoupled -- Cohere is cloned and built inside the Docker image.

## Workflow

The dashboard exposes a 4-step clinical simulation pipeline:

1. **Inputs** -- Select diagnoses, comorbidities, context factors, and a proposed clinical action.
2. **Normalization** -- Encode selections into canonical ontology tokens (`Dx.*`, `DxAttr.*`, `Ctx.*`).
3. **Retrieval** -- Match the fact set against verified hyperedge rules to derive verdicts.
4. **Verification** -- Check the proposed action against the derived verdict set (Obligated / Allowed / Rejected).

A separate **Build console** provides authoring tools for rules, incompatibility pairs, infeasibility entries, and publishes snapshots to the Lean verifier.

## Kernel invariants

The Lean kernel enforces three safety properties over every possible fact set:

| # | Invariant | Statement |
|---|-----------|-----------|
| 1 | No contradiction | `Obligated(a)` and `Rejected(a)` never co-derive; nor do `Allowed(a)` and `Rejected(a)` |
| 2 | No incompatible obligations | Two actions marked incompatible are never both `Obligated` |
| 3 | Ought implies can | `Obligated(a)` never triggers an infeasibility entry |

Only rulesets that pass all three invariants are promoted to the runtime retrieval layer.

## Quick start

**Prerequisites:** Docker, Node.js 18+, Make

```bash
git clone git@github.com:jackyang25/verified-protocol-hypergraph.git
cd verified-protocol-hypergraph

make build    # Build backend Docker image + install frontend deps
make start    # Run backend container + frontend dev server
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:8000 | Backend API |
| http://localhost:8000/api/docs | Interactive API docs |

### All Make targets

| Target | Description |
|--------|-------------|
| `make build` | Rebuild backend (no cache) + install frontend deps |
| `make start` | Run backend container + frontend dev server together |
| `make docker-up` | Start backend container only |
| `make docker-down` | Stop backend container |
| `make docker-logs` | Stream backend logs |
| `make docker-clean` | Remove containers, volumes, images |
| `make frontend-dev` | Run Next.js dev server |
| `make frontend-build` | Production frontend build |
| `make frontend-lint` | Lint frontend |

## Project structure

```
frontend/src/
├── app/                 Pages: /, step-2, step-3, step-4, build/*
├── components/          UI components, layout shell, state providers
└── lib/                 Shared utilities

backend/src/
├── api/                 FastAPI routes + Pydantic schemas
├── ontology/            Token registry, normalization logic
├── kernel/              In-memory artifact store, seed data
└── hypergraph/          Hyperedge data model

infra/docker/            Multi-stage Dockerfile (Lean builder + Python runtime)
```

## Key concepts

**Draft vs Runtime** -- Rules and constraints are edited in a Draft workspace. Publishing takes a frozen JSON snapshot, runs the Lean verifier, and promotes to Runtime only on success. Draft constraints persist across publishes; draft rules clear after promotion.

**Token registry** -- Single source of truth for all valid tokens (`Action.*`, `Dx.*`, `DxAttr.*`, `Ctx.*`, verdicts). Derived from the ontology normalizer. The frontend fetches it from `/api/kernel/registry` for autocomplete and validation.

**Hyperedge** -- A rule of the form `{premises} --> Verdict(Action)`. Example: `{Dx.Preeclampsia, DxAttr.Preeclampsia.Severe, Ctx.GA_>=34w} --> Obligated(Action.ImmediateDelivery)`.

**Constraints** -- Two kinds:
- *Incompatibility pairs*: actions that cannot both be obligated (e.g., ImmediateDelivery and ExpectantManagement)
- *Infeasibility entries*: conditions that make an action infeasible (e.g., ExpectantManagement is infeasible when `DxAttr.Preeclampsia.Severe` is present)

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/kernel/registry` | Token registry (actions, facts, verdicts, input options) |
| `GET` | `/api/kernel/active` | Current draft state |
| `GET` | `/api/kernel/runtime` | Verified runtime state |
| `POST` | `/api/kernel/publish` | Publish snapshot and verify |
| `GET` | `/api/kernel/snapshots` | List previous snapshots |
| `POST/PUT/DELETE` | `/api/kernel/active/rules/*` | Rule CRUD |
| `POST/PUT/DELETE` | `/api/kernel/active/incompatibility/*` | Incompatibility CRUD |
| `POST/PUT/DELETE` | `/api/kernel/active/infeasibility/*` | Infeasibility CRUD |
| `POST` | `/api/ontology/normalize` | Normalize patient inputs to canonical tokens |
| `POST` | `/api/hypergraph/retrieve` | Match facts against runtime rules |
| `POST` | `/api/cohere/verify` | Direct verifier invocation |

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| Backend | Python 3.11, FastAPI, Pydantic |
| Verifier | Lean 4 (v4.15.0), [Cohere](https://github.com/jackyang25/cohere) |
| Infra | Docker, Docker Compose |
| State | In-memory (process-local, no database) |

## Disclaimers

This is a research prototype. It is **not** clinical software and must not be used for patient care. The clinical content included is illustrative only.

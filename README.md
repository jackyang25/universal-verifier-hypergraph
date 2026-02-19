# Verified Protocol Hypergraph

`open-source` `lean-4` `formally-verified` `clinical-decision-support` `hypergraph` `next.js` `fastapi`

A formally verified obstetrics decision support system. Clinical protocols are encoded as hyperedge rules, verified against safety invariants by a Lean 4 kernel ([cohere](https://github.com/jackyang25/cohere)), and served through an interactive dashboard.

---

## Architecture

```
  Frontend (Next.js)          Backend (FastAPI)           Kernel (Lean 4)
 ┌───────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
 │  4-step workflow   │────>│  Ontology + Hypergraph│────>│  cohere-verify  │
 │  + Build console   │<────│  + Kernel store       │<────│  (invariants)   │
 └───────────────────┘     └──────────────────────┘     └─────────────────┘
```

**Two repositories:**

| Repo | Purpose |
|------|---------|
| `verified-protocol-hypergraph` (this) | Full-stack app: frontend, backend API, ontology, Docker |
| [`cohere`](https://github.com/jackyang25/cohere) | Lean 4 kernel: derivation, invariants, soundness proofs |

## Workflow

The dashboard exposes a 4-step clinical simulation pipeline:

1. **Inputs** -- Select diagnoses, comorbidities, context factors, and a proposed clinical action.
2. **Normalization** -- Encode selections into canonical ontology fact tokens (`Dx.*`, `DxAttr.*`, `Ctx.*`).
3. **Retrieval** -- Match fact set against hyperedge rules; derive verdicts via specificity-based shadowing.
4. **Verification** -- Check the proposed action against the derived verdict set (Obligated / Allowed / Rejected).

A separate **Build console** provides authoring tools for rules, incompatibility pairs, infeasibility entries, and publishes snapshots to the Lean verifier.

## Kernel invariants

The Lean kernel enforces three safety properties over every possible fact set:

| # | Invariant | Statement |
|---|-----------|-----------|
| 1 | No contradiction | `Obligated(a)` and `Rejected(a)` never co-derive; nor do `Allowed(a)` and `Rejected(a)` |
| 2 | No incompatible obligations | Two actions marked incompatible are never both `Obligated` |
| 3 | Ought implies can | `Obligated(a)` never triggers an infeasibility entry |

**Infeasibility table design:** Every action is feasible by default. The table only encodes exceptions. Each entry has a premise set (like a rule). If those premises are a subset of the patient's fact set, the action is infeasible. Any single matching entry is sufficient.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion |
| Backend | Python 3.11+, FastAPI, Pydantic |
| Kernel | Lean 4 (v4.15.0), Lake build system |
| Infra | Docker, docker-compose |

## Project structure

```
verified-protocol-hypergraph/
├── frontend/
│   └── src/
│       ├── app/              # Next.js pages (/, step-2, step-3, step-4, build/*)
│       ├── components/       # UI components, layout, providers
│       └── lib/              # Utilities
├── backend/
│   └── src/
│       ├── api/              # FastAPI routes + Pydantic schemas
│       ├── hypergraph/       # Hyperedge data model
│       ├── kernel/           # In-memory artifact store, seed data
│       └── ontology/         # Token registry, normalization logic
└── infra/
    └── docker/               # Dockerfile (multi-stage: Lean builder + Python runtime)
```

## Running locally

**Backend:**

```bash
cd backend
pip install -e .
uvicorn src.api.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Docker (full stack with Lean verifier):**

```bash
cd infra/docker
docker compose up --build
```

The Docker build clones `cohere`, compiles the Lean verifier, and bundles the `cohere-verify` binary into the API image.

## Disclaimers

This is a research prototype. It is **not** clinical software and must not be used for patient care. The clinical content included is illustrative only.

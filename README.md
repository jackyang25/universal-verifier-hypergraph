# Axiom Pack Router (Hypergraph Demo)

Select patient conditions (e.g., `pregnant`, `diabetic`) and the system routes to the **relevant axiom packs**. The UI also shows **pack versioning + basic regulatory metadata** (country, authority, reviewer org, approval status) for demo purposes.

## Setup & Run

Prereqs: Docker + Docker Compose.

```bash
make start
# open http://localhost:8000
```

Stop:

```bash
make stop
```

Optional:

```bash
make logs
```

## How to Use

- **Pick conditions** on the left.
- Click **Route Patient**.
- The sidebar shows **Activated Packs** (most specific packs first), including:
  - version (e.g., `v1.2.0`)
  - country (e.g., `ZA`, `KE`, `UG`)
  - approval status (`approved` / `draft`)
  - regulatory authority + reviewer organization

## Key Concepts

- **Conditions**: patient attributes like `pregnant`, `HIV_positive`, `diabetic`.
- **Axiom Packs**: a named set of required conditions + metadata (version, review, country, etc.).
- **Activation**: a pack activates when **all** its conditions are selected.
- **Specificity**: packs with more conditions are considered more specific and appear first.

## Axiom Pack Config Format

Edit `config/axiom_packs.yaml`:

```yaml
metadata:
  config_version: "1.0.0"
  last_updated: "2025-01-13"
  description: Demo axiom packs for routing

axiom_packs:
  - id: diabetes_pack
    version: "1.0.0"
    name: Diabetes Axiom Pack
    conditions: [diabetic]
    last_reviewed: "2024-10-20"
    reviewer: "SEMDSA Guidelines Committee"
    country: "ZA"
    regulatory_body: "SEMDSA"
    approval_status: "approved"
```

## Editing the Demo Packs

Edit `config/axiom_packs.yaml`, then restart:

```bash
make stop && make start
```

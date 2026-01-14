# Clinical Protocol Router (Hypergraph Demo)

Select patient conditions (e.g., `pregnant`, `diabetic`) and the system routes to the **relevant clinical protocols**. The UI also shows **protocol metadata** (version, guideline, basic regulatory fields) for demo purposes.

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
- The sidebar shows **Activated Protocols** (most specific first), including:
  - version (e.g., `v1.2.0`) + guideline
  - country (e.g., `ZA`, `KE`, `UG`)
  - approval status (`approved` / `draft`)
  - regulatory authority + reviewer organization

## Key Concepts

- **Conditions**: patient attributes like `pregnant`, `HIV_positive`, `diabetic`.
- **Clinical Protocols**: a named set of required conditions + metadata (version, guideline, verifier, country, etc.).
- **Activation**: a protocol activates when **all** its conditions are selected.
- **Specificity**: protocols with more conditions are considered more specific and appear first.

## Protocol Config Format

Edit `config/clinical_protocols.yaml`:

```yaml
metadata:
  config_version: "1.0.0"
  last_updated: "2025-01-13"
  description: Demo clinical protocols for routing

clinical_protocols:
  - id: diabetes_protocol
    version: "1.0.0"
    name: Diabetes Clinical Protocol
    conditions: [diabetic]
    last_reviewed: "2024-10-20"
    reviewer: "SEMDSA Guidelines Committee"
    country: "ZA"
    regulatory_body: "SEMDSA"
    approval_status: "approved"
```

## Editing the Demo Protocols

Edit `config/clinical_protocols.yaml`, then restart:

```bash
make stop && make start
```

## Integrating into Agents / Other Systems

This service can run as a lightweight “routing API” inside a larger system:

- **Agents**: send extracted conditions → get back activated protocols (with version + guideline + regulatory metadata) to drive next steps, prompts, or guardrails.
- **Other services**: call the API to retrieve protocol metadata and write activations into a knowledge graph, audit log, or reporting pipeline.

Minimal example:

```bash
curl -s -X POST http://localhost:8000/api/routing/match \
  -H "Content-Type: application/json" \
  -d '{"conditions":["pregnant","diabetic"]}'
```

## Playground Folder

The browser testing UI lives in `playground/` (this folder is served by the backend).

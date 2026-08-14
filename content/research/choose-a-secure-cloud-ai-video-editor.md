# Research notes: Secure cloud AI video editor

Checked 2026-07-31. Backlog ID 60. Primary sources: NIST CSF 2.0, NIST Zero Trust, CISA Cloud Security reference architecture, OWASP file upload/secrets guidance, and Google Drive scope documentation.

Search results commonly collapse “encrypted,” SOC 2, and privacy into a yes/no score. This draft adds a footage-specific threat model, full AI data-flow inventory, separate retention clocks, assurance-scope questions, and a low-risk pilot.

Repository truth was checked against AGENTS.md, `docs/IMPORT_SECURITY.md`, `docs/OAUTH_SECURITY.md`, connector architecture, and worker documentation. Claims are framed as documented architecture, not production certification. Malware scanning is configuration-dependent; Beta connector verification limits are explicit.

Review with project owner/security counsel before publication. Confirm deployed region, subprocessors, retention, contract, production controls, and current assurance reports; none are inferred from code architecture.


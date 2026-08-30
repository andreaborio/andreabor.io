# {{ .Params.note_id }} — {{ .Title }}

> {{ .Description }}

- Status: {{ .Params.status }}
- Phase: {{ .Params.phase }}
- Evidence: {{ .Params.evidence }}
- Published: {{ .Date.Format "2006-01-02" }}
- Canonical URL: {{ .Permalink }}
- Decision: {{ .Params.decision }}
- Agent use: {{ .Params.machine_summary }}
- Claim boundary: {{ .Params.claim_boundary }}
- Keywords: {{ delimit .Params.keywords ", " }}

{{ .RawContent }}

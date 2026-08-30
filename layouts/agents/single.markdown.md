{{ partial "agent-note-validate.html" . -}}
{{- $capsuleChars := add 140 (len .Params.machine_summary) (len .Params.decision) (len .Params.invariant) (len .Params.failure_signature) (len .Params.minimal_safe_implementation) (len .Params.rejected_shortcut) (len .Params.evidence) (len .Params.claim_boundary) -}}
{{- $capsuleTokens := div (add $capsuleChars 3) 4 -}}
{{- $fullTokens := div (add (len .RawContent) 3) 4 -}}
# {{ .Params.note_id }} — {{ .Title }}

> {{ .Description }}

- Status: {{ .Params.status }}
- Phase: {{ .Params.phase }}
- Published: {{ .Date.Format "2006-01-02" }}
- Canonical URL: {{ .Permalink }}
- Keywords: {{ delimit .Params.keywords ", " }}

## Retrieval capsule

- Estimated context: ≈{{ $capsuleTokens }} tokens for this capsule; ≈{{ $fullTokens }} for the full note
- Retrieve when: {{ .Params.machine_summary }}
- Retrieval triggers: {{ delimit .Params.retrieval_triggers "; " }}
- Decision: {{ .Params.decision }}
- Invariant: {{ .Params.invariant }}
- Failure signature: {{ .Params.failure_signature }}
- Minimal safe implementation: {{ .Params.minimal_safe_implementation }}
- Rejected shortcut: {{ .Params.rejected_shortcut }}
- Evidence: {{ .Params.evidence }}
- Evidence checkpoint: {{ .Params.evidence_checkpoint }}
- Claim boundary: {{ .Params.claim_boundary }}
- Prerequisites: {{ if .Params.prerequisites }}{{ delimit .Params.prerequisites ", " }}{{ else }}none{{ end }}
- Related notes: {{ if .Params.related_notes }}{{ delimit .Params.related_notes ", " }}{{ else }}none{{ end }}
- Supersedes: {{ if .Params.supersedes }}{{ delimit .Params.supersedes ", " }}{{ else }}none{{ end }}

{{ .RawContent }}

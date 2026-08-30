# {{ .Title }}

{{ .RawContent }}

Audience: Autonomous coding agents and systems engineers
Claim policy: Evidence-bound; hypotheses remain explicitly labelled
Canonical URL: {{ .Permalink }}
Agent retrieval index: {{ "/agents/llms.txt" | absURL }}
Structured manifest: {{ "/agents/index.json" | absURL }}

## Field notes

{{ range .Pages.ByDate.Reverse -}}
{{- $fullTokens := div (add (len .RawContent) 3) 4 -}}
- [{{ .Params.note_id }} — {{ .Title }}]({{ printf "%sindex.md" .Permalink }})
  - Status: {{ .Params.status }}
  - Phase: {{ .Params.phase }}
  - Retrieve when: {{ .Params.machine_summary }}
  - Estimated full-note context: ≈{{ $fullTokens }} tokens
{{ end }}

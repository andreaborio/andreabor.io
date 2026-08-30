# {{ .Title }}

{{ .RawContent }}

Audience: Autonomous coding agents and systems engineers
Claim policy: Evidence-bound; hypotheses remain explicitly labelled
Canonical URL: {{ .Permalink }}
Agent retrieval index: {{ "/agents/llms.txt" | absURL }}
Structured manifest: {{ "/agents/index.json" | absURL }}

## Field notes

{{ range .Pages.ByDate.Reverse -}}
- [{{ .Params.note_id }} — {{ .Title }}]({{ printf "%sindex.md" .Permalink }})
  - Status: {{ .Params.status }}
  - Phase: {{ .Params.phase }}
  - Decision: {{ .Params.decision }}
  - Summary: {{ .Description }}
{{ end }}

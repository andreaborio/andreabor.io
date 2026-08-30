# {{ .Title }}

{{ with .Description }}{{ . }}

{{ end }}{{ if not .Date.IsZero }}Published: {{ .Date.Format "2006-01-02" }}

{{ end }}Canonical URL: {{ .Permalink }}
{{ with .Params.source_url }}Original Substack URL: {{ . }}
{{ end }}
{{ .RawContent }}

# {{ .Title }}

{{ with .Description }}{{ . }}

{{ end }}{{ range .Pages.ByDate.Reverse -}}
- [{{ .Title }}]({{ printf "%sindex.md" .Permalink }}) — {{ .Date.Format "2006-01-02" }}{{ with .Description }}: {{ . }}{{ end }}
{{ end }}

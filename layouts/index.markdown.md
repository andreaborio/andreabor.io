# Andrea Borio

I play with LLMs.

## Recent posts

{{ range first 5 (where .Site.RegularPages "Section" "posts") -}}
- [{{ .Title }}]({{ printf "%sindex.md" .Permalink }}) — {{ .Date.Format "2006-01-02" }}: {{ .Description }}
{{ end }}

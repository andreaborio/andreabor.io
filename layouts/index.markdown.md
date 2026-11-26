# Andrea Borio

I play with LLMs.

This is where I keep my longest-running experiments built with AI models. I set the requirements and the specs, and sometimes the technique. The models write the code and most of the posts. The record is kept so I can look back and see how the work changes from one model to the next.

## Recent posts

{{ range first 5 (where .Site.RegularPages "Section" "posts") -}}
- [{{ .Title }}]({{ printf "%sindex.md" .Permalink }}) — {{ .Date.Format "2006-01-02" }}: {{ .Description }}
{{ end }}

$xml = Get-Content -Raw .\ToDos_document.xml
[regex]::Matches($xml, 'https?://[^<]+') |
    ForEach-Object { $_.Value } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne '' } |
    Sort-Object -Unique

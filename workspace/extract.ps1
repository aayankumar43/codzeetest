Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Resolve-Path ".\ToDos.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath.Path)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$reader = New-Object System.IO.StreamReader($entry.Open())
$reader.ReadToEnd() | Out-File -Encoding UTF8 ".\ToDos_document.xml"
$reader.Close()
$zip.Dispose()
Write-Host "Done"

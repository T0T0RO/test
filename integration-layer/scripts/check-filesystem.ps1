# integration-layer/scripts/check-filesystem.ps1
# MF2: Filesystem validation snippet
# Lists project-relevant folders and files for structural inspection.
# Excludes node_modules but keeps dist outputs for manifest validation.

Write-Host "=== Directory Structure ===`n"

Get-ChildItem -Path ..\ModuleFederationPoC -Recurse -Directory |
  Where-Object { $_.FullName -notmatch '\\node_modules(\\|$)' } |
  Select-Object -ExpandProperty FullName

Write-Host "`n=== Relevant Files ===`n"

Get-ChildItem -Path ..\ModuleFederationPoC -Recurse -File |
  Where-Object {
    $_.FullName -notmatch '\\node_modules(\\|$)' -and
    $_.Name -match 'package.json|tsconfig.*\.json|mfe\.config\.json|remote-manifest\.js|\.mjs$'
  } |
  Select-Object -ExpandProperty FullName

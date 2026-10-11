[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'release-signature.json'
$sumsPath = Join-Path $root 'SHA256SUMS.txt'
$excluded = @(
    'release-signature.json',
    'SHA256SUMS.txt'
)

$files = Get-ChildItem -LiteralPath $root -Recurse -File |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
        if ($relativePath -notin $excluded) {
            [ordered]@{
                path = $relativePath
                size = $_.Length
                sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
    } |
    Sort-Object path

$manifest = [ordered]@{
    format = 'm1s-release-integrity/v1'
    release = [ordered]@{
        name = 'M1S ZoH Home Assistant App Repository'
        version = '0.1.4'
        date = '2026-10-11'
    }
    components = [ordered]@{
        zigbee2mqtt = '2.14.2'
        zigbee_on_host = '0.2.4-m1s.2'
        zigbee_on_host_source_commit = '8e880bf37630'
    }
    integrity = [ordered]@{
        algorithm = 'SHA-256'
        kind = 'checksum-manifest'
        public_key_signature = $false
        note = 'Checksums verify content integrity. Publisher identity is not signed by a private key in this release.'
    }
    files = @($files)
}

$manifest |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

$sumLines = $files | ForEach-Object { '{0}  {1}' -f $_.sha256, $_.path }
$sumLines | Set-Content -LiteralPath $sumsPath -Encoding ascii

Write-Host "Generated $($files.Count) file checksums for release 0.1.4."

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputDirectory = Join-Path $projectRoot "artifacts"
$archivePath = Join-Path $outputDirectory "discipline-server.zip"
$excludedDirectoryNames = @(
    ".git",
    ".venv",
    ".gradle",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "artifacts",
    "backups"
)

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$filePaths = [System.Collections.Generic.List[string]]::new()
$pendingDirectories = [System.Collections.Generic.Stack[System.IO.DirectoryInfo]]::new()
$pendingDirectories.Push((Get-Item -LiteralPath $projectRoot))

while ($pendingDirectories.Count -gt 0) {
    $directory = $pendingDirectories.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath $directory.FullName -Force) {
        if ($entry.PSIsContainer) {
            if ($entry.Name -in $excludedDirectoryNames -or ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                continue
            }
            $pendingDirectories.Push($entry)
            continue
        }

        $relativePath = $entry.FullName.Substring($projectRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
        $isEnvironmentFile = $relativePath -match '(^|/)\.env($|\.)' -and -not $relativePath.EndsWith(".env.example", [System.StringComparison]::OrdinalIgnoreCase)
        $isLocalOrSensitiveFile = $relativePath -match '(?i)(^|/)[^/]+\.(log|db|sqlite|sqlite3|pem|key|p12|pfx|jks|keystore|apk|aab|zip|bak)$'
        if (-not $isEnvironmentFile -and -not $isLocalOrSensitiveFile) {
            $filePaths.Add($entry.FullName)
        }
    }
}

if ($filePaths.Count -eq 0) {
    throw "No project files were found to package."
}

if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
$archiveStream = [System.IO.File]::Open(
    $archivePath,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None
)
$archive = [System.IO.Compression.ZipArchive]::new(
    $archiveStream,
    [System.IO.Compression.ZipArchiveMode]::Create
)
try {
    foreach ($filePath in $filePaths.ToArray()) {
        $relativePath = $filePath.Substring($projectRoot.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
        $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
        $source = [System.IO.File]::OpenRead($filePath)
        try {
            $destination = $entry.Open()
            try {
                $source.CopyTo($destination)
            }
            finally {
                $destination.Dispose()
            }
        }
        finally {
            $source.Dispose()
        }
    }
}
finally {
    $archive.Dispose()
}
Write-Host "Server package created: $archivePath"

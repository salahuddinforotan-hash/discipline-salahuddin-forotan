[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

try {
    $apiUri = [System.Uri]$ApiBaseUrl
}
catch {
    throw "ApiBaseUrl must be a full HTTPS URL, for example https://discipline.example.com"
}

if (-not $apiUri.IsAbsoluteUri -or $apiUri.Scheme -ne "https" -or $apiUri.AbsolutePath -ne "/" -or $apiUri.Query -or $apiUri.Fragment) {
    throw "ApiBaseUrl must be a base HTTPS URL with no path, query, or fragment."
}

$env:VITE_API_BASE_URL = $apiUri.GetLeftPart([System.UriPartial]::Authority)

if (-not $env:ANDROID_HOME) {
    $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path -LiteralPath $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
    }
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)) {
    throw "Android SDK not found. Install Android Studio and set ANDROID_HOME to its SDK directory."
}
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$javaCandidates = @(
    $env:JAVA_HOME,
    (Join-Path ([Environment]::GetFolderPath("ProgramFiles")) "Android\Android Studio\jbr"),
    (Join-Path $env:TEMP "discipline-microsoft-jdk21\jdk-21.0.12.1+1")
) | Where-Object { $_ }

$javaHome = $null
foreach ($candidate in $javaCandidates) {
    $javaExe = Join-Path $candidate "bin\java.exe"
    if (-not (Test-Path -LiteralPath $javaExe)) {
        continue
    }

    $version = (& $javaExe -version 2>&1 | Out-String)
    if ($version -match 'version "21\.') {
        $javaHome = $candidate
        break
    }
}
if (-not $javaHome) {
    throw "JDK 21 is required. Install JDK 21 or Android Studio, then set JAVA_HOME."
}
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

$frontendDirectory = Join-Path $projectRoot "frontend"
Push-Location $frontendDirectory
try {
    if (-not (Test-Path -LiteralPath (Join-Path $frontendDirectory "node_modules"))) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE."
        }
    }

    & npm.cmd run android:sync
    if ($LASTEXITCODE -ne 0) {
        throw "Capacitor Android sync failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$androidDirectory = Join-Path $frontendDirectory "android"
Push-Location $androidDirectory
try {
    & .\gradlew.bat assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) {
        throw "Android debug build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

$builtApk = Join-Path $androidDirectory "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $builtApk)) {
    throw "Gradle completed but the APK was not found at $builtApk."
}

$artifactDirectory = Join-Path $projectRoot "artifacts"
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
$artifactPath = Join-Path $artifactDirectory "Discipline-debug.apk"
Copy-Item -LiteralPath $builtApk -Destination $artifactPath -Force
Write-Host "Android APK created: $artifactPath"


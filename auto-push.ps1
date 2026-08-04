<#
.SYNOPSIS
    Automated Git Commit & Release Version Bumper Script for Backpack
.DESCRIPTION
    Increments semver version in package.json (1.0.0 -> 1.0.1 -> ... -> 1.9.0 -> 2.0.0),
    creates git commit and tag, and pushes automatically to GitHub repository.
#>

param (
    [string]$Message = "Auto commit & release bump",
    [ValidateSet("patch", "minor", "major")]
    [string]$BumpType = "patch"
)

$ErrorActionPreference = "Stop"

# Ensure we are in a git repository
if (-not (Test-Path ".git")) {
    Write-Error "Not a git repository. Run this script from the root of the project."
}

# Check git status for uncommitted changes
$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes detected. Nothing to commit." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found uncommitted changes. Staging files..." -ForegroundColor Cyan
git add .

# Read current package.json version
$packageJsonPath = "package.json"
$package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$currentVersion = $package.version

Write-Host "Current version: v$currentVersion" -ForegroundColor Cyan

# Parse SemVer
$parts = $currentVersion.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Determine new version logic
if ($BumpType -eq "patch") {
    $patch++
    if ($patch -ge 10) {
        $patch = 0
        $minor++
    }
    if ($minor -ge 10) {
        $minor = 0
        $major++
    }
} elseif ($BumpType -eq "minor") {
    $patch = 0
    $minor++
    if ($minor -ge 10) {
        $minor = 0
        $major++
    }
} elseif ($BumpType -eq "major") {
    $patch = 0
    $minor = 0
    $major++
}

$newVersion = "$major.$minor.$patch"
Write-Host "Bumping version to: v$newVersion" -ForegroundColor Green

# Update package.json
$package.version = $newVersion
$package | ConvertTo-Json -Depth 10 | Set-Content $packageJsonPath

# Re-stage updated package.json
git add package.json

# Commit & Push
$commitMsg = "release: v$newVersion - $Message"
Write-Host "Creating git commit: '$commitMsg'..." -ForegroundColor Cyan
git commit -m $commitMsg

Write-Host "Creating git tag v$newVersion..." -ForegroundColor Cyan
git tag "v$newVersion"

Write-Host "Pushing commits and tags to remote origin..." -ForegroundColor Green
git push origin main --follow-tags

Write-Host "Successfully pushed version v$newVersion to GitHub!" -ForegroundColor Green

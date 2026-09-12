# Настройка Cloudflare Pages для FormSite (запуск у себя на ПК).
# Токен НЕ коммитьте и не отправляйте в чат.
#
#   $env:CLOUDFLARE_API_TOKEN = "ваш_токен"
#   $env:CLOUDFLARE_ACCOUNT_ID = "5e77f940207783011628f0eb0b05f26b"
#   powershell -ExecutionPolicy Bypass -File tools/cloudflare-setup-pages.ps1

param(
    [string]$ProjectName = "formsite",
    [string]$GitOwner = "EfimSwift",
    [string]$GitRepo = "FormSite",
    [string]$ProductionBranch = "main",
    [string]$BasicAuthUser = "",
    [string]$BasicAuthPass = ""
)

$ErrorActionPreference = "Stop"
$token = $env:CLOUDFLARE_API_TOKEN
$accountId = $env:CLOUDFLARE_ACCOUNT_ID

if (-not $token -or -not $accountId) {
    Write-Error "Задайте CLOUDFLARE_API_TOKEN и CLOUDFLARE_ACCOUNT_ID"
}

$base = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects"
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type"  = "application/json"
}

function Invoke-CfApi {
    param([string]$Method, [string]$Uri, [object]$Body = $null)
    $params = @{ Method = $Method; Uri = $Uri; Headers = $headers }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    $r = Invoke-RestMethod @params
    if (-not $r.success) {
        throw ($r.errors | ConvertTo-Json -Depth 5)
    }
    return $r.result
}

Write-Host "Checking token..."
Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify" -Headers $headers | Out-Null

Write-Host "Listing Pages projects..."
$projects = (Invoke-CfApi -Method GET -Uri $base)
$existing = $projects | Where-Object { $_.name -eq $ProjectName }

$buildConfig = @{
    build_command   = ""
    destination_dir = ""
    root_dir        = ""
}

if (-not $existing) {
    Write-Host "Creating project '$ProjectName'..."
    $body = @{
        name              = $ProjectName
        production_branch = $ProductionBranch
        source            = @{
            type   = "github"
            config = @{
                owner                 = $GitOwner
                repo_name             = $GitRepo
                production_branch     = $ProductionBranch
                deployments_enabled   = $true
                pr_comments_enabled   = $true
                production_deployments  = $true
                preview_deployment_setting = "all"
            }
        }
        build_config      = $buildConfig
    }
    try {
        $existing = Invoke-CfApi -Method POST -Uri $base -Body $body
    } catch {
        Write-Host "POST failed (GitHub may not be linked in Cloudflare). Create Pages project manually in dashboard, then re-run this script."
        throw
    }
} else {
    Write-Host "Updating build config for '$ProjectName'..."
    $patchUri = "$base/$ProjectName"
    Invoke-CfApi -Method PATCH -Uri $patchUri -Body @{ build_config = $buildConfig } | Out-Null
}

if ($BasicAuthUser -and $BasicAuthPass) {
    Write-Host "Setting BASIC_AUTH env vars (production)..."
    $envUri = "$base/$ProjectName"
    $proj = Invoke-CfApi -Method GET -Uri $envUri
    # Pages env API: separate endpoint
    $envBase = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$ProjectName"
    foreach ($pair in @(
            @{ name = "BASIC_AUTH_USER"; value = $BasicAuthUser },
            @{ name = "BASIC_AUTH_PASS"; value = $BasicAuthPass }
        )) {
        $envBody = @{
            deployment_configs = @{
                production = @{
                    env_vars = @{
                        ($pair.name) = @{ value = $pair.value }
                    }
                }
            }
        }
        try {
            Invoke-CfApi -Method PATCH -Uri $envBase -Body $envBody | Out-Null
        } catch {
            Write-Warning "Could not set $($pair.name) via API — add in Dashboard → Settings → Environment variables"
        }
    }
}

Write-Host "Triggering production deployment..."
$deployUri = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$ProjectName/deployments"
try {
    Invoke-CfApi -Method POST -Uri $deployUri -Body @{ branch = $ProductionBranch } | Out-Null
} catch {
    Write-Host "Auto-deploy skipped — push to GitHub or Retry in Dashboard."
}

Write-Host ""
Write-Host "Done. Open: Workers & Pages → $ProjectName"
Write-Host "URL: https://$ProjectName.pages.dev (may differ if name taken)"
Write-Host ""
Write-Host "Dashboard must NOT use: npx wrangler deploy"
Write-Host "Build command: empty | Output directory: / or empty (repo root)"

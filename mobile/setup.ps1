# Flutter platform klasörlerini oluşturur ve mobil izin şablonlarını uygular.
# Önkoşul: https://docs.flutter.dev/get-started/install

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Host "Flutter bulunamadi. Kurun: https://docs.flutter.dev/get-started/install" -ForegroundColor Red
    exit 1
}

Write-Host "flutter create ..." -ForegroundColor Cyan
flutter create . --org com.baunhackathon.afet --project-name afet_koordinasyon_mobile

$manifestDest = Join-Path $root "android\app\src\main\AndroidManifest.xml"
if (Test-Path $manifestDest) {
    Copy-Item (Join-Path $root "templates\AndroidManifest.xml") $manifestDest -Force
    Write-Host "AndroidManifest.xml guncellendi (HTTP, konum, kamera)." -ForegroundColor Green
}

$plistPath = Join-Path $root "ios\Runner\Info.plist"
if (Test-Path $plistPath) {
    $plist = Get-Content $plistPath -Raw
    $append = Get-Content (Join-Path $root "templates\Info.plist.append.xml") -Raw
    if ($plist -notmatch "NSLocationWhenInUseUsageDescription") {
        $plist = $plist -replace "</dict>\s*</plist>", "$append`n</dict>`n</plist>"
        Set-Content $plistPath $plist -NoNewline
        Write-Host "Info.plist guncellendi (ATS, konum, kamera)." -ForegroundColor Green
    }
}

flutter pub get
Write-Host ""
Write-Host "Hazir. Ornek calistirma:" -ForegroundColor Green
Write-Host "  cd frontend; npm run dev"
Write-Host "  cd mobile; flutter run"
Write-Host "  Fiziksel cihaz: flutter run --dart-define=WEB_APP_URL=http://BILGISAYAR_IP:5173"

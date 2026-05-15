# Analiz sunucusunu başlatır (port 5000)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Olusturuldu: .env — ROBOFLOW_API_KEY degerini doldurun!" -ForegroundColor Yellow
}

pip install -r requirements.txt -q
Write-Host "Flask baslatiliyor: http://127.0.0.1:5000" -ForegroundColor Cyan
python app.py

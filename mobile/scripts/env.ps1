# Mobil gelistirme ortam degiskenleri — PowerShell'de: . .\scripts\env.ps1
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:SKIP_JDK_VERSION_CHECK = "1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$flutterBin = "$env:LOCALAPPDATA\flutter\bin"
if ($env:Path -notlike "*$flutterBin*") {
  $env:Path = "$flutterBin;C:\Program Files\Java\jdk-21\bin;$env:Path"
}

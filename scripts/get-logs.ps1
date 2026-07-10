# get-logs.ps1
# Script to pull forward_app.log from a connected Android device

$PACKAGE_NAME = "com.damianbosatta.forward" # Standard package name, update if different
$REMOTE_PATH = "/data/data/$PACKAGE_NAME/files/forward_app.log"
$LOCAL_PATH = "./forward_app.log"

Write-Host "Checking for connected devices..." -ForegroundColor Cyan
$devices = adb devices | Select-String -Pattern "\tdevice$"

if (-not $devices) {
    Write-Error "No devices found. Ensure your phone is connected and USB Debugging is enabled."
    exit
}

Write-Host "Pulling logs from device..." -ForegroundColor Yellow
# Since it's in the app's internal data, we might need run-as if not rooted
adb shell "run-as $PACKAGE_NAME cat files/forward_app.log" > $LOCAL_PATH

if (Test-Path $LOCAL_PATH) {
    Write-Host "Successfully extracted logs to $LOCAL_PATH" -ForegroundColor Green
    Get-Content $LOCAL_PATH -Tail 20
} else {
    Write-Error "Failed to extract logs. Check if the package name is correct or if the file exists."
}

$cacheDir = "C:\Users\Damian\.gradle\caches\8.13\transforms"
Write-Host "Monitoring $cacheDir for graphicsConversions.h..."
while ($true) {
    $files = Get-ChildItem -Path $cacheDir -Filter "graphicsConversions.h" -Recurse -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        try {
            $content = [IO.File]::ReadAllText($file.FullName)
            if ($content.Contains('std::format("{}%", dimension.value)')) {
                Write-Host "Patching file: $($file.FullName)"
                $content = $content.Replace('std::format("{}%", dimension.value)', 'std::to_string(dimension.value) + "%"')
                [IO.File]::WriteAllText($file.FullName, $content)
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 200
}

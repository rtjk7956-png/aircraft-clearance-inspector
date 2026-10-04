$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) {
    $taskBasePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (-not (Test-Path -LiteralPath $taskBasePython)) {
        $taskCommand = Get-Command python -ErrorAction SilentlyContinue
        if (-not $taskCommand) { throw 'Python 3.10 or newer is required.' }
        $taskBasePython = $taskCommand.Source
    }
    & $taskBasePython -m venv (Join-Path $PSScriptRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python virtual environment.' }
}
& $taskPython -c "import fastapi, uvicorn"
if ($LASTEXITCODE -ne 0) {
    & $taskPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check internet access.' }
}
Write-Host 'Open http://127.0.0.1:8766/page2.html in your browser.'
Write-Host 'API docs: http://127.0.0.1:8766/docs | Stop: Ctrl+C'
& $taskPython -m uvicorn backend.main:app --host 127.0.0.1 --port 8766

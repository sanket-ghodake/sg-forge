@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0..\..\.."
echo ==============================================================================
echo    ⚡ SG FORGE PORTABLE WINDOWS DEVELOPER SETUP (ZERO-HOST INSTALL)
echo ==============================================================================
echo.

if not exist "portables" mkdir portables
if not exist "portables\bin" mkdir portables\bin
if not exist "portables\bun" mkdir portables\bun

:: 1. Fetch Bun for Windows x64 if missing
if not exist "portables\bun\bun.exe" (
    echo [1/4] Fetching standalone Windows x64 Bun runtime...
    powershell -Command "Invoke-WebRequest -Uri 'https://bun.sh/download/v1.2.0/windows/x64/bun-windows-x64.zip' -OutFile 'portables\bun.zip'"
    powershell -Command "Expand-Archive -Path 'portables\bun.zip' -DestinationPath 'portables\bun_extracted' -Force"
    xcopy /E /I /Y "portables\bun_extracted\bun-windows-x64\*" "portables\bun\"
    del /f /q "portables\bun.zip"
    rmdir /s /q "portables\bun_extracted"
    echo ✓ Portable Bun provisioned.
) else (
    echo ✓ Portable Bun already present.
)

set PATH=%CD%\portables\bun;%CD%\portables\bin;%CD%\.venv\Scripts;%PATH%

:: 2. Create Windows batch wrappers in portables\bin
echo.
echo [2/4] Generating Windows portable wrappers...

:: Caveman wrapper
(
echo @echo off
echo set ROOT=%%~dp0..\..
echo "%%ROOT%%\portables\bun\bun.exe" run "%%ROOT%%\portables\caveman\bin\caveman.ts" %%*
) > "portables\bin\caveman.bat"

:: Tree wrapper
(
echo @echo off
echo set ROOT=%%~dp0..\..
echo "%%ROOT%%\portables\bun\bun.exe" run "%%ROOT%%\portables\tree\bin\tree.ts" %%*
) > "portables\bin\tree.bat"

:: Astryx wrapper
(
echo @echo off
echo set ROOT=%%~dp0..\..
echo "%%ROOT%%\portables\bun\bun.exe" run "%%ROOT%%\portables\astryx\bin\astryx.ts" %%*
) > "portables\bin\astryx.bat"

:: RTK wrapper
(
echo @echo off
echo set ROOT=%%~dp0..\..
echo if exist "%%ROOT%%\portables\rtk\bin\rtk.exe" (
echo     "%%ROOT%%\portables\rtk\bin\rtk.exe" %%*
echo ) else (
echo     %%*
echo )
) > "portables\bin\rtk.bat"

:: Graphify wrapper
(
echo @echo off
echo set ROOT=%%~dp0..\..
echo if exist "%%ROOT%%\.venv\Scripts\graphify.exe" (
echo     "%%ROOT%%\.venv\Scripts\graphify.exe" %%*
echo ) else (
echo     python -m graphify %%*
echo )
) > "portables\bin\graphify.bat"

echo ✓ Windows portable CLI wrappers configured.

:: 3. Setup Python .venv if python is available
echo.
echo [3/4] Checking Python Virtual Environment...
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    if not exist ".venv" (
        echo Creating localized .venv...
        python -m venv .venv
    )
    if exist ".venv\Scripts\pip.exe" (
        echo Installing code quality tools in .venv...
        .venv\Scripts\pip.exe install --quiet ruff sqlfluff semgrep mkdocs mkdocs-material graphifyy lizard diff-cover
    )
    echo ✓ Local Python .venv configured.
) else (
    echo ⚠️ Python not found in system PATH. Docker toolchain will be used for python checks.
)

:: 4. Project Dependencies & Local Database
echo.
echo [4/4] Installing project dependencies & compiling SDK...
call bun install
call bun run core/src/database/initialize-local-db.ts
call bun build --target=browser --format=iife --outfile=core/src/frontend/public/sdk/forge-sdk.js packages/sdk/forge-sdk.ts
call bun build --target=browser --outfile=core/src/backend/dev-dashboard/dashboard.js core/src/backend/dev-dashboard/dashboard.tsx

echo.
echo ==============================================================================
echo    🎉 SG FORGE WINDOWS PORTABLE SETUP COMPLETED SUCCESSFULLY!
echo ==============================================================================
echo Launch stack anytime with:
echo    scripts\portable\development\run.bat
echo.
pause

@echo off
cd /d "%~dp0..\..\.."
echo === Initializing Local Portable Windows Development Environment ===
if not exist "portables" mkdir portables

echo Fetching standalone Win64 Bun binary compilation asset...
powershell -Command "Invoke-WebRequest -Uri 'https://bun.sh/download/v1.2.0/windows/x64/bun-windows-x64.zip' -OutFile 'portables\bun.zip'"
powershell -Command "Expand-Archive -Path 'portables\bun.zip' -DestinationPath 'portables\bun_extracted'"

move portables\bun_extracted\bun-windows-x64\* portables\bun\
del portables\bun.zip
rmdir /s /q portables\bun_extracted

set PATH=%CD%\portables\bun;%PATH%
call bun install
call bun run core/src/database/initialize-local-db.ts
echo === System Setup Completed Successfully ===
pause

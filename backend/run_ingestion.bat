@echo off
chcp 65001 >nul
title Turing PDF Ingestion

echo.
echo ═══════════════════════════════════════════════
echo   Turing — HSC Question Bank PDF Ingestion
echo ═══════════════════════════════════════════════
echo.

cd /d "%~dp0"

:: Count PDFs
set COUNT=0
for %%f in (pdf_input\*.pdf) do set /a COUNT+=1

if %COUNT%==0 (
    echo [ERROR] No PDF files found in pdf_input\ folder.
    echo.
    echo Place your HSC worksheet PDFs in:
    echo   %CD%\pdf_input\
    echo.
    echo Then run this script again.
    echo.
    pause
    exit /b 1
)

echo Found %COUNT% PDF file(s) in pdf_input\
echo.

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)

:: Install PDF deps if needed
echo Checking dependencies...
python -c "import pdfplumber" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installing pdfplumber...
    pip install pdfplumber pypdf2 -q
)

:: Run ingestion
echo.
echo Starting ingestion...
echo ─────────────────────────────────────────────
python ingest_pdfs.py --dir pdf_input --course auto
echo ─────────────────────────────────────────────
echo.
echo Done! New questions are now in the database.
echo You can remove processed PDFs from pdf_input\ or keep them.
echo.

:: Ask to move processed files
set /p MOVE="Move processed PDFs to pdf_input\processed\? (y/n): "
if /i "%MOVE%"=="y" (
    if not exist "pdf_input\processed" mkdir "pdf_input\processed"
    for %%f in (pdf_input\*.pdf) do move "%%f" "pdf_input\processed\" >nul 2>&1
    echo Moved %COUNT% file(s) to pdf_input\processed\
)

echo.
pause

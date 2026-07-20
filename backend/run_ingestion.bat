@echo off
chcp 65001 >nul
title Turing PDF Ingestion

echo.
echo =============================================
echo   Turing - Question Bank PDF Ingestion
echo =============================================
echo.
echo Usage: run_ingestion.bat [course]
echo   Advanced, Extension 1, Extension 2
echo.
echo Example: run_ingestion.bat "Extension 2"
echo.

cd /d "%~dp0"

set COURSE=%1
if "%COURSE%"=="" set COURSE=Extension 2

echo Course: %COURSE%
echo.

call venv\Scripts\python.exe ingest_pdfs.py --dir pdf_input --course "%COURSE%"

echo.
echo Done.
pause

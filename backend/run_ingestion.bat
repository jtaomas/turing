@echo off
chcp 65001 >nul
title Turing PDF Ingestion

echo.
echo =============================================
echo   Turing - Question Bank PDF Ingestion
echo =============================================
echo.
echo Usage: run_ingestion.bat [course]
echo   course: advanced, extension1, extension2 (default)
echo.
echo Example: run_ingestion.bat extension2
echo.

cd /d "%~dp0"

set COURSE=%1
if "%COURSE%"=="" set COURSE=extension2

echo Course: %COURSE%
echo.

call venv\Scripts\python.exe ingest_pdfs.py --dir pdf_input --course %COURSE%

echo.
echo Done.
pause

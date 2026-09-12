@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python tools\regenerate_print_pdf.py
echo.
echo Закоміть forms\templates\interactive-board-print.pdf
echo та js\infrastructure\xlsx\interactiveBoardPdfPlacements.js
pause

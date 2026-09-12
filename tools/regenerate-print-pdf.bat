@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python tools\xlsx_zip_fill.py "forms\templates\interactive-board-blank-data.xlsx"
powershell -NoProfile -Command ^
  "$xl = New-Object -ComObject Excel.Application; $xl.Visible=$false; ^
   $wb = $xl.Workbooks.Open((Resolve-Path 'forms\templates\interactive-board-blank-data.xlsx')); ^
   $pdf = (Resolve-Path 'forms\templates\interactive-board-print.pdf'); ^
   $wb.Worksheets.Item(1).ExportAsFixedFormat(0, $pdf.Path); ^
   $wb.Close($false); $xl.Quit(); ^
   Write-Host 'PDF updated:' $pdf"
echo Готово.
pause

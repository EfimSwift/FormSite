@echo off
chcp 65001 >nul
cd /d "%~dp0.."
python tools\generate_sample_forms.py
set "DEST=%CD%\сайт"
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
for %%D in (index.html css js forms vendor fonts _redirects) do (
  if exist "%%D" xcopy "%%D" "%DEST%\%%D\" /E /I /Y >nul
)
if not exist "%DEST%\fonts" mkdir "%DEST%\fonts"
if exist "%WINDIR%\Fonts\arial.ttf" copy /Y "%WINDIR%\Fonts\arial.ttf" "%DEST%\fonts\Arial.ttf" >nul
echo Готово: %DEST%
pause

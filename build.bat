@echo off
chcp 65001 >nul
echo ========================================================
echo   Membangun Executable DNA - Daily Notes Aku (.exe)
echo ========================================================
echo.

uv run build_exe.py %*

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Selesai! File executable tersedia di folder: dist\DNA-DailyNotesAku.exe
) else (
    echo.
    echo [ERROR] Proses build gagal. Silakan periksa pesan error di atas.
)

pause

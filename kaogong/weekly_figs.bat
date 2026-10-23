@echo off
REM kaogong weekly: topup figure-reasoning real questions, rebuild, publish
chcp 65001 >nul
cd /d C:\Users\Administrator\.openclaw\workspace
echo ===== %date% %time% ===== >> kaogong\data\figs_fetch.log
python kaogong\tools\fetch_figs.py >> kaogong\data\figs_fetch.log 2>&1
python kaogong\build_data.py >> kaogong\data\figs_fetch.log 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -File kaogong\publish.ps1 -Message "weekly: topup figure questions" >> kaogong\data\figs_fetch.log 2>&1

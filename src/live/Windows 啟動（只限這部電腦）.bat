@echo off
chcp 65001 >nul
REM DW1 暴龍機 實時版 啟動檔（Windows）：找出 Python 3，運行同一資料夾的 dw1_bridge.py。不會安裝或改動任何東西。
cd /d "%~dp0"
title DW1 暴龍機 實時版
set "PY="
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info[0]==3 else 1)" >nul 2>nul && set "PY=python"
if not defined PY (
  echo.
  echo 找不到 Python 3。
  echo 請到 https://www.python.org/downloads/windows/ 下載安裝，
  echo 安裝第一頁記得勾選「Add python.exe to PATH」，然後再雙擊這個檔案。
  echo.
  start "" https://www.python.org/downloads/windows/
  pause
  exit /b 1
)
%PY% dw1_bridge.py
echo.
pause

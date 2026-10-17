#!/bin/bash
# DW1 暴龍機 實時版 啟動檔（Mac）：找出 Python 3，運行同一資料夾的 dw1_bridge.py。不會安裝或改動任何東西。
cd "$(dirname "$0")"
if ! python3 -c "import sys" >/dev/null 2>&1; then
  echo ""
  echo "找不到可用的 Python 3。"
  echo "如果剛才彈出「安裝命令列開發者工具」的視窗，請按「安裝」，完成後再雙擊這個檔案。"
  echo "也可以到 https://www.python.org/downloads/macos/ 下載安裝。"
  echo ""
  read -n 1 -s -r -p "按任何鍵關閉這個視窗……"
  exit 1
fi
python3 dw1_bridge.py
echo ""
read -n 1 -s -r -p "小程式已結束，按任何鍵關閉這個視窗……"

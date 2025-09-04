#!/bin/bash

# Fix all execute calls to use proper libsql syntax
find src -name "*.ts" -type f -exec sed -i 's/\.execute(\([^,)]*\), \[\([^]]*\)\])/\.execute({sql: \1, args: [\2]})/g' {} +

echo "Fixed execute calls"
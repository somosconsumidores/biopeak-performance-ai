#!/bin/bash

# List all edge functions in the supabase/functions directory
# This script is used to maintain the list of functions for manual deployment

echo "Available Edge Functions:"
echo "========================"

if [ ! -d "supabase/functions" ]; then
  echo "Error: supabase/functions directory not found"
  exit 1
fi

cd supabase/functions || exit 1

for dir in */; do
  dir=${dir%*/}
  if [ -f "$dir/index.ts" ]; then
    echo "  - $dir"
  fi
done

echo ""
echo "Total functions: $(find . -maxdepth 2 -name "index.ts" | wc -l)"

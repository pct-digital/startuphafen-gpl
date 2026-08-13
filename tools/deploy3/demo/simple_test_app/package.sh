#!/bin/bash
# Package the simple_test_app for deployment.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$SCRIPT_DIR"
PKG_DIR="$DEMO_DIR/demo.0101.1000.01"
OUTPUT_ZIP="$DEMO_DIR/demo.0101.1000.01.zip"

echo "📦 Packaging simple_test_app demo..."
echo "  Source: $PKG_DIR"
echo "  Output: $OUTPUT_ZIP"

# Remove existing ZIP if it exists
if [ -f "$OUTPUT_ZIP" ]; then
  rm "$OUTPUT_ZIP"
  echo "  Removed existing ZIP"
fi

# Create ZIP with proper structure
cd "$DEMO_DIR"
zip -r -q "$OUTPUT_ZIP" "$(basename "$PKG_DIR")"

# Verify ZIP structure
echo ""
echo "✅ Package created successfully"
echo "  Size: $(du -h "$OUTPUT_ZIP" | cut -f1)"
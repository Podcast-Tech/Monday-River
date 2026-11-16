#!/bin/bash
# Build River Wrist with the back-end URL and watch key baked in.
# Usage: tools/build.sh <api_url> <key_file> <out.prg>
set -e
cd "$(dirname "$0")/.."
URL=$1; KEY=$(tr -d '\n' < "$2"); OUT=$3
cp source/Config.mc /tmp/Config.mc.bak
trap 'cp /tmp/Config.mc.bak source/Config.mc' EXIT
sed -i "s#__API_URL__#$URL#; s#__WRIST_KEY__#$KEY#" source/Config.mc
${CIQ_SDK:-/home/claude/sdk/ciq}/bin/monkeyc -f monkey.jungle -d fenix8pro47mm -y developer_key.der -o "$OUT" -l 2 2>&1 | grep -E "ERROR|BUILD|WARNING: .*(Api|Delegate|View)\.mc"

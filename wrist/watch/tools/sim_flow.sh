#!/bin/bash
# Full River Wrist flow in the simulator against the local mock back end.
# Usage: tools/sim_flow.sh <prg> <outdir> "<button sequence>"
#   sequence: space-separated steps, each S (START), D (DOWN), U (UP), B (BACK) or shot:<name>
PRG=$1; OUT=$2; SEQ=$3; mkdir -p "$OUT"
export DISPLAY=:99 LD_LIBRARY_PATH=${SIM_LIBS:-/home/claude/simlibs/root/usr/lib/x86_64-linux-gnu} WEBKIT_DISABLE_COMPOSITING_MODE=1
pgrep Xvfb >/dev/null || { Xvfb :99 -screen 0 1400x1000x24 >/dev/null 2>&1 & sleep 2; }
pkill -f ciq/bin/simulator; pkill -f serve-mock.js; sleep 1
# local mock is plain http: turn off the device HTTPS rule
INI=~/.Garmin/ConnectIQ/simulator.ini; sed -i "/^UseHttpsRequirements=/d" $INI; echo "UseHttpsRequirements=0" >> $INI
node "$(dirname "$0")/../../api/tests/serve-mock.js" 8787 sim-key-123 > "$OUT/server.log" 2>&1 &
${CIQ_SDK:-/home/claude/sdk/ciq}/bin/simulator >/tmp/sim.log 2>&1 & SP=$!
sleep 10
${CIQ_SDK:-/home/claude/sdk/ciq}/bin/monkeydo "$PRG" fenix8pro47mm >/tmp/do.log 2>&1 &
sleep 15
for step in $SEQ; do
  case $step in
    S) xdotool mousemove 633 283 click 1 ;;
    D) xdotool mousemove 62 612 click 1 ;;
    U) xdotool mousemove 20 465 click 1 ;;
    B) xdotool mousemove 620 612 click 1 ;;
    R) ${CIQ_SDK:-/home/claude/sdk/ciq}/bin/monkeydo "$PRG" fenix8pro47mm >/tmp/do2.log 2>&1 & sleep 12; continue ;;
    shot:*) import -window root -crop 675x935+0+0 "$OUT/${step#shot:}.png"; continue ;;
  esac
  sleep 3
done
kill $SP; pkill -f serve-mock.js

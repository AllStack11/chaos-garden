#!/bin/zsh

# Fast-forward the Chaos Garden simulation by 50 ticks
# This script triggers the scheduled handler locally to advance time.

echo "🌿 Fast-forwarding simulation by 50 ticks..."

for i in {1..50}
do
   echo "Tick $i/50..."
   curl -s "http://localhost:8787/cdn-cgi/handler/scheduled"
   echo "\n"
   # Small delay to allow local D1 to process the tick
   sleep 0.1
done

echo "✨ Simulation fast-forward complete."

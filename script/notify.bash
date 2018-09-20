#!/usr/bin/env bash

readonly CURRENT_DATE=$(date +'%Y-%m-%d %I:%M:%S')
readonly WORKING_DIR=$(basename "$(pwd)")

if [[ "${OSTYPE}" = "darwin"* ]]; then
  osascript -e "display notification \"${CURRENT_DATE}\" with title \"${*-${WORKING_DIR}}\""
  say --rate=800 "${1-0}"
fi

echo "[${CURRENT_DATE}] Done with ${*-${WORKING_DIR}}"
exit "${1-0}"

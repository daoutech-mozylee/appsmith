#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

cd /opt/appsmith/relay

# Source tlog function if available
if type tlog &>/dev/null; then
  tlog "Starting Relay Service (all-apps-server)..."
else
  echo "Starting Relay Service (all-apps-server)..."
fi

# Run the relay service
exec /opt/java/bin/java \
  -Dserver.port=8090 \
  -Djava.security.egd=file:/dev/./urandom \
  ${RELAY_JAVA_ARGS:-} \
  -jar all-apps-server.jar

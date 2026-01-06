#!/bin/bash

set -o errexit

min_java_major_version=17

maven_version_output="$(mvn --version)"
echo "$maven_version_output"

if [[ "$maven_version_output" != *"Java version: $min_java_major_version."* ]]; then
  echo $'\n'"Maven is not using Java $min_java_major_version. Please install Java $min_java_major_version and set it as the default Java version." >&2
  exit 1
fi

# Parse arguments to check for --fast flag and filter it out from maven args
is_tests_enabled=true
is_fast_build=false
maven_args=()

for i in "$@"; do
  if [[ $i == "-DskipTests" ]]; then
    is_tests_enabled=false
    maven_args+=("$i")
  elif [[ $i == "--fast" ]]; then
    is_fast_build=true
  else
    maven_args+=("$i")
  fi
done

# Remove previous dist directory only if not a fast build
if [ "$is_fast_build" = false ]; then
  rm -rf dist/
fi

if $is_tests_enabled; then
  # If tests will be run, let's pull some required images that often fail to be pulled from inside Maven's test run.
  docker image pull testcontainers/ryuk:0.3.0
fi

if [[ -f .env ]]; then
  echo "Found a .env file, loading environment variables from that file."
  set -o allexport
  source .env
fi

if [[ -f tx/transform.py ]]; then
  python3 tx/transform.py
fi

node scripts/check-field-constants.mjs

# Build the code. maven_args contains parameters excluding custom flags like --fast
if [ "$is_fast_build" = true ]; then
  echo "Fast build enabled: Skipping clean and using incremental build."
  mvn package "${maven_args[@]}"
else
  mvn clean package "${maven_args[@]}"
fi

if [[ $? -eq 0 ]]; then
  echo "mvn Successful"
else
  echo "mvn Failed"
  exit 1
fi

# Create the dist directory
mkdir -p dist/plugins

# Copy the server jar
cp -v ./appsmith-server/target/server-*.jar dist/

# Copy all the plugins
rsync -av --exclude "original-*.jar" ./appsmith-plugins/*/target/*.jar dist/plugins/

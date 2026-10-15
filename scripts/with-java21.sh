#!/usr/bin/env bash
# The Firestore and Storage emulators need Java 21+, and firebase-tools uses
# whichever `java` is first on PATH (not JAVA_HOME). If that one is older, put
# a Java 21 JDK in front of it, then run the given command.
set -euo pipefail

java_major() {
  "$1" -version 2>&1 | head -n1 | sed -E 's/.*version "([0-9]+).*/\1/'
}

if ! command -v java >/dev/null || [ "$(java_major java)" -lt 21 ]; then
  java21_home="${JAVA21_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
  if [ ! -x "$java21_home/bin/java" ]; then
    echo "Java 21+ is required for the emulators. Set JAVA21_HOME to a JDK 21+." >&2
    exit 1
  fi
  export PATH="$java21_home/bin:$PATH"
fi

exec "$@"

#!/usr/bin/env bash
# ==============================================================================
# build-release.sh — One-command Release AAB Builder for Notes App (Capacitor 8)
#
# Usage:
#   ./scripts/build-release.sh [OPTIONS]
#
# Options:
#   --bump                  Automatically increment versionCode by 1 (default)
#   --no-bump               Keep existing versionCode
#   --version-code <NUM>    Explicitly set versionCode to <NUM>
#   --version-name <STR>    Explicitly set versionName to <STR> (e.g. 1.0.1)
#   --help                  Show this help message
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_BUILD_GRADLE="${ROOT_DIR}/android/app/build.gradle"
KEY_PROPERTIES="${ROOT_DIR}/android/key.properties"

BUMP_VERSION=true
EXPLICIT_VERSION_CODE=""
EXPLICIT_VERSION_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bump)
      BUMP_VERSION=true
      shift
      ;;
    --no-bump)
      BUMP_VERSION=false
      shift
      ;;
    --version-code)
      EXPLICIT_VERSION_CODE="$2"
      BUMP_VERSION=false
      shift 2
      ;;
    --version-name)
      EXPLICIT_VERSION_NAME="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage instructions."
      exit 1
      ;;
  esac
done

echo "=========================================================="
echo "🚀 Notes App — Android Release AAB Builder"
echo "=========================================================="

cd "${ROOT_DIR}"

# 1. Version Code & Version Name Resolution
CURRENT_CODE=$(grep -E '^\s*versionCode\s+[0-9]+' "${APP_BUILD_GRADLE}" | awk '{print $2}' || echo "1")
CURRENT_NAME=$(grep -E '^\s*versionName\s+"[^"]+"' "${APP_BUILD_GRADLE}" | sed -E 's/.*versionName\s+"([^"]+)".*/\1/' || echo "1.0.0")

TARGET_CODE="${CURRENT_CODE}"
TARGET_NAME="${CURRENT_NAME}"

if [[ -n "${EXPLICIT_VERSION_CODE}" ]]; then
  TARGET_CODE="${EXPLICIT_VERSION_CODE}"
elif [[ "${BUMP_VERSION}" == "true" ]]; then
  TARGET_CODE=$((CURRENT_CODE + 1))
fi

if [[ -n "${EXPLICIT_VERSION_NAME}" ]]; then
  TARGET_NAME="${EXPLICIT_VERSION_NAME}"
fi

echo "📦 Version Config:"
echo "   Previous: versionCode ${CURRENT_CODE} | versionName \"${CURRENT_NAME}\""
echo "   Target:   versionCode ${TARGET_CODE} | versionName \"${TARGET_NAME}\""

# Update android/app/build.gradle
if [[ "${CURRENT_CODE}" != "${TARGET_CODE}" || "${CURRENT_NAME}" != "${TARGET_NAME}" ]]; then
  sed -i -E "s/^\s*versionCode\s+[0-9]+/        versionCode ${TARGET_CODE}/" "${APP_BUILD_GRADLE}"
  sed -i -E "s/^\s*versionName\s+\"[^\"]+\"/        versionName \"${TARGET_NAME}\"/" "${APP_BUILD_GRADLE}"
  echo "✔ Updated android/app/build.gradle"
fi

# 2. Check Signing Configuration
if [[ -f "${KEY_PROPERTIES}" ]]; then
  echo "🔐 Found signing configuration at android/key.properties"
elif [[ -n "${RELEASE_KEYSTORE_PATH:-}" ]]; then
  echo "🔐 Found signing configuration in environment variables"
else
  echo "⚠️  WARNING: android/key.properties not found."
  echo "   The resulting AAB will be unsigned or signed with debug keystore."
  echo "   See ANDROID.md and PLAY_STORE.md for keystore generation instructions."
fi

# 3. Web Production Build
echo ""
echo "⚙️  Building production web assets..."
npm run build

# 4. Capacitor Sync
echo ""
echo "🔄 Syncing assets to native Android project..."
npx cap sync android

# 5. Gradle Bundle Release
echo ""
echo "🤖 Building Android App Bundle (.aab)..."
cd "${ROOT_DIR}/android"
./gradlew bundleRelease

AAB_OUTPUT="${ROOT_DIR}/android/app/build/outputs/bundle/release/app-release.aab"

if [[ -f "${AAB_OUTPUT}" ]]; then
  FILE_SIZE=$(du -h "${AAB_OUTPUT}" | cut -f1)
  SHA256=$(sha256sum "${AAB_OUTPUT}" | awk '{print $1}')
  
  echo ""
  echo "=========================================================="
  echo "🎉 Release Build Succeeded!"
  echo "=========================================================="
  echo "📄 Artifact:    ${AAB_OUTPUT}"
  echo "📊 Size:        ${FILE_SIZE}"
  echo "🏷  versionCode: ${TARGET_CODE}"
  echo "🏷  versionName: ${TARGET_NAME}"
  echo "🔒 SHA256:      ${SHA256}"
  echo ""
  echo "👉 Ready to upload to Google Play Console: Internal / Closed Testing track."
  echo "=========================================================="
else
  echo "❌ Error: Expected bundle not found at ${AAB_OUTPUT}"
  exit 1
fi

# Android Build & Release Guide (Capacitor 8)

This guide documents the Android wrapper configuration, prerequisites, debug APK generation, Google Play signed release bundle (`.aab`) workflow, and version bumping for **Notes App**.

---

## 1. Overview & Architecture

- **Wrapper Framework**: Capacitor v8.x (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).
- **Application ID (`appId`)**: `com.tagore.notes` (configured in `capacitor.config.ts` and `android/app/build.gradle`).
- **App Name**: `Notes App`.
- **Web Directory**: `dist` (built via `npm run build`).
- **Local Data Storage**: IndexedDB (via Dexie 4) functions 100% locally and unmodified inside Android WebView (`android.webkit.WebView`). All notes, tasks, events, habits, focus sessions, and attachments remain strictly on-device.

### Web vs. Native Runtime Behavior
1. **Service Worker / PWA Caching**:
   - Web assets ship bundled directly within the native APK/AAB (`android/app/src/main/assets/public`).
   - Service worker caching inside WebView causes stale code, broken dynamic chunks, and duplicate caching layers.
   - Handled at runtime via `Capacitor.isNativePlatform()`:
     - `useRegisterSW({ immediate: !isNative })`: skips SW registration in native WebView.
     - An active unregister loop calls `navigator.serviceWorker.getRegistrations()` to purge any stale SW registrations.
     - PWA update/offline toasts are suppressed on native.
2. **Native Splash Screen**:
   - Uses `@capacitor/splash-screen`.
   - Native background styled with `#0f172a` (matching web dark splash).
   - Automatically hidden cleanly via `SplashScreen.hide()` once the React shell mounts.
3. **Status Bar Styling**:
   - Uses `@capacitor/status-bar`.
   - Dynamically synchronizes with the user's theme mode (Light: light background `#f8fafc` with dark text / Dark: dark background `#0f172a` with light text).

---

## 2. Android Studio & SDK Prerequisites

### Tooling Requirements
- **Java Development Kit (JDK)**: **JDK 21** (Required by Android Gradle Plugin 8.13.0 and Gradle 8.14.3). Android Studio Ladybug / Meerkat (2024.2+) includes OpenJDK 21 by default.
- **Android Gradle Plugin (AGP)**: `8.13.0` (in `android/build.gradle`).
- **Gradle Wrapper**: `8.14.3` (in `android/gradle/wrapper/gradle-wrapper.properties`).

### What to Install in Android Studio
Open **Android Studio** > **Settings** (or **Preferences** on macOS) > **Languages & Frameworks** > **Android SDK**:

1. **SDK Platforms Tab**:
   - Check **Android 16.0 ("Baklava") / API Level 36**.
   > **IMPORTANT — Google Play Policy**: Google Play requires all new apps and updates to target **API level 36 (Android 16)** starting August 31, 2026. Capacitor 8 targets API 36 out-of-the-box (`compileSdkVersion = 36`, `targetSdkVersion = 36` in `android/variables.gradle`).
2. **SDK Tools Tab**:
   - Check **Android SDK Build-Tools 36** (or `36.0.0` / `35.0.0`).
   - Check **Android SDK Command-line Tools (latest)**.
   - Check **Android SDK Platform-Tools**.
3. **Build Tools Configuration**:
   - In Android Studio > **Settings** > **Build, Execution, Deployment** > **Build Tools** > **Gradle**:
   - Set **Gradle JDK** to **Embedded JDK 21** or your system OpenJDK 21 installation (`/usr/lib/jvm/java-21` or mise `~/.local/share/mise/installs/java/21.0.2`).

---

## 3. Building Debug APK

### Option A: Command Line Interface (CLI)
Ensure `ANDROID_HOME` points to your Android SDK directory (or ensure `android/local.properties` exists with `sdk.dir=/path/to/android/sdk`):

```bash
# 1. Build web application
npm run build

# 2. Sync web assets and plugins to Android native project
npx cap sync android

# 3. Compile debug APK via Gradle wrapper
cd android && ./gradlew assembleDebug
```

The output APK is generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

To install directly to a connected physical device or running emulator:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Option B: Android Studio GUI
```bash
npx cap open android
```
1. Wait for Gradle sync to complete.
2. Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Locate the notification and click **locate** to reveal `app-debug.apk`.

---

## 4. Building Signed Release App Bundle (.aab) for Google Play

Google Play requires the **Android App Bundle (.aab)** format for all app submissions.

### Step 1: Generate Release Keystore
Generate a secure upload keystore using Java `keytool` (run once and keep safe):

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore notes-release-key.jks \
  -alias notes-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

> **CRITICAL SECURITY RULES FOR KEYSTORE**:
> - **NEVER** commit `*.jks` or `*.keystore` files to version control. They are ignored in `android/.gitignore`.
> - Store the keystore file in a secure, backed-up location (e.g. password manager, cloud vault, or secure CI secret storage).
> - If you lose this keystore, you cannot push updates to existing Google Play users unless enrolled in Google Play App Signing with a reset key.

### Step 2: Configure Gradle Release Signing Credentials
Create `android/key.properties` (this file is already in `android/.gitignore` and will never be committed):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=notes-key
storeFile=/path/to/notes-release-key.jks
```

Update `android/app/build.gradle` to load `key.properties` if present:

```groovy
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            if (keystorePropertiesFile.exists()) {
                signingConfig signingConfigs.release
            }
        }
    }
}
```

### Step 3: Build the Signed Release AAB
```bash
# 1. Build latest web bundle
npm run build

# 2. Sync to Android project
npx cap sync android

# 3. Build release bundle
cd android && ./gradlew bundleRelease
```

The output release bundle will be created at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 4: Testing the .aab Locally with bundletool (Optional)
Google's official `bundletool` can be used to extract universal APKs from the `.aab` for local verification:

```bash
# Generate device-specific APKs from the bundle
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks \
  --ks=/path/to/notes-release-key.jks \
  --ks-key-alias=notes-key

# Install the APKs to a connected test device
bundletool install-apks --apks=app-release.apks
```

---

## 5. Version Bumping

When publishing an update to Google Play or releasing a new build, bump the versions in `android/app/build.gradle`:

```groovy
android {
    defaultConfig {
        applicationId "com.tagore.notes"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        
        // 1. versionCode: Integer, MUST increment monotonically for every Google Play upload (1, 2, 3...)
        versionCode 2

        // 2. versionName: String, user-facing release name matching package.json
        versionName "1.1.0"
        
        ...
    }
}
```

### Versioning Rules:
1. `versionCode`:
   - Google Play will reject any upload that has a `versionCode` less than or equal to the currently published version.
   - Always increment by at least 1 (`1` -> `2` -> `3`).
2. `versionName`:
   - Follow Semantic Versioning (`MAJOR.MINOR.PATCH`, e.g. `1.0.0` -> `1.1.0`).
   - Match the `version` field in `package.json`.

---

## 6. Useful Commands Reference

| Action | Command |
|---|---|
| Rebuild web & sync Android | `npm run build && npx cap sync android` |
| Open in Android Studio | `npx cap open android` |
| Build debug APK (CLI) | `cd android && ./gradlew assembleDebug` |
| Build release AAB (CLI) | `cd android && ./gradlew bundleRelease` |
| Clean Android build cache | `cd android && ./gradlew clean` |
| Install debug APK to device | `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` |

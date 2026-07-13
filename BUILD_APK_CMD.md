# CMD diye APK Build (Android Studio chara)

## Ek baar setup (Windows CMD)

### 1. JDK 17 install
Download: https://adoptium.net/temurin/releases/?version=17
Install korar por CMD te check:
```
java -version
```

### 2. Android Command-line Tools install
Download: https://developer.android.com/studio#command-line-tools-only
(niche `Command line tools only` section theke Windows zip namao)

Extract koro ekhane:
```
C:\Android\cmdline-tools\latest\
```
(bhitore `bin`, `lib` folder thakbe)

### 3. Environment Variables set koro
CMD te (ekbar):
```
setx ANDROID_HOME "C:\Android"
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
setx PATH "%PATH%;C:\Android\cmdline-tools\latest\bin;C:\Android\platform-tools;%JAVA_HOME%\bin"
```
(CMD restart koro er por)

### 4. SDK packages install
```
sdkmanager --install "platform-tools" "platforms;android-34" "build-tools;34.0.0"
sdkmanager --licenses
```
(license gula `y` press kore accept koro)

---

## APK Build (project folder e)

### Prothom bar
```
npm install
npm run build:mobile
npx cap add android
npx cap sync android
cd android
gradlew.bat assembleDebug
```

APK pabe:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### Porer bar (code change korle)
```
npm run build:mobile
npx cap sync android
cd android
gradlew.bat assembleDebug
```

---

## Signed Release APK (Play Store er jonno)

### Keystore banao (ekbar)
```
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ffbpl
```

### android/app/build.gradle e add koro (android { ... } er bhitore):
```gradle
signingConfigs {
    release {
        storeFile file('../../my-release-key.jks')
        storePassword 'YOUR_PASSWORD'
        keyAlias 'ffbpl'
        keyPassword 'YOUR_PASSWORD'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

### Build:
```
cd android
gradlew.bat assembleRelease
```
APK: `android\app\build\outputs\apk\release\app-release.apk`

AAB (Play Store upload er jonno):
```
gradlew.bat bundleRelease
```
AAB: `android\app\build\outputs\bundle\release\app-release.aab`

---

## Phone e install
USB debugging on kore phone connect koro, tarpor:
```
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

Ba `app-debug.apk` file phone e copy kore direct install koro.
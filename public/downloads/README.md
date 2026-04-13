# APK downloads (static)

Place the **signed** Android APK here as:

`toot-android-beta.apk`

before running `next build` on the server (or your CI artifact step), when using:

`NEXT_PUBLIC_ANDROID_APK_URL=/downloads/toot-android-beta.apk`

Built APKs are ignored by git (see root `.gitignore`); deploy pipelines should copy the file into this folder.

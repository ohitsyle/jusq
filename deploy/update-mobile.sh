#!/bin/bash

echo "📱 Building and updating NUCash Mobile App..."

cd mobile

echo "🔧 Installing dependencies..."
npm install

echo "🏗️  Building for production..."

# iOS Build
if [ "$1" == "ios" ]; then
  echo "📱 Building iOS app..."
  npx react-native build-ios --mode Release
  echo "✅ iOS build complete! Check mobile/ios/build/"
fi

# Android Build
if [ "$1" == "android" ]; then
  echo "🤖 Building Android app..."
  cd android
  ./gradlew assembleRelease
  echo "✅ Android build complete! Check mobile/android/app/build/outputs/apk/release/"
fi

echo "🎉 Mobile app update complete!"

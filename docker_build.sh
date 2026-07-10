#!/bin/bash
set -e
echo "Instalando dependencias de Linux..."
npm install --legacy-peer-deps
echo "Preparando proyecto nativo de Android con nuevas configuraciones..."
npx expo prebuild --clean
echo "Compilando APK de Producción (Release) con Gradle..."
cd android
./gradlew assembleRelease
echo "Copiando APK..."
mkdir -p /app/output
cp app/build/outputs/apk/release/app-release.apk /app/output/forward-mobile-produccion.apk
echo "¡APK de producción generado exitosamente en forward-mobile/output/forward-mobile-produccion.apk!"

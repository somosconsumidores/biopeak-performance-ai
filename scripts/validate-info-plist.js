#!/usr/bin/env node

// Simple validation script for iOS Info.plist usage and Xcode linkage
// - Ensures required privacy keys exist exactly once with UIBackgroundModes including `location`
// - Verifies Xcode project (if present) points to ios/App/App/Info.plist

const fs = require('fs');
const path = require('path');

const INFO_PLIST_PATH = path.join('ios', 'App', 'App', 'Info.plist');
const PBXPROJ_PATH = path.join('ios', 'App', 'App.xcodeproj', 'project.pbxproj');

const REQUIRED_KEYS = [
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSHealthShareUsageDescription',
  'NSHealthUpdateUsageDescription',
];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function countOccurrences(str, sub) {
  return (str.match(new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

// 1) Validate Info.plist exists
if (!fs.existsSync(INFO_PLIST_PATH)) {
  fail(`Arquivo não encontrado: ${INFO_PLIST_PATH}. Rode: npx cap add ios && npx cap sync ios`);
}

const plistText = fs.readFileSync(INFO_PLIST_PATH, 'utf8');

// 2) Check required keys appear exactly once
for (const key of REQUIRED_KEYS) {
  const tag = `<key>${key}</key>`;
  const count = countOccurrences(plistText, tag);
  if (count === 0) fail(`Chave ausente no Info.plist: ${key}`);
  if (count > 1) fail(`Chave duplicada no Info.plist: ${key}`);
}

// 3) Check UIBackgroundModes contains location
const hasBackgroundModes = plistText.includes('<key>UIBackgroundModes</key>');
if (!hasBackgroundModes) fail('UIBackgroundModes ausente do Info.plist');
const hasLocationBg = /<key>UIBackgroundModes<\/key>[\s\S]*?<array>[\s\S]*?<string>location<\/string>[\s\S]*?<\/array>/.test(plistText);
if (!hasLocationBg) fail('UIBackgroundModes não contém a entrada "location"');

ok('Info.plist contém todas as chaves obrigatórias sem duplicação e com background-mode location.');

// 4) If Xcode project exists, ensure it points to the correct Info.plist
if (fs.existsSync(PBXPROJ_PATH)) {
  const pbx = fs.readFileSync(PBXPROJ_PATH, 'utf8');
  // Capacitor default path for iOS v7 projects
  const EXPECTED_PATH = 'App/App/Info.plist';
  const hasSetting = pbx.includes(`INFOPLIST_FILE = ${EXPECTED_PATH};`);

  if (!hasSetting) {
    // Try to extract current setting for diagnostics
    const m = pbx.match(/INFOPLIST_FILE = ([^;]+);/);
    const current = m ? m[1] : 'NÃO ENCONTRADO';
    fail(`Xcode target não está apontando para ${EXPECTED_PATH}. Atual: ${current}`);
  }
  ok('Xcode (project.pbxproj) está apontando para App/App/Info.plist.');
} else {
  warn('Projeto iOS não encontrado (App.xcodeproj). Validação do Xcode será pulada.');
}

ok('Validação do Info.plist concluída com sucesso.');

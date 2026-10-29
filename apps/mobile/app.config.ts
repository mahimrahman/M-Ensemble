/**
 * The app manifest, as code rather than `app.json`, because three things in it
 * depend on the machine building it: the API URL, the EAS project id, and
 * whether the Sentry and Firebase files are present. A JSON file cannot ask.
 *
 * Every value that was in `app.json` is still here, unchanged. The additions
 * are what the stores require of a 1.0: version and build numbers, the
 * encryption declaration, the privacy manifest, and the Android permission list.
 */

import fs from 'fs';
import path from 'path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Where a release build sends its requests. `EXPO_PUBLIC_API_URL` wins so a
 * preview build can point at staging (see `eas.json`); the default is
 * production, and `src/api/http.ts` falls back to the same literal.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://api.mensemble.app/api';

/**
 * `eas init` fills this in (and may also write `extra.eas.projectId` into the
 * config). Until then it is read from the environment so a build without an
 * EAS account does not fail on a missing id.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';

/**
 * `google-services.json` is the Firebase file Android push needs. It is
 * gitignored, so a fresh checkout has none, and pointing at a file that is not
 * there fails the prebuild. Only reference it when it exists.
 */
const GOOGLE_SERVICES = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const hasGoogleServices = fs.existsSync(path.resolve(__dirname, GOOGLE_SERVICES));

/**
 * The Sentry config plugin uploads source maps at build time and needs the
 * org and project to do it. Without them it throws, so a local build on a
 * machine with no Sentry account skips the plugin entirely — the SDK itself
 * is still bundled, just disabled (`src/lib/sentry.ts`).
 */
const sentryPlugin: NonNullable<ExpoConfig['plugins']>[number] | null = process.env.SENTRY_ORG
  ? [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ]
  : null;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'M’Ensemble',
  slug: 'm-ensemble',
  version: '1.0.0',
  // One runtime per app version: an OTA update can never land on a binary with
  // different native modules than it was built against.
  runtimeVersion: { policy: 'appVersion' },
  orientation: 'portrait',
  scheme: 'mensemble',
  userInterfaceStyle: 'light',
  // `newArchEnabled: true` from app.json is gone: SDK 57 builds the new
  // architecture only and dropped the key from the schema.
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mahimrahman.mensemble',
    buildNumber: '1',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      CFBundleDisplayName: 'M’Ensemble',
      // The app only uses HTTPS and the OS's own crypto — exempt from the
      // export-compliance questionnaire on every submission.
      ITSAppUsesNonExemptEncryption: false,
    },
    // Universal links for the reset / verify / donate deep links. Needs the
    // AASA file served from the domain first; until then the custom scheme
    // (`mensemble://`) carries them.
    // associatedDomains: ['applinks:mensemble.app'],
    privacyManifests: {
      // Apple's "required reason" APIs. React Native, AsyncStorage and Expo's
      // own modules touch these four; the codes are the standard allowed
      // reasons for each, and a build without them is rejected at upload.
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    package: 'com.mahimrahman.mensemble',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F7F7EF',
    },
    // The exact list the app uses, so Play's data-safety form and the
    // manifest agree. The camera is the check-in scanner; photos are the
    // coordinators' posters; location picks the city.
    permissions: [
      'CAMERA',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'READ_MEDIA_IMAGES',
    ],
    ...(hasGoogleServices ? { googleServicesFile: GOOGLE_SERVICES } : {}),
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
    name: 'M’Ensemble',
    shortName: 'M’Ensemble',
    themeColor: '#061E1B',
    backgroundColor: '#F7F7EF',
    display: 'standalone',
    orientation: 'portrait',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#F7F7EF',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0A5247',
        defaultChannel: 'default',
      },
    ],
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'M’Ensemble uses your location to find your city and show its mosques and events.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'M’Ensemble uses the camera to scan check-in codes at events.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'M’Ensemble lets mosque coordinators choose a poster for an event or class from their photos.',
        cameraPermission:
          'M’Ensemble lets mosque coordinators photograph a poster for an event or class.',
      },
    ],
    ...(sentryPlugin ? [sentryPlugin] : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: API_URL,
    eas: { projectId: EAS_PROJECT_ID },
  },
  backgroundColor: '#F2F7F6',
});

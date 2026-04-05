import { ExpoConfig, ConfigContext } from 'expo/config';

const appName = process.env.COZE_PROJECT_NAME || process.env.EXPO_PUBLIC_COZE_PROJECT_NAME || 'Ó¦ÓÃ';
const projectId = process.env.COZE_PROJECT_ID || process.env.EXPO_PUBLIC_COZE_PROJECT_ID;
const slugAppName = projectId ? `app${projectId}` : 'myapp';
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || '';

export default ({ config }: ConfigContext): ExpoConfig => {
  const internal = config._internal;

  const newConfig: ExpoConfig = {
    ...config,
    "name": appName,
    "slug": slugAppName,
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": `com.anonymous.x${projectId || '0'}`
    },
    "android": {
      "usesCleartextTraffic": true,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": `com.anonymous.x${projectId || '0'}`
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true
          }
        }
      ],
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow app to access your photos",
          "cameraPermission": "Allow app to use your camera",
          "microphonePermission": "Allow app to access your microphone"
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Allow app to access your location"
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow app to access camera",
          "microphonePermission": "Allow app to access microphone",
          "recordAudioAndroid": true
        }
      ],
      [
        "expo-updates",
        {
          "username": "anonymous"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      ...config.extra,
      "eas": {
        "projectId": "ad167912-b5a9-4b6f-bad9-ec28eb8b7537"
      },
      "router": {
        ...(config.extra as any)?.router,
        "origin": backendUrl,
      },
    },
  };

  if (internal) {
    (newConfig as any)._internal = internal;
  }

  return newConfig;
}

const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * POS-terminal compatibility tweaks that have no app.json equivalent.
 *
 * - usesCleartextTraffic: stores point the app at an on-premise Odoo box over
 *   plain HTTP on the LAN (http://192.168.x.x). Android 9+ blocks cleartext by
 *   default, so without this every POS fails at login.
 * - largeHeap: these terminals loop full-screen video ads all day on shared RAM.
 * - camera not required: Sunmi countertop units (e.g. T2s) have no camera and
 *   scan via a USB/HID wedge. Declaring the feature optional keeps the APK
 *   installable on them and off the "requires camera" filter in stores.
 */
module.exports = function withPosAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application = manifest.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
      application.$['android:largeHeap'] = 'true';
    }

    const features = manifest.manifest['uses-feature'] ?? [];
    const CAMERA_FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus'];
    for (const name of CAMERA_FEATURES) {
      const existing = features.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    manifest.manifest['uses-feature'] = features;

    return cfg;
  });
};

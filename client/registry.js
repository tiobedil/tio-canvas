// What the canvas knows about screens, whatever project it runs in. The project
// owns the list of screens (project.js, served from its own config file); this
// file owns the shape a screen must have and the device presets.
// The page picker groups by kind, so every page, production or prototype, must
// carry one. Fail loudly when one does not.
export const screenKinds = { production: 'Production', prototype: 'Prototypes' };
export function validateScreens(screens) {
  for (const screen of screens) {
    if (!Object.hasOwn(screenKinds, screen.kind)) throw new Error(`Canvas screen "${screen.id}" needs kind: "production" or "prototype".`);
  }
}
export const presets = {
  custom: { label: 'Custom' },
  laptop: { label: 'Laptop', group: 'Desktop', device: 'laptop', width: 1440, height: 900 },
  'macbook-air-13': { label: 'MacBook Air 13-inch', group: 'Desktop', device: 'laptop', width: 1470, height: 956 },
  'macbook-pro-14': { label: 'MacBook Pro 14-inch', group: 'Desktop', device: 'laptop', width: 1512, height: 982 },
  desktop: { label: 'Desktop', group: 'Desktop', device: 'desktop', width: 1920, height: 1080 },
  'desktop-qhd': { label: 'Desktop QHD', group: 'Desktop', device: 'desktop', width: 2560, height: 1440 },
  'iphone-se': { label: 'iPhone SE', group: 'Mobile', device: 'phone', touch: true, width: 375, height: 667 },
  'iphone-16': { label: 'iPhone 16', group: 'Mobile', device: 'phone', touch: true, width: 393, height: 852 },
  'iphone-16-pro-max': { label: 'iPhone 16 Pro Max', group: 'Mobile', device: 'phone', touch: true, width: 440, height: 956 },
  'pixel-9': { label: 'Pixel 9', group: 'Mobile', device: 'phone', touch: true, width: 412, height: 915 },
  'galaxy-s24': { label: 'Galaxy S24', group: 'Mobile', device: 'phone', touch: true, width: 360, height: 780 },
  'ipad-mini': { label: 'iPad mini', group: 'Tablet', device: 'tablet', touch: true, width: 744, height: 1133 },
  'ipad-air': { label: 'iPad Air', group: 'Tablet', device: 'tablet', touch: true, width: 820, height: 1180 },
  'ipad-pro-11': { label: 'iPad Pro 11-inch', group: 'Tablet', device: 'tablet', touch: true, width: 834, height: 1194 },
  'ipad-pro-13': { label: 'iPad Pro 13-inch', group: 'Tablet', device: 'tablet', touch: true, width: 1032, height: 1376 },
  'galaxy-z-fold-6-cover': { label: 'Galaxy Z Fold 6 (cover)', group: 'Foldable', device: 'phone', touch: true, width: 344, height: 748 },
  'galaxy-z-fold-6-open': { label: 'Galaxy Z Fold 6 (open)', group: 'Foldable', device: 'phone', touch: true, width: 673, height: 841 },
};

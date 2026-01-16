const sharp = require('sharp');

const sizes = [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 180, name: 'apple-touch-icon-180x180.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 144, name: 'apple-touch-icon-144x144.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
  { size: 76, name: 'apple-touch-icon-76x76.png' },
  { size: 60, name: 'apple-touch-icon-60x60.png' },
  { size: 57, name: 'apple-touch-icon-57x57.png' },
  { size: 72, name: 'apple-touch-icon-72x72.png' },
  { size: 180, name: 'apple-touch-icon-precomposed.png' },
  { size: 120, name: 'apple-touch-icon-120x120-precomposed.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

async function generateIcons() {
  for (const { size, name } of sizes) {
    try {
      await sharp('icon.svg')
        .resize(size, size)
        .png()
        .toFile(name);
      console.log(`✓ Created ${name} (${size}x${size})`);
    } catch (err) {
      console.error(`✗ Error creating ${name}:`, err.message);
    }
  }

  try {
    await sharp('icon.svg')
      .resize(32, 32)
      .png()
      .toFile('favicon.png');
    console.log('✓ Created favicon.png (32x32)');
  } catch (err) {
    console.error('✗ Error creating favicon.png:', err.message);
  }
}

generateIcons().then(() => console.log('\nAll icons generated!'));
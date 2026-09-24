import os
import subprocess

SVG_STANDARD = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.32"/>
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect width="512" height="512" rx="116" fill="url(#bgGrad)"/>

  <!-- Note Document with Shadow -->
  <g filter="url(#shadow)">
    <!-- Main page body with folded corner -->
    <path d="M156 106 H300 L366 172 V390 C366 401 357 410 346 410 H156 C145 410 136 401 136 390 V126 C136 115 145 106 156 106 Z" fill="#ffffff"/>
    <!-- Folded corner flap -->
    <path d="M300 106 V158 C300 166 306 172 314 172 H366 Z" fill="url(#foldGrad)"/>
    
    <!-- Text preview lines inside note -->
    <rect x="176" y="210" width="150" height="14" rx="7" fill="#93c5fd"/>
    <rect x="176" y="246" width="120" height="14" rx="7" fill="#bfdbfe"/>
    <rect x="176" y="282" width="140" height="14" rx="7" fill="#dbeafe"/>
    <rect x="176" y="318" width="90" height="14" rx="7" fill="#e2e8f0"/>

    <!-- Amber Pin Emblem -->
    <circle cx="156" cy="126" r="14" fill="#f59e0b"/>
    <circle cx="156" cy="126" r="7" fill="#fbbf24"/>
  </g>
</svg>'''

SVG_MASKABLE = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Full bleed background for adaptive masks -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>

  <!-- Centered Note Document scaled to safe zone (80% diameter) -->
  <g transform="translate(51, 51) scale(0.8)" filter="url(#shadow)">
    <path d="M156 106 H300 L366 172 V390 C366 401 357 410 346 410 H156 C145 410 136 401 136 390 V126 C136 115 145 106 156 106 Z" fill="#ffffff"/>
    <path d="M300 106 V158 C300 166 306 172 314 172 H366 Z" fill="url(#foldGrad)"/>
    
    <rect x="176" y="210" width="150" height="14" rx="7" fill="#93c5fd"/>
    <rect x="176" y="246" width="120" height="14" rx="7" fill="#bfdbfe"/>
    <rect x="176" y="282" width="140" height="14" rx="7" fill="#dbeafe"/>
    <rect x="176" y="318" width="90" height="14" rx="7" fill="#e2e8f0"/>

    <circle cx="156" cy="126" r="14" fill="#f59e0b"/>
    <circle cx="156" cy="126" r="7" fill="#fbbf24"/>
  </g>
</svg>'''

os.makedirs('public', exist_ok=True)

# Write master SVG
with open('public/favicon.svg', 'w') as f:
    f.write(SVG_STANDARD)

with open('public/maskable.svg', 'w') as f:
    f.write(SVG_MASKABLE)

# Render PNGs using rsvg-convert
subprocess.run(['rsvg-convert', '-w', '192', '-h', '192', 'public/favicon.svg', '-o', 'public/pwa-192x192.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '512', '-h', '512', 'public/favicon.svg', '-o', 'public/pwa-512x512.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '180', '-h', '180', 'public/favicon.svg', '-o', 'public/apple-touch-icon.png'], check=True)
subprocess.run(['rsvg-convert', '-w', '512', '-h', '512', 'public/maskable.svg', '-o', 'public/pwa-maskable-512x512.png'], check=True)

# Create favicon.ico using convert
subprocess.run(['convert', '-background', 'none', 'public/favicon.svg', '-resize', '48x48', 'public/favicon.ico'], check=True)

# Clean up temp maskable.svg
if os.path.exists('public/maskable.svg'):
    os.remove('public/maskable.svg')

print("Generated all PWA icons successfully.")

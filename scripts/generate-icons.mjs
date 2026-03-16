import sharp from 'sharp'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="100" fill="#16a34a"/>

  <!-- Brain outline (minimal, symmetrical) -->
  <g fill="none" stroke="white" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
    <!-- Left hemisphere -->
    <path d="
      M 200 320
      C 200 320 150 310 140 270
      C 130 230 155 210 155 210
      C 145 190 150 165 170 158
      C 175 140 195 130 215 138
      C 225 120 248 115 256 118
    "/>
    <!-- Right hemisphere -->
    <path d="
      M 312 320
      C 312 320 362 310 372 270
      C 382 230 357 210 357 210
      C 367 190 362 165 342 158
      C 337 140 317 130 297 138
      C 287 120 264 115 256 118
    "/>
    <!-- Center divide -->
    <line x1="256" y1="118" x2="256" y2="320"/>
    <!-- Bottom curve connecting both sides -->
    <path d="M 200 320 Q 256 345 312 320"/>
    <!-- Left inner detail -->
    <path d="M 155 210 Q 195 220 200 260"/>
    <!-- Right inner detail -->
    <path d="M 357 210 Q 317 220 312 260"/>
  </g>

  <!-- "jif" text -->
  <text
    x="256"
    y="430"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-weight="bold"
    font-size="88"
    fill="white"
    letter-spacing="4"
  >jif</text>
</svg>
`

const svgBuffer = Buffer.from(svg)

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png')
console.log('✓ icon-192.png')

await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512.png')
console.log('✓ icon-512.png')

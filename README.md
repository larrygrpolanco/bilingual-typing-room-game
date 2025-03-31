Okay, thank you for the detailed clarifications! This gives me a much clearer picture. Here's a plan incorporating your feedback:

Core Technologies:

Framework: SvelteKit

Styling: Plain CSS in src/app.css with custom classes.

Interactivity: HTML5 Canvas using the Konva.js library. It's mature, well-documented, excellent for 2D graphics and complex object manipulation (including touch events like drag, pinch-zoom, rotate), and handles object layering and events efficiently.

Font: Custom Chinese font (王漢宗中明體注音.ttf) applied globally via @font-face.

Project Structure:

your-sveltekit-app/
├── static/
│ ├── fonts/
│ │ └── 王漢宗中明體注音.ttf <-- Your custom font
│ ├── images/
│ │ └── room-background.png <-- Your blank room image
│ └── items/ <-- Folder for item images
│ ├── sofa1.png
│ ├── sofa2.png
│ ├── sofa3.png
│ ├── sofa4.png
│ ├── chair1.png
│ │ ... etc.
├── src/
│ ├── app.css <-- Global styles and @font-face
│ ├── app.html <-- Base HTML structure
│ ├── lib/
│ │ └── WordBankData.js <-- Define word bank data here
│ ├── routes/
│ │ └── +page.svelte <-- The main component for your app
│ │ └── +layout.svelte <-- Basic layout (can often be simple)
├── package.json
├── svelte.config.js
├── vite.config.js
└── ... (other SvelteKit config files)


Data Structure (src/lib/WordBankData.js):

// src/lib/WordBankData.js
export const wordBank = {
"客廳": [ // Living Room
{ chinese: "沙發", english: "Sofa", baseName: "sofa" },
{ chinese: "電視", english: "TV", baseName: "tv" },
{ chinese: "桌子", english: "Table", baseName: "table" },
{ chinese: "椅子", english: "Chair", baseName: "chair" },
{ chinese: "燈", english: "Light", baseName: "light" },
],
"臥室": [ // Bedroom
{ chinese: "床", english: "Bed", baseName: "bed" },
{ chinese: "衣櫃", english: "Wardrobe", baseName: "wardrobe" },
// ... other bedroom items
],
"廚房": [ // Kitchen
{ chinese: "冰箱", english: "Refrigerator", baseName: "refrigerator" },
{ chinese: "水槽", english: "Sink", baseName: "sink" },
// ... other kitchen items
],
"浴室": [ // Bathroom
{ chinese: "馬桶", english: "Toilet", baseName: "toilet" },
{ chinese: "浴缸", english: "Bathtub", baseName: "bathtub" },
// ... other bathroom items
]
};

// Helper function to easily get all items if needed for searching
export function getAllItems() {
let all = [];
for (const room in wordBank) {
all = all.concat(wordBank[room]);
}
return all;
}

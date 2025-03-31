// src/lib/WordBankData.js
export const wordBank = {
	客廳: [
		// Living Room
		{ chinese: '沙發', english: 'Sofa', baseName: 'sofa' },
		{ chinese: '電視', english: 'TV', baseName: 'tv' },
		{ chinese: '桌子', english: 'Table', baseName: 'table' },
		{ chinese: '椅子', english: 'Chair', baseName: 'chair' },
		{ chinese: '燈', english: 'Light', baseName: 'light' }
	],
	臥室: [
		// Bedroom
		{ chinese: '床', english: 'Bed', baseName: 'bed' },
		{ chinese: '枕頭', english: 'Pillow', baseName: 'pillow' },
		{ chinese: '衣櫃', english: 'Closet', baseName: 'closet' },
		{ chinese: '冷氣', english: 'AC', baseName: 'ac' },
		{ chinese: '玩具', english: 'Toy', baseName: 'toy' } 
	],
	廚房: [
		// Kitchen
		{ chinese: '冰箱', english: 'fridge', baseName: 'fridge' },
		{ chinese: '水槽', english: 'Sink', baseName: 'sink' },
		{ chinese: '瓦斯爐', english: 'Stove', baseName: 'stove' }
		// ... other kitchen items
	],
	浴室: [
		// Bathroom
		{ chinese: '馬桶', english: 'Toilet', baseName: 'toilet' },
		{ chinese: '浴缸', english: 'Bathtub', baseName: 'bathtub' },
		{ chinese: '水槽', english: 'Sink', baseName: 'sink' },
        { chinese: '鏡子', english: 'Mirror', baseName: 'mirror' }
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

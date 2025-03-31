<script>
	import { onMount, onDestroy } from 'svelte';
	import { wordBank, getAllItems, roomTranslations } from '$lib/WordBankData.js';
	import BackgroundSelector from '$lib/BackgroundSelector.svelte';

	// --- State Variables ---
	let selectedRoom = Object.keys(wordBank)[0]; // Default to first room
	let currentWordList = wordBank[selectedRoom];
	let inputValue = '';
	let selectedWord = null;
	let errorMessage = null;
	let errorTimeout = null;
	let roomBackground = 'room-background1.png';

	let showWordModal = false; // For displaying the word selection modal
	let showImageSelector = false;
	let wordToSelectImagesFor = null;
	let selectedImageSrc = null;

	// Konva related state
	let Konva = null;
	let konvaStage = null;
	let konvaLayer = null;
	let konvaTransformer = null;
	let currentManipulatingImage = null;
	let selectedPlacedItem = null;

	// Undo/Redo State
	let history = [];
	let historyIndex = -1;

	// --- Computed Properties ---
	$: currentWordList = wordBank[selectedRoom];
	$: canUndo = historyIndex > 0;
	$: canDelete = selectedPlacedItem !== null;

	// --- Lifecycle Functions ---
	onMount(async () => {
		Konva = (await import('konva')).default;

		if (Konva) {
			setupKonva();
			saveHistory();
		} else {
			console.error('Failed to load Konva library.');
		}

		const container = document.getElementById('konva-container');
		if (container) {
			container.style.backgroundImage = `url('/images/${roomBackground}')`;
		}

		// Register service worker for caching
		if ('serviceWorker' in navigator) {
			try {
				const registration = await navigator.serviceWorker.register('/service-worker.js');
				console.log('Service worker registered:', registration);
			} catch (error) {
				console.error('Service worker registration failed:', error);
			}
		}

		return () => {
			if (errorTimeout) clearTimeout(errorTimeout);
			if (konvaStage) {
				konvaStage.destroy();
			}
		};
	});

	// --- Functions ---
	function handleBackgroundChange(event) {
		roomBackground = event.detail.background;
		// Update the konva container background
		const container = document.getElementById('konva-container');
		if (container) {
			container.style.backgroundImage = `url('/images/${roomBackground}')`;
		}
	}

	// --- Save Room Function ---
	function saveRoom() {
		if (!Konva || !konvaStage || !konvaLayer) {
			showTemporaryError('無法儲存房間。請再試一次。', true);
			return;
		}

		try {
			// Create a name for the room
			const timestamp = new Date().toISOString();
			const roomName = `${roomTranslations[selectedRoom]} - ${new Date().toLocaleString()}`;

			// Get the stage data to save
			const stageData = konvaLayer.toJSON();

			// Create the room object to save
			const roomToSave = {
				name: roomName,
				roomType: selectedRoom,
				background: roomBackground,
				stageData: stageData,
				savedAt: timestamp,
				originalWidth: konvaStage.width(),
				originalHeight: konvaStage.height()
			};

			// Get existing saved rooms or initialize empty array
			let savedRooms = [];
			const existingRooms = localStorage.getItem('savedRooms');
			if (existingRooms) {
				savedRooms = JSON.parse(existingRooms);
			}

			// Add new room and save back to localStorage
			savedRooms.push(roomToSave);
			localStorage.setItem('savedRooms', JSON.stringify(savedRooms));

			showTemporaryError('房間儲存成功！', false);
			setTimeout(() => {
				errorMessage = null;
			}, 2000);
		} catch (error) {
			console.error('Error saving room:', error);
			showTemporaryError('儲存房間時出錯。', true);
		}
	}

	function setupKonva() {
		if (!Konva) {
			console.error('Konva not loaded in setupKonva');
			return;
		}

		const container = document.getElementById('konva-container');
		if (!container) return;

		const width = container.offsetWidth;
		const height = width * 0.6;

		konvaStage = new Konva.Stage({
			container: 'konva-container',
			width: width,
			height: height
		});

		konvaLayer = new Konva.Layer();
		konvaStage.add(konvaLayer);

		konvaTransformer = new Konva.Transformer({
			nodes: [],
			keepRatio: true,
			enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
		});
		konvaLayer.add(konvaTransformer);

		konvaStage.on('click tap', function (e) {
			if (e.target === konvaStage) {
				deselectItem();
				return;
			}
			const targetNode = e.target;
			if (targetNode !== currentManipulatingImage && targetNode instanceof Konva.Image) {
				selectItemForDeletion(targetNode);
			} else if (targetNode.getParent() === konvaTransformer) {
				// Clicked on transformer handles - do nothing
			} else {
				deselectItem();
			}
		});

		konvaLayer.draw();
	}

	function deselectItem() {
		if (selectedPlacedItem) {
			selectedPlacedItem.draggable(false);
			konvaTransformer.nodes([]);
			selectedPlacedItem = null;
			konvaLayer.batchDraw();
		}
	}

	function selectItemForDeletion(node) {
		deselectItem();
		selectedPlacedItem = node;
		selectedPlacedItem.draggable(true);
		konvaTransformer.nodes([node]);
		currentManipulatingImage = node;
		konvaLayer.batchDraw();
	}

	function handleRoomButtonClick(room) {
		selectedRoom = room;
		showWordModal = true; // Show word selection modal with hints
	}

	function handleWordHintClick(word) {
		selectedWord = word;
		showWordModal = false;
		// Optionally, we could autofill the input with the selected word:
		// inputValue = word.english;
		// But per requirements, we'll let them type it themselves
	}

	function handleInput() {
		// We'll keep the error visible if the user hasn't found the correct word yet
	}

	function handleSubmit() {
		const searchTerm = inputValue.trim().toLowerCase();
		if (!searchTerm) return;

		// Show searching message
		showTemporaryError('正在尋找...'); // "Searching..."

		// Check against ALL words (not just the current room)
		const allItems = getAllItems();
		const foundItem = allItems.find(
			(item) =>
				item.english.toLowerCase() === searchTerm ||
				item.chinese === searchTerm ||
				`${item.chinese} - ${item.english}`.toLowerCase() === searchTerm ||
				`${item.chinese.toLowerCase()} - ${item.english.toLowerCase()}` === searchTerm
		);

		if (foundItem) {
			wordToSelectImagesFor = foundItem;
			showImageSelector = true;
			errorMessage = null;
			clearTimeout(errorTimeout);
			inputValue = '';
		} else {
			showTemporaryError('找不到這個詞語。請看一下詞語表，再試一次！', true); // "Can't find this word. Please look at the word list and try again!"

			// Add a gentle shake animation to the input field
			const inputElement = document.querySelector('.input-area input');
			if (inputElement) {
				inputElement.classList.add('shake-animation');
				setTimeout(() => {
					inputElement.classList.remove('shake-animation');
				}, 500);
			}
		}
	}

	function showTemporaryError(message, isPersistent = false) {
		errorMessage = message;
		if (errorTimeout) clearTimeout(errorTimeout);

		if (!isPersistent) {
			errorTimeout = setTimeout(() => {
				errorMessage = null;
			}, 3000);
		}
	}

	function handleImageSelection(baseName, index) {
		selectedImageSrc = `/images/items/${baseName}${index}.png`;
		showImageSelector = false;
		addImageToCanvas(selectedImageSrc);
	}

	function addImageToCanvas(src) {
		if (!Konva) return;
		deselectItem();
		if (currentManipulatingImage) {
			handleCancelPlacement();
		}

		showTemporaryError('正在加載圖片...');

		const imageObj = new Image();
		imageObj.onload = function () {
			errorMessage = null;
			if (errorTimeout) clearTimeout(errorTimeout);

			const newWidth = imageObj.width / 3;
			const newHeight = imageObj.height / 3;

			currentManipulatingImage = new Konva.Image({
				image: imageObj,
				x: konvaStage.width() / 2 - newWidth / 2,
				y: konvaStage.height() / 2 - newHeight / 2,
				width: newWidth,
				height: newHeight,
				draggable: true,
				name: 'object'
			});

			konvaLayer.add(currentManipulatingImage);
			konvaTransformer.nodes([currentManipulatingImage]);
			konvaLayer.batchDraw();

			currentManipulatingImage.to({
				duration: 0.3,
				scaleX: 1.05,
				scaleY: 1.05,
				easing: Konva.Easings.ElasticEaseOut,
				onFinish: function () {
					currentManipulatingImage.to({
						duration: 0.2,
						scaleX: 1,
						scaleY: 1
					});
				}
			});
		};
		imageObj.onerror = function () {
			console.error('Error loading image:', src);
			showTemporaryError('圖片加載失敗。');
		};
		imageObj.src = src;
	}

	function handleConfirmPlacement() {
		if (!currentManipulatingImage) return;

		const isExistingItem = selectedPlacedItem === currentManipulatingImage;

		currentManipulatingImage.draggable(false);
		konvaTransformer.nodes([]);

		currentManipulatingImage = null;
		if (isExistingItem) {
			selectedPlacedItem = null;
		}

		konvaLayer.batchDraw();
		saveHistory();
	}

	function handleCancelPlacement() {
		if (!currentManipulatingImage) return;

		konvaTransformer.nodes([]);
		currentManipulatingImage.destroy();

		if (selectedPlacedItem === currentManipulatingImage) {
			selectedPlacedItem = null;
		}
		currentManipulatingImage = null;

		konvaLayer.batchDraw();
		saveHistory();
	}

	// --- History Management ---
	function saveHistory() {
		history = history.slice(0, historyIndex + 1);
		const jsonState = konvaLayer.toJSON();
		history.push(jsonState);
		historyIndex = history.length - 1;

		if (history.length > 30) {
			history.shift();
			historyIndex--;
		}

		deselectItem();
	}

	function loadState(stateIndex) {
		if (!Konva) return;
		if (stateIndex < 0 || stateIndex >= history.length) return;

		const jsonState = history[stateIndex];
		const oldLayer = konvaLayer;
		konvaLayer = Konva.Node.create(jsonState);
		konvaStage.add(konvaLayer);
		oldLayer.remove();

		setupKonvaTransformer();
		konvaStage.draw();
		historyIndex = stateIndex;

		currentManipulatingImage = null;
		selectedPlacedItem = null;
		konvaTransformer.nodes([]);
	}

	function setupKonvaTransformer() {
		if (!Konva) return;
		konvaTransformer = new Konva.Transformer({
			nodes: [],
			keepRatio: true,
			enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
		});
		konvaLayer.add(konvaTransformer);
	}

	function handleUndo() {
		if (canUndo) {
			loadState(historyIndex - 1);
		}
	}
</script>

<div class="app-container">
	<!-- Home Button -->
	<a href="/" class="home-button">
		<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
		</svg>
	</a>

	<!-- Room Buttons Section -->
	<section class="room-buttons-section">
		<div class="room-buttons">
			{#each Object.keys(wordBank) as room}
				<button
					class="room-button {selectedRoom === room ? 'active' : ''}"
					on:click={() => handleRoomButtonClick(room)}
				>
					{roomTranslations[room]}
				</button>
			{/each}
		</div>

		<!-- Add this back to show the selected word as a hint -->
		{#if selectedWord}
			<div class="selected-word">
				<span class="word-label">拼寫提示：</span>
				<!-- Spelling hint: -->
				<span class="word-value">{selectedWord.chinese} - {selectedWord.english}</span>
			</div>
		{/if}
	</section>

	<!-- Canvas Section -->
	<section class="canvas-section">
		<div id="konva-container">
			<!-- Konva Canvas will be injected here -->
		</div>

		<BackgroundSelector
			currentBackground={roomBackground}
			on:backgroundChange={handleBackgroundChange}
		/>

		<!-- Canvas action buttons -->
		<div class="canvas-action-buttons">
			<!-- Save Room Button -->
			<button
				class="save-button"
				title="儲存房間"
				aria-label="儲存房間到畫廊 Save room to gallery"
				on:click={saveRoom}
			>
				<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
						fill="white"
					/>
				</svg>
				<span>儲存房間</span>
			</button>

			<!-- Undo Button -->
			<!-- <button
				class="undo-button {canUndo ? '' : 'disabled'}"
				title="撤銷"
				aria-label="撤銷上一步操作 Undo last action"
				on:click={handleUndo}
				disabled={!canUndo}
			>
				<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
					<path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="white" />
				</svg>
				<span>撤銷</span>
			</button> -->
		</div>

		<!-- Confirmation Buttons inside canvas section -->
		{#if currentManipulatingImage}
			<div class="canvas-confirmation-buttons">
				<button
					class="confirm-button"
					title="確定放置"
					aria-label="確定放置物品 Confirm placement"
					on:click={handleConfirmPlacement}
				>
					<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="white" />
					</svg>
				</button>
				<button
					class="cancel-button"
					title="取消"
					aria-label="取消放置 Cancel placement"
					on:click={handleCancelPlacement}
				>
					<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
							fill="white"
						/>
					</svg>
				</button>
			</div>
		{/if}
	</section>

	<!-- Input Section -->
	<section class="input-section">
		<div class="typing-instruction">
			請輸入我們已經學過的任何詞語 (中文或英文):
			<!-- Please type any word we have learned (Chinese or English): -->
		</div>

		<div class="input-area">
			<form on:submit|preventDefault={handleSubmit}>
				<input
					type="text"
					bind:value={inputValue}
					on:input={handleInput}
					placeholder="輸入詞語 Enter word"
					aria-label="輸入詞語或英文單詞 Enter Chinese or English word"
				/>
				<button type="submit">✔️</button>
			</form>
			{#if errorMessage}
				<div class="error-message">{errorMessage}</div>
			{/if}
		</div>
	</section>
</div>

<!-- Word Hint Modal -->
{#if showWordModal}
	<div
		class="modal-overlay"
		on:click={() => (showWordModal = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-instructions">拼寫提示：</div>
			<!-- Spelling Hints: -->
			<div class="word-choices">
				{#each currentWordList as word}
					<button class="word-choice-button" on:click={() => handleWordHintClick(word)}>
						{word.chinese} - {word.english}
					</button>
				{/each}
			</div>
			<button on:click={() => (showWordModal = false)}>關閉</button>
		</div>
	</div>
{/if}

<!-- Image Selection Modal -->
{#if showImageSelector && wordToSelectImagesFor}
	<div
		class="modal-overlay"
		on:click={() => (showImageSelector = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-instructions">選擇一個 {wordToSelectImagesFor.chinese}:</div>
			<div class="image-choices">
				{#each [1, 2, 3, 4] as i}
					<img
						src="/images/items/{wordToSelectImagesFor.baseName}{i}.png"
						alt="{wordToSelectImagesFor.english} option {i}"
						on:click={() => handleImageSelection(wordToSelectImagesFor.baseName, i)}
						loading="lazy"
					/>
				{/each}
			</div>
			<button on:click={() => (showImageSelector = false)}>關閉</button>
		</div>
	</div>
{/if}

<style>
	/* Home Button Styles */
	.home-button {
		position: absolute;
		top: var(--spacing-3);
		left: var(--spacing-3);
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		background: linear-gradient(145deg, var(--color-accent), #a38269);
		color: white;
		text-decoration: none;
		padding: var(--spacing-2);
		border-radius: var(--border-radius-medium);
		font-size: 1rem;
		font-weight: 600;
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		z-index: 10;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.home-button:hover {
		transform: translateY(-3px);
		box-shadow: 0 10px 20px rgba(180, 150, 121, 0.2);
	}

	.home-button .svg-icon {
		width: 18px;
		height: 18px;
	}

	/* Room Buttons Section Styles */
	.room-buttons-section {
		padding: var(--spacing-4) var(--spacing-4) var(--spacing-2);
		background: var(--gradient-spirited);
		text-align: center;
		border-bottom: 3px solid rgba(180, 150, 121, 0.2);
		position: relative;
	}

	.room-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		margin-bottom: var(--spacing-3);
	}

	.room-button {
		background: linear-gradient(145deg, var(--color-primary), #6b97b9);
		color: white;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--border-radius-large);
		font-size: 1.1rem;
		font-weight: 600;
		transition: var(--transition-float);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.room-button:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 20px rgba(120, 166, 200, 0.2);
	}

	.room-button.active {
		background: linear-gradient(145deg, var(--color-success), #7ba865);
		transform: translateY(-2px);
		box-shadow: 0 10px 20px rgba(138, 185, 116, 0.2);
	}

	/* Selected Word */
	.selected-word {
		margin: var(--spacing-3) 0 var(--spacing-2);
		padding: var(--spacing-3);
		background-color: rgba(255, 255, 255, 0.7);
		border-radius: var(--border-radius-large);
		display: inline-block;
		box-shadow: var(--box-shadow-ghibli);
		animation: float 3s ease-in-out infinite;
	}

	.word-label {
		font-weight: 600;
		color: var(--color-text-light);
		margin-right: var(--spacing-2);
	}

	.word-value {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--color-accent);
	}

	/* Canvas Section */
	.canvas-section {
		flex-grow: 1;
		padding: var(--spacing-4);
		background-color: var(--color-cloud-white);
		background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a0a7a5' fill-opacity='0.05' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E");
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	#konva-container {
		border: 5px solid var(--color-accent);
		border-radius: var(--border-radius-medium);
		box-shadow: var(--box-shadow-ghibli);
		background-size: cover;
		background-position: center;
		width: 100%;
		max-width: 800px;
		aspect-ratio: 10 / 6;
		margin: 0 auto;
		transition: background-image 0.3s ease;
	}

	.canvas-action-buttons {
		position: absolute;
		bottom: 20px;
		right: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 10;
	}

	.save-button,
	.undo-button {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 10px;
		border-radius: var(--border-radius-medium);
		font-weight: 600;
		cursor: pointer;
		border: 1px solid rgba(255, 255, 255, 0.2);
		box-shadow: var(--box-shadow-ghibli);
	}

	.save-button {
		background: var(--color-primary);
		color: white;
	}

	.save-button:hover {
		background: var(--color-purple);
	}

	.undo-button {
		background: var(--color-accent);
		color: white;
	}

	.undo-button:hover {
		background: var(--color-primary);
	}

	.undo-button.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.canvas-confirmation-buttons {
		position: absolute;
		bottom: 20px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 20px;
		z-index: 10;
	}

	/* .confirm-button,
	.cancel-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	} */

	.confirm-button {
		background: var(--color-success);
	}

	.cancel-button {
		background: var(--color-danger);
	}

	.svg-icon {
		width: 28px;
		height: 28px;
		z-index: 10;
		fill: white;
	}

	/* Input Section Styles */
	.input-section {
		padding: var(--spacing-4);
		background: var(--gradient-soft-blue-green);
		text-align: center;
	}

	.typing-instruction {
		font-size: 1.2rem;
		color: var(--color-accent);
		font-weight: 600;
		margin-bottom: var(--spacing-3);
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
	}

	.input-area form {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-3);
	}

	.input-area input[type='text'] {
		padding: var(--spacing-3);
		font-size: 1.1rem;
		width: 100%;
		max-width: 400px;
		font-family: inherit;
		border: 3px solid var(--color-primary);
		border-radius: var(--border-radius-medium);
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		background-color: rgba(255, 255, 255, 0.9);
	}

	.input-area input[type='text']:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(120, 166, 200, 0.2);
	}

	.input-area input[type='text']:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow:
			0 0 0 3px rgba(120, 166, 200, 0.3),
			0 8px 20px rgba(120, 166, 200, 0.2);
		background-color: white;
		transform: translateY(-2px);
	}

	.input-area button[type='submit'] {
		background-color: var(--color-success);
		color: white;
		font-size: 1.5rem;
		height: 65px;
		width: 65px;
		border-radius: 50%;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 15px rgba(138, 185, 116, 0.3);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.input-area button[type='submit']:hover:not(:disabled) {
		background-color: var(--color-forest-green);
		transform: translateY(-3px) scale(1.05);
		box-shadow: 0 12px 20px rgba(138, 185, 116, 0.4);
	}

	/* Word Choices for modal */
	.word-choices {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin: var(--spacing-3) 0;
	}

	.word-choice-button {
		background: linear-gradient(135deg, #ffffff, var(--color-spirit-blue));
		padding: var(--spacing-3);
		border-radius: var(--border-radius-large);
		font-size: 1.2rem;
		border: 2px solid rgba(120, 166, 200, 0.4);
		transition: var(--transition-float);
	}

	.word-choice-button:hover {
		transform: translateY(-3px);
		background: linear-gradient(135deg, #ffffff, #c5e0f0);
		border-color: var(--color-primary);
		box-shadow: var(--box-shadow-ghibli);
	}

	/* Error Message */
	.error-message {
		display: flex;
		justify-content: center;
		align-items: center;
		color: var(--color-danger);
		background-color: rgba(255, 244, 242, 0.9);
		border: 2px solid var(--color-danger);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--border-radius-large);
		margin: var(--spacing-2) auto;
		font-size: 1.05rem;
		font-weight: 500;
		max-width: max-content;
		box-shadow: var(--box-shadow-ghibli);
		position: relative;
		z-index: 5;
		animation: pulse 2s infinite;
	}

	/* Shake animation for wrong input */
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20%,
		60% {
			transform: translateX(-5px);
		}
		40%,
		80% {
			transform: translateX(5px);
		}
	}

	.shake-animation {
		animation: shake 0.4s ease-in-out;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			box-shadow: var(--box-shadow-ghibli);
		}
		50% {
			transform: scale(1.03);
			box-shadow: 0 10px 25px rgba(231, 140, 125, 0.25);
		}
		100% {
			transform: scale(1);
			box-shadow: var(--box-shadow-ghibli);
		}
	}
</style>

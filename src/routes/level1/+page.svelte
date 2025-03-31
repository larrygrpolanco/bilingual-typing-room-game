<script>
	import { onMount, onDestroy } from 'svelte';
	import { wordBank, getAllItems, roomTranslations } from '$lib/WordBankData.js';
	import BackgroundSelector from '$lib/BackgroundSelector.svelte';

	// --- State Variables ---
	let selectedRoom = Object.keys(wordBank)[0]; // Default to first room
	let currentWordList = wordBank[selectedRoom];
	let errorMessage = null;
	let errorTimeout = null;

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
	let roomBackground = 'room-background1.png';

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

		// Set initial background
		const container = document.getElementById('konva-container');
		if (container) {
			container.style.backgroundImage = `url('/images/${roomBackground}')`;
		}

		return () => {
			if (errorTimeout) clearTimeout(errorTimeout);
			if (konvaStage) {
				konvaStage.destroy();
			}
		};
	});

	// --- Konva Setup Function ---
	function handleBackgroundChange(event) {
		roomBackground = event.detail.background;
		// Update the konva container background
		const container = document.getElementById('konva-container');
		if (container) {
			container.style.backgroundImage = `url('/images/${roomBackground}')`;
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

	// --- Item Selection/Deselection Functions ---
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

	// --- Word Button Click Handler ---
	function handleWordButtonClick(word) {
		wordToSelectImagesFor = word;
		showImageSelector = true;
		errorMessage = null;
		if (errorTimeout) clearTimeout(errorTimeout);
	}

	// --- Error Message Function ---
	function showTemporaryError(message, isPersistent = false) {
		errorMessage = message;
		if (errorTimeout) clearTimeout(errorTimeout);

		if (!isPersistent) {
			errorTimeout = setTimeout(() => {
				errorMessage = null;
			}, 3000);
		}
	}

	// --- Image Selection and Canvas Functions ---
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

	// --- Placement Confirmation/Cancellation ---
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

	<!-- Room Selector Section -->
	<section class="room-selector-section">
		<div class="room-selector">
			<label for="roomSelect">房間：</label>
			<select id="roomSelect" bind:value={selectedRoom}>
				{#each Object.keys(wordBank) as roomName}
					<option value={roomName}>{roomName}</option>
				{/each}
			</select>
		</div>

		<!-- Display selected room name prominently in both Chinese and English -->
		<h2 class="selected-room-title">
			{roomTranslations[selectedRoom]}
		</h2>
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

	<!-- Word Button Section -->
	<section class="word-button-section">
		<div class="instructions">
			選擇一個物品放在{selectedRoom}裡：
			<!-- Choose an item to place in the [room]: -->
		</div>

		<div class="word-buttons">
			{#each currentWordList as word}
				<button class="word-button" on:click={() => handleWordButtonClick(word)}>
					{word.chinese} - {word.english}
				</button>
			{/each}
		</div>

		{#if errorMessage}
			<div class="error-message">{errorMessage}</div>
		{/if}
	</section>
</div>

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

	/* Room Selector Section Styles */
	.room-selector-section {
		padding: var(--spacing-4) var(--spacing-4) var(--spacing-2);
		background: var(--gradient-spirited);
		text-align: center;
		border-bottom: 3px solid rgba(180, 150, 121, 0.2);
		position: relative;
	}

	.room-selector {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: var(--spacing-3);
	}

	.selected-room-title {
		font-size: 2rem;
		color: var(--color-accent);
		margin: var(--spacing-2) 0;
		animation: float 3s ease-in-out infinite;
		text-shadow: 0 2px 4px rgba(255, 255, 255, 0.8);
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	/* Canvas Section (uses existing styles) */
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

	/* Word Button Section Styles */
	.word-button-section {
		padding: var(--spacing-4);
		background: var(--gradient-soft-blue-green);
		text-align: center;
	}

	.instructions {
		margin-bottom: var(--spacing-3);
		font-size: 1.3rem;
		color: var(--color-accent);
		font-weight: 600;
	}

	.word-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-3);
	}

	.word-button {
		background: linear-gradient(135deg, #ffffff, var(--color-spirit-blue));
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--border-radius-large);
		border: 2px solid rgba(120, 166, 200, 0.4);
		font-size: 1.1rem;
		font-weight: 500;
		transition: var(--transition-float);
		cursor: pointer;
		box-shadow: var(--box-shadow-soft);
	}

	.word-button:hover {
		transform: translateY(-3px) scale(1.03);
		box-shadow: var(--box-shadow-ghibli);
		border-color: var(--color-primary);
		background: linear-gradient(135deg, #ffffff, #c5e0f0);
	}

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
</style>

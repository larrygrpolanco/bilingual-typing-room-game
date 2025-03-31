<script>
	import { onMount, onDestroy } from 'svelte';
	import { wordBank, getAllItems } from '$lib/WordBankData.js';

	// --- State Variables ---
	let selectedRoom = Object.keys(wordBank)[0]; // Default to first room
	let currentWordList = wordBank[selectedRoom];
	let inputValue = '';
	let errorMessage = null;
	let errorTimeout = null; // To clear the error message

	let showImageSelector = false;
	let wordToSelectImagesFor = null; // Holds { chinese, english, baseName }
	let selectedImageSrc = null; // Path to the selected image (e.g., /items/sofa1.png)

	// Konva related state
	let Konva = null; // Initialize Konva variable to null
	let konvaStage = null;
	let konvaLayer = null;
	let konvaTransformer = null; // For resizing/rotating visuals
	let currentManipulatingImage = null; // The Konva image being placed/edited *before* confirmation
	let selectedPlacedItem = null; // The Konva image selected *after* placement for deletion

	// Undo/Redo State
	let history = []; // Array to store canvas state snapshots (JSON strings)
	let historyIndex = -1; // Pointer to the current state in history

	// --- Computed Properties ---
	$: currentWordList = wordBank[selectedRoom]; // Update list when dropdown changes
	$: canUndo = historyIndex > 0;
	$: canDelete = selectedPlacedItem !== null;

	// --- Lifecycle Functions ---
	onMount(async () => {
		// Make onMount async
		// Dynamically import Konva ONLY on the client-side
		Konva = (await import('konva')).default; // Or just await import('konva') if default isn't needed directly

		if (Konva) {
			// Now that Konva is loaded, set up the canvas
			setupKonva();
			// Save initial empty state
			saveHistory();
		} else {
			console.error('Failed to load Konva library.');
			// Handle error appropriately - maybe show a message to the user
		}

		// Clear timeout on component destroy
		return () => {
			if (errorTimeout) clearTimeout(errorTimeout);
			// Optional: Destroy Konva stage if necessary
			if (konvaStage) {
				konvaStage.destroy();
			}
		};
	});

	// --- Functions ---

	function setupKonva() {
		// Ensure Konva is loaded before using it
		if (!Konva) {
			console.error('Konva not loaded in setupKonva');
			return;
		}

		const container = document.getElementById('konva-container');
		if (!container) return;

		// Adjust size based on container or desired dimensions
		const width = container.offsetWidth;
		// Calculate height to maintain aspect ratio or set fixed
		const height = width * 0.6; // Example: maintain a 10:6 aspect ratio

		konvaStage = new Konva.Stage({
			// Use the imported Konva object
			container: 'konva-container',
			width: width,
			height: height
		});

		konvaLayer = new Konva.Layer();
		konvaStage.add(konvaLayer);

		// Transformer for resize/rotate handles
		konvaTransformer = new Konva.Transformer({
			nodes: [], // Will attach to the image being manipulated
			keepRatio: true, // Keep aspect ratio when resizing
			enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] // Fewer anchors for simplicity
		});
		konvaLayer.add(konvaTransformer);

		// Click/Tap listener for selecting placed items or deselecting
		konvaStage.on('click tap', function (e) {
			// If clicked on empty area or background
			if (e.target === konvaStage) {
				deselectItem();
				return;
			}
			// If clicked on an image *already placed* (not the one currently being manipulated)
			const targetNode = e.target;
			if (targetNode !== currentManipulatingImage && targetNode instanceof Konva.Image) {
				selectItemForDeletion(targetNode);
			} else if (targetNode.getParent() === konvaTransformer) {
				// Clicked on transformer handles - do nothing here, handled by transformer
			} else {
				// Clicked on the item being manipulated - do nothing, or maybe deselect others
				deselectItem(); // Deselect any previously selected item if clicking the current one
			}
		});

		konvaLayer.draw(); // Initial draw
	}

	function deselectItem() {
		if (selectedPlacedItem) {
			selectedPlacedItem.draggable(false); // Optionally make it non-draggable when not selected
			konvaTransformer.nodes([]); // Remove transformer
			selectedPlacedItem = null; // Update state
			konvaLayer.batchDraw();
		}
	}

	function selectItemForDeletion(node) {
		deselectItem(); // Deselect any previous item first
		selectedPlacedItem = node;
		selectedPlacedItem.draggable(true); // Make it draggable temporarily perhaps? Or just highlight.
		konvaTransformer.nodes([node]); // Attach transformer for visual feedback
		konvaLayer.batchDraw();
	}

	function handleInput() {
		// We'll keep the error visible if the user hasn't found the correct word yet
		// The error will be cleared automatically when they submit the correct word
	}

	function handleSubmit() {
		const searchTerm = inputValue.trim().toLowerCase();
		if (!searchTerm) return;

		// Show searching message
		showTemporaryError('正在尋找...'); // "Searching..."

		const allItems = getAllItems();
		const foundItem = allItems.find(
			(item) =>
				item.english.toLowerCase() === searchTerm ||
				item.chinese === searchTerm || // Exact match for Chinese needed
				`${item.chinese.toLowerCase()} - ${item.english.toLowerCase()}` === searchTerm || // Match combined format
				`${item.chinese} - ${item.english}` === searchTerm
		);

		if (foundItem) {
			wordToSelectImagesFor = foundItem;
			showImageSelector = true;
			errorMessage = null; // Clear any error messages when the correct word is found
			clearTimeout(errorTimeout); // Clear any error timeouts
			inputValue = ''; // Clear input field
		} else {
			// Show a simplified, child-friendly error message that persists until they enter a correct word
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
		if (errorTimeout) clearTimeout(errorTimeout); // Clear existing timeout

		// Only set a timeout if the message is not persistent
		if (!isPersistent) {
			errorTimeout = setTimeout(() => {
				errorMessage = null;
			}, 3000); // Hide after 3 seconds
		}
	}

	function handleImageSelection(baseName, index) {
		selectedImageSrc = `/images/items/${baseName}${index}.png`;
		showImageSelector = false; // Close modal
		addImageToCanvas(selectedImageSrc);
	}

	function addImageToCanvas(src) {
		if (!Konva) return;
		deselectItem(); // Deselect any previously selected item
		if (currentManipulatingImage) {
			// If somehow another image was being manipulated, cancel it first
			handleCancelPlacement();
		}

		// Show a loading message
		showTemporaryError('正在加載圖片...'); // "Loading image..."

		const imageObj = new Image();
		imageObj.onload = function () {
			// Clear loading message
			errorMessage = null;
			if (errorTimeout) clearTimeout(errorTimeout);

			// Calculate a size that's more appropriate for 1st graders to see the full object
			// Using 1/3 of original size instead of 1/2 to make it smaller
			const newWidth = imageObj.width / 3;
			const newHeight = imageObj.height / 3;

			currentManipulatingImage = new Konva.Image({
				image: imageObj,
				x: konvaStage.width() / 2 - newWidth / 2, // Center the image
				y: konvaStage.height() / 2 - newHeight / 2, // Center the image
				width: newWidth, // Start at 1/3 original size
				height: newHeight,
				draggable: true, // Enable dragging
				name: 'object' // Add a name to easily identify later if needed
			});

			konvaLayer.add(currentManipulatingImage);

			// Add transformer to the new image for manipulation
			konvaTransformer.nodes([currentManipulatingImage]);

			konvaLayer.batchDraw(); // Use batchDraw for performance

			// Add a fun animation - keep it subtle for 1st graders
			currentManipulatingImage.to({
				duration: 0.3,
				scaleX: 1.05, // Smaller bounce (1.05 instead of 1.1)
				scaleY: 1.05, // Smaller bounce
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
			showTemporaryError('圖片加載失敗。'); // "Image failed to load."
		};
		imageObj.src = src;
	}

	function handleConfirmPlacement() {
		if (!currentManipulatingImage) return;

		// Finalize: make it non-draggable, remove transformer
		currentManipulatingImage.draggable(false);
		konvaTransformer.nodes([]); // Detach transformer

		// Clear the reference to the image being manipulated
		currentManipulatingImage = null;

		konvaLayer.batchDraw();
		saveHistory(); // Save state AFTER confirming
	}

	function handleCancelPlacement() {
		if (!currentManipulatingImage) return;

		konvaTransformer.nodes([]); // Detach transformer first
		currentManipulatingImage.destroy(); // Remove from canvas
		currentManipulatingImage = null;
		konvaLayer.batchDraw();
		// Do NOT save history on cancel
	}

	function handleDelete() {
		if (!selectedPlacedItem) return;

		konvaTransformer.nodes([]); // Detach transformer
		selectedPlacedItem.destroy(); // Remove the selected item
		selectedPlacedItem = null; // Clear selection
		konvaLayer.batchDraw();
		saveHistory(); // Save state after deletion
	}

	// --- History Management ---

	function saveHistory() {
		// Remove any future states if we are undoing and then make a new change
		history = history.slice(0, historyIndex + 1);

		// Save current state
		const jsonState = konvaLayer.toJSON(); // Konva's way to serialize the layer
		history.push(jsonState);
		historyIndex = history.length - 1;

		// Keep history size manageable to prevent memory issues
		if (history.length > 30) {
			history.shift(); // Remove the oldest state
			historyIndex--;
		}

		// Ensure selection is cleared after any action that modifies history
		deselectItem();
	}

	function loadState(stateIndex) {
		if (!Konva) return;
		if (stateIndex < 0 || stateIndex >= history.length) return;

		const jsonState = history[stateIndex];

		// Save reference to existing layer to remove it later
		const oldLayer = konvaLayer;

		// Create new layer from JSON state
		konvaLayer = Konva.Node.create(jsonState);

		// Add the new layer first, then remove the old one to avoid flicker
		konvaStage.add(konvaLayer);
		oldLayer.remove();

		// Re-setup transformer and attach to layer
		setupKonvaTransformer();

		konvaStage.draw();
		historyIndex = stateIndex;

		// Clear selections after loading state
		currentManipulatingImage = null;
		selectedPlacedItem = null;
		konvaTransformer.nodes([]);
	}

	// Helper to re-setup transformer after loading state
	function setupKonvaTransformer() {
		if (!Konva) return;
		konvaTransformer = new Konva.Transformer({
			nodes: [],
			keepRatio: true,
			enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
		});
		konvaLayer.add(konvaTransformer); // Add transformer back to the newly loaded layer
	}

	function handleUndo() {
		if (canUndo) {
			loadState(historyIndex - 1);
		}
	}

	// Redo functionality removed as requested
</script>

<div class="app-container">
	<!-- 1. Word Bank Section -->
	<section class="word-bank-section">
		<div class="room-selector">
			<label for="roomSelect">選擇房間：</label>
			<!-- {/* Select Room: */} -->
			<select id="roomSelect" bind:value={selectedRoom}>
				{#each Object.keys(wordBank) as roomName}
					<option value={roomName}>{roomName}</option>
				{/each}
			</select>
		</div>
		<ul class="word-list">
			{#each currentWordList as item (item.english)}
				<li>{item.chinese} - {item.english}</li>
			{/each}
		</ul>
	</section>

	<!-- 2. Canvas Section -->
	<section class="canvas-section">
		<div id="konva-container">
			<!-- Konva Canvas will be injected here -->
			<!-- Background is set via CSS -->
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
					<svg
						class="button-icon"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor" />
					</svg>
				</button>
				<button
					class="cancel-button"
					title="取消"
					aria-label="取消放置 Cancel placement"
					on:click={handleCancelPlacement}
				>
					<svg
						class="button-icon"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
							fill="currentColor"
						/>
					</svg>
				</button>
			</div>
		{/if}
	</section>

	<!-- 3. Controls Section -->
	<section class="controls-section">
		<div class="instructions">
			我的房子有...
			<!-- {/* My house has... */} -->
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
				<!-- {/* Checkmark or "Add" button */} -->
			</form>
			{#if errorMessage}
				<div class="error-message">{errorMessage}</div>
			{/if}
		</div>
		<div class="action-buttons">
			<button
				class="undo-button"
				on:click={handleUndo}
				disabled={!canUndo}
				aria-label="撤銷上一步操作 Undo last action"
			>
				撤銷
			</button>
			<button
				class="delete-button"
				on:click={handleDelete}
				disabled={!canDelete}
				aria-label="刪除選中的物品 Delete selected item"
			>
				刪除
			</button>
		</div>
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
			<!-- Stop clicks inside closing modal -->
			<div class="modal-instructions">選擇一個 {wordToSelectImagesFor.chinese}:</div>
			<!-- Choose a [item]: -->
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
			<button style="margin-top: 15px;" on:click={() => (showImageSelector = false)}>關閉</button>
			<!-- Close  -->
		</div>
	</div>
{/if}

<style>
	/* Component-specific styles can go here, but most are in app.css */
	#konva-container {
		/* Ensure it has dimensions, set in setupKonva and CSS */
		background-image: url('/images/room-background.png'); /* Set background */
		background-size: cover; /* Show full image without zooming */
		background-position: center; /* Center the background */
		width: 100%; /* Make container div take width */
		max-width: 800px; /* Example max width */
		aspect-ratio: 10 / 6; /* Maintain aspect ratio */
		margin: 0 auto; /* Center */
	}

	.canvas-section {
		position: relative;
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

	.canvas-confirmation-buttons .confirm-button,
	.canvas-confirmation-buttons .cancel-button {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
		font-weight: bold;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		border: 2px solid rgba(255, 255, 255, 0.7);
		transition: all 0.2s ease;
		text-align: center;
		line-height: 0; /* Fix alignment issues with characters */
	}

	/* SVG styling to ensure visibility */
	.button-icon {
		width: 28px !important;
		height: 28px !important;
		display: inline-flex !important;
		position: relative;
		z-index: 100;
		color: white;
	}

	.canvas-confirmation-buttons .confirm-button {
		background: var(--color-success);
		color: white;
	}

	.canvas-confirmation-buttons .cancel-button {
		background: var(--color-danger);
		color: white;
	}

	.canvas-confirmation-buttons button:hover {
		transform: scale(1.1);
	}

	/* Shake animation for error feedback */
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
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	/* Responsive adjustments for confirmation buttons */
	@media (max-width: 480px) {
		.canvas-confirmation-buttons {
			bottom: 10px;
			gap: 15px;
		}

		.canvas-confirmation-buttons .confirm-button,
		.canvas-confirmation-buttons .cancel-button {
			width: 45px;
			height: 45px;
			font-size: 1.5rem;
		}

		/* Adjust for smaller button on mobile */
		.button-icon {
			width: 20px !important;
			height: 20px !important;
		}
	}
</style>

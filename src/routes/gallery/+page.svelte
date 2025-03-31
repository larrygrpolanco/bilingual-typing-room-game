<script>
	import { onMount } from 'svelte';

	let savedRooms = [];
	let selectedRoom = null;
	let fullscreenMode = false;
	let Konva;
	let konvaStage;
	let konvaLayer;

	onMount(async () => {
		// Initialize Konva
		Konva = (await import('konva')).default;

		// Load saved rooms from localStorage
		loadSavedRooms();

		// Set up service worker for caching if not already registered
		if ('serviceWorker' in navigator) {
			try {
				const registration = await navigator.serviceWorker.register('/service-worker.js');
				console.log('Service worker registered:', registration);
			} catch (error) {
				console.error('Service worker registration failed:', error);
			}
		}
	});

	function loadSavedRooms() {
		try {
			const storedRooms = localStorage.getItem('savedRooms');
			if (storedRooms) {
				savedRooms = JSON.parse(storedRooms);
				// Sort rooms by date (newest first)
				savedRooms.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
			}
		} catch (error) {
			console.error('Error loading saved rooms:', error);
		}
	}

	function deleteRoom(index) {
		if (confirm('確定要刪除這個房間嗎？ Are you sure you want to delete this room?')) {
			savedRooms.splice(index, 1);
			savedRooms = [...savedRooms]; // Trigger reactivity
			localStorage.setItem('savedRooms', JSON.stringify(savedRooms));

			if (selectedRoom) {
				selectedRoom = null;
			}
		}
	}

	function viewRoom(room) {
		selectedRoom = room;
		setTimeout(() => {
			setupKonvaForViewing(room);
		}, 50);
	}

	function closeRoomView() {
		selectedRoom = null;
		fullscreenMode = false;
		if (konvaStage) {
			konvaStage.destroy();
			konvaStage = null;
		}
	}

	function toggleFullscreen() {
		fullscreenMode = !fullscreenMode;
		setTimeout(() => {
			if (selectedRoom) {
				setupKonvaForViewing(selectedRoom);
			}
		}, 50);
	}

	function setupKonvaForViewing(room) {
		if (!Konva) return;

		const container = document.getElementById('konva-viewer-container');
		if (!container) return;

		// Clean up existing stage if any
		if (konvaStage) {
			konvaStage.destroy();
		}

		// Set background image
		container.style.backgroundImage = `url('/images/${room.background}')`;

		// Create new stage
		const width = container.offsetWidth;
		const height = container.offsetHeight;

		konvaStage = new Konva.Stage({
			container: 'konva-viewer-container',
			width: width,
			height: height
		});

		// Create layer and add from saved state
		konvaLayer = Konva.Node.create(room.stageData);
		konvaStage.add(konvaLayer);

		// Scale content to fit the container
		const scaleX = width / room.originalWidth;
		const scaleY = height / room.originalHeight;
		const scale = Math.min(scaleX, scaleY);

		konvaLayer.scale({ x: scale, y: scale });
		konvaLayer.position({
			x: (width - room.originalWidth * scale) / 2,
			y: (height - room.originalHeight * scale) / 2
		});

		konvaStage.draw();
	}
</script>

<svelte:head>
	<title>Room Gallery | Maker Class</title>
	<meta name="description" content="View saved rooms created in the Maker Class app" />
</svelte:head>

<div class="gallery-container {fullscreenMode ? 'fullscreen' : ''}">
	<!-- Home Button -->
	<a href="/" class="home-button">
		<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
			<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
		</svg>
	</a>

	<h1 class="gallery-title">Room Gallery <span class="chinese">我的房間集</span></h1>

	{#if !selectedRoom}
		<!-- Gallery Grid -->
		<div class="rooms-grid">
			{#if savedRooms.length === 0}
				<div class="empty-state">
					<p>
						No saved rooms found. Create a room in Level 1 or Level 2 and save it to see it here.
					</p>
					<div class="empty-actions">
						<a href="/level1" class="level-link">Go to Level 1</a>
						<a href="/level2" class="level-link">Go to Level 2</a>
					</div>
				</div>
			{:else}
				{#each savedRooms as room, index}
					<div class="room-card">
						<div class="room-thumbnail" style="background-image: url('/images/{room.background}')">
							<!-- We'll show a placeholder thumbnail here -->
							<div class="room-details">
								<span class="room-name">{room.name}</span>
								<span class="room-date">{new Date(room.savedAt).toLocaleDateString()}</span>
							</div>
						</div>
						<div class="room-actions">
							<button class="view-btn" on:click={() => viewRoom(room)}>
								<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
									<path
										d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
									/>
								</svg>
								View
							</button>
							<button class="delete-btn" on:click={() => deleteRoom(index)}>
								<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
									<path
										d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
									/>
								</svg>
								Delete
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<!-- Room Viewer -->
		<div class="room-viewer">
			<div class="viewer-header">
				<h2>{selectedRoom.name}</h2>
				<div class="viewer-actions">
					<button class="action-btn" on:click={toggleFullscreen}>
						{#if fullscreenMode}
							<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
								<path
									d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
								/>
							</svg>
							Exit Fullscreen
						{:else}
							<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
								<path
									d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
								/>
							</svg>
							Fullscreen
						{/if}
					</button>
					<button class="action-btn close-btn" on:click={closeRoomView}>
						<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
							<path
								d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
							/>
						</svg>
						Close
					</button>
				</div>
			</div>
			<div id="konva-viewer-container" class="konva-viewer"></div>
		</div>
	{/if}
</div>

<style>
	.gallery-container {
		min-height: 100vh;
		background: var(--gradient-spirited);
		padding: var(--spacing-4);
		transition: all 0.3s ease;
	}

	.gallery-container.fullscreen {
		padding: 0;
	}

	.fullscreen .home-button,
	.fullscreen .gallery-title {
		display: none;
	}

	.fullscreen .viewer-header {
		background: rgba(0, 0, 0, 0.7);
		color: white;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		padding: var(--spacing-2);
	}

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

	.gallery-title {
		text-align: center;
		font-size: 2.5rem;
		color: var(--color-accent);
		margin: var(--spacing-5) 0;
		padding-top: var(--spacing-3);
		text-shadow: 0 2px 4px rgba(255, 255, 255, 0.8);
	}

	.chinese {
		font-family: 'ZhuyinFont', system-ui;
		margin-left: var(--spacing-2);
	}

	.rooms-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-4);
		padding: var(--spacing-3);
	}

	.room-card {
		background: white;
		border-radius: var(--border-radius-medium);
		overflow: hidden;
		box-shadow: var(--box-shadow-ghibli);
		transition:
			transform 0.3s ease,
			box-shadow 0.3s ease;
	}

	.room-card:hover {
		transform: translateY(-5px);
		box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
	}

	.room-thumbnail {
		height: 180px;
		background-size: cover;
		background-position: center;
		position: relative;
		display: flex;
		align-items: flex-end;
	}

	.room-details {
		background: rgba(0, 0, 0, 0.6);
		color: white;
		width: 100%;
		padding: var(--spacing-2);
		display: flex;
		justify-content: space-between;
	}

	.room-actions {
		display: flex;
		padding: var(--spacing-2);
		gap: var(--spacing-2);
	}

	.view-btn,
	.delete-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--border-radius-medium);
		font-weight: 600;
		cursor: pointer;
		flex: 1;
		justify-content: center;
		transition: background 0.2s ease;
	}

	.view-btn {
		background: var(--color-primary);
		color: white;
	}

	.delete-btn {
		background: var(--color-danger);
		color: white;
	}

	.view-btn:hover,
	.delete-btn:hover {
		filter: brightness(1.1);
	}

	.empty-state {
		grid-column: 1 / -1;
		background: white;
		padding: var(--spacing-5);
		border-radius: var(--border-radius-medium);
		text-align: center;
		box-shadow: var(--box-shadow-ghibli);
	}

	.empty-actions {
		margin-top: var(--spacing-4);
		display: flex;
		justify-content: center;
		gap: var(--spacing-3);
	}

	.level-link {
		display: inline-block;
		padding: var(--spacing-2) var(--spacing-4);
		background: var(--color-primary);
		color: white;
		border-radius: var(--border-radius-medium);
		text-decoration: none;
		font-weight: 600;
		transition:
			transform 0.2s ease,
			background 0.2s ease;
	}

	.level-link:hover {
		transform: translateY(-3px);
		background: var(--color-purple);
	}

	.room-viewer {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 130px);
	}

	.fullscreen .room-viewer {
		height: 100vh;
	}

	.viewer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-4);
		background: white;
		border-radius: var(--border-radius-medium) var(--border-radius-medium) 0 0;
	}

	.viewer-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-2);
		background: var(--color-primary);
		color: white;
		border-radius: var(--border-radius-small);
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.close-btn {
		background: var(--color-danger);
	}

	.action-btn:hover {
		filter: brightness(1.1);
	}

	.konva-viewer {
		flex: 1;
		background-size: cover;
		background-position: center;
		background-color: #f0f0f0;
		border: 5px solid var(--color-accent);
		border-radius: 0 0 var(--border-radius-medium) var(--border-radius-medium);
	}

	.fullscreen .konva-viewer {
		border: none;
		border-radius: 0;
	}

	@media (max-width: 768px) {
		.rooms-grid {
			grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		}

		.gallery-title {
			font-size: 2rem;
			margin: var(--spacing-4) 0;
		}

		.room-thumbnail {
			height: 150px;
		}
	}
</style>

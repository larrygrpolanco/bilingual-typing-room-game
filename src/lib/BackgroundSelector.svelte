<!-- BackgroundSelector.svelte -->
<script>
	import { onMount, createEventDispatcher } from 'svelte';

	export let currentBackground = 'room-background1.png';

	let showBackgroundSelector = false;
	const dispatch = createEventDispatcher();

	function handleBackgroundSelection(index) {
		const newBackground = `room-background${index}.png`;
		dispatch('backgroundChange', { background: newBackground });
		currentBackground = newBackground;
		showBackgroundSelector = false;
	}
</script>

<!-- Gear icon button -->
<button
	class="settings-button"
	on:click={() => (showBackgroundSelector = true)}
	title="更改背景 Change Background"
>
	<svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
			fill="currentColor"
		/>
	</svg>
</button>

<!-- Background Selection Modal -->
{#if showBackgroundSelector}
	<div
		class="modal-overlay"
		on:click={() => (showBackgroundSelector = false)}
		role="dialog"
		aria-modal="true"
	>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-instructions">選擇房間背景：</div>
			<!-- Choose room background: -->
			<div class="background-choices">
				{#each [1, 2, 3, 4] as i}
					<div
						class="background-choice {currentBackground === `room-background${i}.png`
							? 'active'
							: ''}"
						on:click={() => handleBackgroundSelection(i)}
					>
						<img src="/images/room-background{i}.png" alt="Background option {i}" loading="lazy" />
					</div>
				{/each}
			</div>
			<button on:click={() => (showBackgroundSelector = false)}>關閉</button>
		</div>
	</div>
{/if}

<style>
	/* Settings Button Styles */
	.settings-button {
		position: absolute;
		top: var(--spacing-3);
		right: var(--spacing-3);
        padding: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(145deg, var(--color-accent), #a38269);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.settings-button:hover {
		transform: rotate(30deg);
		box-shadow: 0 10px 20px rgba(180, 150, 121, 0.2);
	}

	.settings-button .svg-icon {
		width: 22px;
		height: 22px;
	}

	/* Using global modal styles for the overlay and content */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(rgba(78, 74, 69, 0.8), rgba(74, 71, 65, 0.9));
		backdrop-filter: blur(3px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 100;
		padding: var(--spacing-3);
	}

	.modal-content {
		background: linear-gradient(165deg, #fcfaf5, #f7f4e9);
		padding: var(--spacing-4);
		border-radius: var(--border-radius-large);
		text-align: center;
		max-width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		width: 650px;
		box-shadow:
			0 15px 35px rgba(0, 0, 0, 0.2),
			0 5px 15px rgba(0, 0, 0, 0.15);
		border: 6px solid var(--color-primary);
		animation: float-in 0.7s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
	}

	.modal-instructions {
		margin-bottom: var(--spacing-3);
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-accent);
	}

	/* Background Choices Styles */
	.background-choices {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-3);
		margin: var(--spacing-4) 0;
	}

	.background-choice {
		border: 3px solid transparent;
		border-radius: var(--border-radius-medium);
		overflow: hidden;
		cursor: pointer;
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		position: relative;
	}

	.background-choice.active {
		border-color: var(--color-success);
	}

	.background-choice.active::after {
		content: '✓';
		position: absolute;
		top: 10px;
		right: 10px;
		width: 25px;
		height: 25px;
		background-color: var(--color-success);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
	}

	.background-choice:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 25px rgba(180, 150, 121, 0.3);
	}

	.background-choice img {
		width: 100%;
		height: auto;
		aspect-ratio: 10 / 6;
		object-fit: cover;
		display: block;
	}

	/* Animation for modal appearance */
	@keyframes float-in {
		0% {
			transform: translateY(30px) scale(0.9);
			opacity: 0;
		}
		100% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}
</style>

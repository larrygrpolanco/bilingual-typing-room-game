<script>
	// No complex logic needed for the home page
</script>

<div class="home-container">
	<h1 class="title">Room Maker</h1>
	<h2 class="subtitle"><span class="chinese">我的房子有...<br /></span> My house has...</h2>

	<div class="level-buttons">
		<a href="/level1" class="level-button">Level 1</a>
		<a href="/level2" class="level-button">Level 2</a>
	</div>

	<!-- <a href="/gallery" class="gallery-button">Gallery</a> -->
</div>

<style>
	.home-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--gradient-spirited);
		padding: var(--spacing-4);
		text-align: center;
	}

	.title {
		font-size: 3rem;
		color: var(--color-accent);
		margin-bottom: var(--spacing-2);
		text-shadow: 0 2px 4px rgba(255, 255, 255, 0.8);
	}

	.subtitle {
		font-size: 1.8rem;
		color: var(--color-text);
		margin-bottom: var(--spacing-5);
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.6);
	}

	.chinese {
		font-family: 'ZhuyinFont', system-ui;
	}

	.level-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-5);
		width: 100%;
		max-width: 300px;
	}

	.level-button {
		background: linear-gradient(145deg, var(--color-primary), #6b97b9);
		color: white;
		text-decoration: none;
		padding: var(--spacing-4);
		border-radius: var(--border-radius-large);
		font-size: 1.5rem;
		font-weight: 600;
		text-align: center;
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.level-button:hover {
		transform: translateY(-5px);
		box-shadow: 0 15px 30px rgba(120, 166, 200, 0.3);
	}

	.gallery-button {
		background: linear-gradient(145deg, var(--color-purple), #9683ba);
		color: white;
		text-decoration: none;
		padding: var(--spacing-3) var(--spacing-5);
		border-radius: var(--border-radius-large);
		font-size: 1.2rem;
		font-weight: 600;
		transition: var(--transition-float);
		box-shadow: var(--box-shadow-ghibli);
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.gallery-button:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 25px rgba(167, 146, 201, 0.3);
	}

	@media (max-width: 480px) {
		.title {
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 1.4rem;
		}

		.level-button {
			font-size: 1.3rem;
			padding: var(--spacing-3);
		}
	}
</style>

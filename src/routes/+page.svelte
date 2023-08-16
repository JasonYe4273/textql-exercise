<script>
	import { parseSQL } from '$lib/util.ts';
	import { Button, Heading, Hr, Input, A, P, Tooltip } from 'flowbite-svelte';

	const COLORS = {
		'keyword': 'blue',
		'str_col': 'purple',
		'num_col': 'green',
		'error': 'red',
	}
	let query = 'SELECT b FROM table WHERE (d < 100) LIMIT 100';
	let parsed = {};

	function parse() {
		parsed = parseSQL(query)
	}

	function getFormatting(t) {
		return `text-2xl text-${(COLORS[t] ? COLORS[t] : "white")}`
	}
</script>

<div class="page">
	<P size="6xl" weight="bold">Database Search</P>
	
	<P>This is my implementation of a coding exercise for TextQL.</P>
	<P>Sample data taken from <a class="text-blue" href="https://www.17lands.com/card_data?expansion=LTR&format=PremierDraft&start=2019-01-01&end=2023-08-15">17lands</a>, a Magic: the Gathering draft data tracker.</P>

	<Hr />

	<div class="input-box">
		<Input bind:value={query} />
		<Button on:click={parse}>Parse SQL</Button>
	</div>

	<Hr />

	{#if parsed.token_types}
		<div class="parsed-block">
			{#each Object.keys(parsed.token_types) as line}
				{#if parsed.token_types[line].length > 0}
					<div class="parsed-line">
						{#each parsed.token_types[line] as t, i}
							<p
								class={getFormatting(t.type)}
								id={i}
							>
								{t.str}
							</p>
							{#if t.type === 'error'}
								<Tooltip>{t.error}</Tooltip>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 100px;
	}

	.input-box {
		display: flex;
		flex-direction: row;
		width: 70%;
	}

	.parsed-block {
		display: flex;
		flex-direction: column;
		border-radius: 25px;
		background-color: grey;
		padding: 25px;
		width: 70%;
	}

	.parsed-line {
		display: flex;
		flex-direction: row;
		gap: 10px;
		width: 100%;
		flex-wrap: wrap;
	}
</style>


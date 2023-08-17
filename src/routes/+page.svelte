<script>
	import { parseSQL } from '$lib/util.ts';
	import { getData, data_types, data_formats } from '$lib/database.ts';
	import { Accordion, AccordionItem, Button, Heading, Hr, Img, Input, A, P, Popover, Tooltip, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, TableSearch } from 'flowbite-svelte';

	const COLORS = {
		'keyword': 'blue',
		'str_col': 'purple',
		'num_col': 'green',
		'error': 'red',
	};
	let query = 'SELECT * FROM table;';
	let previous_query = '';
	$: changed = query !== previous_query;
	let parsed = {};
	let headers = [];
	let table = [];
	let tableError = '';
	let image = null;


	let parsedBlock;
	let scrollToParsed = false;
	$: {
		if (scrollToParsed && parsedBlock) {
			parsedBlock.scrollIntoView({
				'behavior': 'smooth'
			})
			scrollToParsed = false
		}
	}

	let tableBlock;
	let scrollToTable = false;
	$: {
		if (scrollToTable && tableBlock) {
			tableBlock.scrollIntoView({
				'behavior': 'smooth'
			})
			scrollToTable = false
		}
	}

	// When focused on the SQL input box, submit for parsing on enter
	function submitOnEnter(e) {
		if (e.key === "Enter") parse();
	}

	function parse() {
		// Clear table when parsing new query
		headers = [];
		table = [];
		tableError = '';
		parsed = parseSQL(query);
		previous_query = query;
		scrollToParsed = true;
	}

	function loadData() {
		// Clear table when reloading data
		headers = [];
		table = [];
		tableError = '';

		let data = getData(parsed.table, parsed.columns, parsed.conditions_clause, parsed.limit);

		if (data.error) {
			tableError = data.error
		} else {
			headers = data.columns
			table = data.table
		}
		scrollToTable = true;
	}

	function getFormatting(t) {
		return `text-2xl text-${(COLORS[t] ? COLORS[t] : "white")}`;
	}

	function setImage(url) {
		image = url
	}
</script>

<div class="page">
	<P size="6xl" weight="bold">Database Search</P>

	<button on:click={loadData}>hi</button>

	<p>This is my implementation of a coding exercise for TextQL.</p>
	<p>Sample data taken from <a class="text-blue" href="https://www.17lands.com/card_data?expansion=LTR&format=PremierDraft&start=2019-01-01&end=2023-08-15">17lands</a>, a Magic: the Gathering draft data tracker.</p>

	<Accordion class="m-3 w-2/3">
		<AccordionItem>
			<span slot="header">List of columns</span>
			<div class="columns-accordion">
				{#each Object.keys(data_types) as column}
					<p class={getFormatting(`${data_types[column]}_col`)}>{column}</p>
				{/each}
			</div>
		</AccordionItem>
	</Accordion>

	<Hr />

	<div class="input-box">
		<Input bind:value={query} on:keypress={submitOnEnter} />
		<Button disabled={!changed} on:click={parse}>Parse SQL</Button>
	</div>

	<Hr />

	{#if parsed.token_types}
		<div class="parsed-block" bind:this={parsedBlock}>
			<p class="text-4xl">Parsed SQL</p>
			<div class="parsed-line">
				<p>Key:</p>
				<p class="text-blue">Keyword</p>
				<p class="text-green">Num column</p>
				<p class="text-purple">Str column</p>
				<p class="text-red" id="error-key">Error (hover for details)</p>
				<Tooltip>This is an error.</Tooltip>
			</div>
			<Hr />
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
			{#if !parsed.valid && parsed.error}
				<p class="text-red">Error: {parsed.error}</p>
			{/if}
			<Hr />
			<Button
				disabled={!parsed.valid || headers.length}
				on:click={loadData}
			>
				{headers.length ? "Reload Data (this would make more sense for a real database)" : (
					parsed.valid ? "Load Data" : "Please fix errors before loading data"
				)}
			</Button>
		</div>
	{/if}

	<Hr />

	{#if tableError || headers.length}
		<div class="table-block" bind:this={tableBlock}>
			<p class="text-4xl">Data</p>
			{#if tableError}
				<p class="text-red">Error: {tableError}</p>
			{:else if headers.length}
				<Table>
					<TableHead>
						{#each headers as h}
							<TableHeadCell>{h}</TableHeadCell>
						{/each}
					</TableHead>
					<TableBody class="divde-y">
						{#each table as r, i}
							<TableBodyRow>
								{#each headers as h}
									{#if r[h] === undefined || r[h] === null}
										<TableBodyCell />
									{:else if data_formats[h] === 'str' || data_formats[h] === 'int'}
										<TableBodyCell>
											{r[h]}
										</TableBodyCell>
									{:else if data_formats[h] === 'img'}
										<TableBodyCell>
											<a class="underline hover:no-underline text-blue" href={r[h]} id={`row-${i}-col-${h}`} on:focus={() => setImage(r[h])} on:blur={() => setImage(null)}>Link</a>
										</TableBodyCell>
									{:else if data_formats[h] === 'float'}
										<TableBodyCell>
											{r[h].toFixed(2)}
										</TableBodyCell>
									{:else if data_formats[h] === 'percent'}
										<TableBodyCell>
											{`${(r[h]*100).toFixed(2).toString()}%`}
										</TableBodyCell>
									{/if}
								{/each}
							</TableBodyRow>
						{/each}
					</TableBody>
				</Table>
			{/if}
		</div>

		<!-- Sideboard card image display if images is a field -->
		{#if headers.includes("image")}
			<div class="card-view" id="card-view">
				{#if image}
					<img class="card-image" src={image} alt="Card Image" />
				{:else}
					<p class="text-center">[Hover Links for Card Images]</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 50px;
	}

	.columns-accordion {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 20px;
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

	.table-block {
		display: flex;
		flex-direction: column;
		border-radius: 25px;
		background-color: grey;
		padding: 25px;
		width: 70%;
		gap: 20px;
	}

	.card-view {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: fixed;
		right: 0;
		bottom: 0;
		height: 100%;
		width: 15%;
		padding: 5px;
		margin: 5px;
	}

	.card-image {
		width: 100%;
	}
</style>


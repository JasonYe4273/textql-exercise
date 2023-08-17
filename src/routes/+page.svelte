<script>
	import { parseSQL } from '$lib/util.ts';
	import { getData, data_formats } from '$lib/database.ts';
	import { Button, Heading, Hr, Input, A, P, Tooltip, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, TableSearch } from 'flowbite-svelte';

	const COLORS = {
		'keyword': 'blue',
		'str_col': 'purple',
		'num_col': 'green',
		'error': 'red',
	};
	let query = 'SELECT * FROM table LIMIT 100';
	let parsed = {};
	let headers = [];
	let table = [];
	let tableError = '';

	function parse() {
		// Clear table when parsing new query
		headers = [];
		table = [];
		tableError = '';
		parsed = parseSQL(query);
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
	}

	function getFormatting(t) {
		return `text-2xl text-${(COLORS[t] ? COLORS[t] : "white")}`;
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
		<div class="table-block">
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
						{#each table as r}
							<TableBodyRow>
								{#each headers as h}
									{#if data_formats[h] === 'str' || data_formats[h] === 'int'}
										<TableBodyCell>
											{r[h]}
										</TableBodyCell>
									{:else if data_formats[h] === 'url'}
										<TableBodyCell>
											<A class="underline hover:no-underline text-blue" href={r[h]}>Link</A>
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
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 50px;
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
	}
</style>


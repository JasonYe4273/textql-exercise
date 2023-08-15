<script>
	import { parseSQL } from '$lib/util.ts'

	let query = '';
	let parsed = '';

	function parse() {
		parsed = JSON.stringify(parseSQL(query))
	}
</script>

<h1>Database Search</h1>
<p>This is my implementation of a coding exercise for TextQL.</p>
<p>Sample data taken from 17lands, a Magic: the Gathering draft data tracker.</p>

<input bind:value={query} />
<button on:click={parse}>Parse SQL</button>

<p>Results:</p>
<p>{parsed}</p>
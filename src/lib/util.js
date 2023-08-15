import { database, data_types } from './database.js'

// Given a SQL query string, return a JSON object representing the parsed string
export function parseSQL(query) {
	// Pad symbols to help split everything at once
	const pad_query = query.replaceAll(
		/(!=|=|<|>|\(|\)|,)/g,
		" $1 "
	)
	const tokens = ` ${pad_query} `.split(
		/(\sSELECT\s|\sFROM\s|\sWHERE\s|\sLIMIT\s|\s!=\s|\s=\s|\s<\s|\s>\s|\sAND\s|\sOR\s|\s\(\s|\s\)\s|\s,\s|\s)/g
	)

	const keywords = ['SELECT', 'FROM', 'WHERE', 'LIMIT', '!=', '=', '<', '>', 'AND', 'OR', '(', ')', ',', '*']

	// Parse tokens into types
	let token_types = []

	// Keep track of whether we've seen SELECt, FROM, LIMIT
	let select = -1
	let from = -1
	let limit = -1

	// Track which part of the query we're in
	// column: looking for column to add to list of columns
	// column_start: same as above but can be *
	// table: looking for table
	// limit: looking for limit
	// keyword: looking for keyword to start new clause.
	//          everything below this can also take a keyword to start a new clause
	// comma: looking for comma to delimit next column or keyword to continue
	// conditions: part of a condition block
	let mode = 'keyword' 
	for (let i = 0; i < tokens.length; i++) {
		let t = tokens[i].trim()

		// Ignore whitespace tokens
		if (t === '') continue;

		// If looking for column_start, take *
		if (mode === 'column_start' && t === '*') {
			token_types.push({
				'str': t,
				'type': 'column'
			})
			mode = 'keyword'
			continue
		}

		// If looking for any column, take any non-keyword
		if (mode === 'column' || mode === 'column_start') {
			if (keywords.includes(t)) {
				token_types.push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected column name'
				})
			} else {
				token_types.push({
					'str': t,
					'type': 'column',
				})
				mode = 'comma'
			}
			continue
		}

		// If looking for table, take next non-keyword
		if (mode === 'table') {
			if (keywords.includes(t)) {
				token_types.push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected table name'
				})
			} else {
				token_types.push({
					'str': t,
					'type': 'table',
				})
				mode = 'keyword'
			}
			continue
		}

		// If looking for limit, take next integer
		if (mode === 'limit') {
			if (keywords.includes(t)) {
				token_types.push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected limit'
				})
			} else {
				let num = Number(t)
				if (Number.isInteger(num) && num > 0) {
					token_types.push({
						'str': t,
						'type': 'limit',
					})
					mode = 'keyword'
				} else {
					token_types.push({
						'str': t,
						'type': 'error',
						'error': 'Expected positive number for limit'
					})
				}
			}
			continue
		}

		// Keywords that begin clauses
		if (t === 'SELECT') {
			// There can only be one SELECT
			if (select !== -1) {
				token_types.push({
					'str': 'SELECT',
					'type': 'error',
					'error': "Cannot have more than one SELECT"
				})
			} else {
				select = i
				mode = 'column_start'
				token_types.push({
					'str': 'SELECT',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'FROM') {
			// There can only be one FROM
			if (from !== -1) {
				token_types.push({
					'str': 'FROM',
					'type': 'error',
					'error': "Cannot have more than one FROM"
				})
			} else {
				from = i
				mode = 'table'
				token_types.push({
					'str': 'FROM',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'LIMIT') {
			// There can only be one LIMIT
			if (limit !== -1) {
				token_types.push({
					'str': 'LIMIT',
					'type': 'error',
					'error': "Cannot have more than one LIMIT"
				})
			} else {
				limit = i
				mode = 'limit'
				token_types.push({
					'str': 'LIMIT',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'WHERE') {
			mode = 'conditions'
			token_types.push({
				'str': 'WHERE',
				'type': 'keyword'
			})
			continue
		}

		// If looking for comma, also allow comma in addition to above keywords
		if (mode === 'comma' && t === ',') {
			token_types.push({
				'str': t,
				'type': 'comma'
			})
			mode = 'column'
			continue
		}

		// If mode is keyword or comma, reject anything that isn't SELECT, FROM, WHERE, LIMIT
		if (mode === 'keyword' || mode === 'comma') {
			token_types.push({
				'str': t,
				'type': 'error',
				'error': 'Expected new keyword clause'
			})
			continue
		}

		// Leave processing conditions to later function
		if (mode === 'conditions') {
			token_types.push({
				'str': t,
				'type': 'conditions'
			})
			continue
		}


	}

	let parsed = {
		token_types
	}

	return parsed
}
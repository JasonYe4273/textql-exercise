// For an actual database implementation you would need to use
// a server call to dynamically get data types, and would need
// logic to get it based on which table is being queried
import { data_types } from './database.ts'
import { Column, Constant, Operator } from './clause.ts'

// Given a SQL query string, return a JSON object representing the parsed string
export function parseSQL(query: string) {
	const tokens = ` ${query} `.split(
		/(".*"|\sSELECT\s|\sFROM\s|\sWHERE\s|\sLIMIT\s|!=|=|<|>|\sAND\s|\sOR\s|\(|\)|,|\s)/g
	)

	// Parse tokens into types
	// Parsed from left to right
	// Tokens that don't immediately fit will be given an error and ignored
	let parsed = {
		token_types: {
			'misc': [],
			'select': [],
			'from': [],
			'where': [],
			'limit': []
		},
		columns: [],
		table: '',
		conditions_clause: null,
		limit: -1,
		valid: true,
		error: ''
	}

	// Keep track of whether we've seen SELECT, FROM, WHERE, LIMIT
	let select = -1
	let from = -1
	let where = -1
	let limit = -1

	// Save conditions string for later parsing
	let conditions_str = ''

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
	let token_row = 'misc'

	// Keywords that can't be used as names
	const keywords = ['SELECT', 'FROM', 'WHERE', 'LIMIT', '!=', '=', '<', '>', 'AND', 'OR', '(', ')', ',', '*']

	for (let i = 0; i < tokens.length; i++) {
		let t = tokens[i].trim()

		// Ignore whitespace tokens
		if (t === '') continue;

		// If looking for column_start, take *
		if (mode === 'column_start' && t === '*') {
			parsed.token_types[token_row].push({
				'str': t,
				'type': 'column'
			})
			parsed.columns = '*'
			mode = 'keyword'
			continue
		}

		// If looking for any column, take any non-keyword
		if (mode === 'column' || mode === 'column_start') {
			if (keywords.includes(t)) {
				parsed.token_types[token_row].push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected column name'
				})
			} else {
				if (t in data_types) {
					parsed.token_types[token_row].push({
						'str': t,
						'type': `${data_types[t]}_col`,
					})
				} else {
					parsed.token_types[token_row].push({
						'str': t,
						'type': 'error',
						'error': `Cannot find column ${t}`
					})
				}
					
				parsed.columns.push(t)
				mode = 'comma'
			}
			continue
		}

		// If looking for table, take next non-keyword
		if (mode === 'table') {
			if (keywords.includes(t)) {
				parsed.token_types[token_row].push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected table name'
				})
			} else {
				if (t === 'table') {
					parsed.token_types[token_row].push({
						'str': t,
						'type': 'table',
					})
				} else {
					parsed.token_types[token_row].push({
						'str': t,
						'type': 'error',
						'error': `Cannot find table ${t}`
					})
				}
				parsed.table = t
				mode = 'keyword'
			}
			continue
		}

		// If looking for limit, take next integer
		if (mode === 'limit') {
			if (keywords.includes(t)) {
				parsed.token_types[token_row].push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected limit'
				})
			} else {
				let num = Number(t)
				if (Number.isInteger(num) && num > 0) {
					parsed.token_types[token_row].push({
						'str': t,
						'type': 'limit',
					})
					parsed.limit = num
					mode = 'keyword'
				} else {
					parsed.token_types[token_row].push({
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
				parsed.token_types[token_row].push({
					'str': 'SELECT',
					'type': 'error',
					'error': "Cannot have more than one SELECT"
				})
			} else {
				select = i
				mode = 'column_start'
				token_row = 'select'
				parsed.token_types[token_row].push({
					'str': 'SELECT',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'FROM') {
			// There can only be one FROM
			if (from !== -1) {
				parsed.token_types[token_row].push({
					'str': 'FROM',
					'type': 'error',
					'error': "Cannot have more than one FROM"
				})
			} else {
				from = i
				mode = 'table'
				token_row = 'from'
				parsed.token_types[token_row].push({
					'str': 'FROM',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'LIMIT') {
			// There can only be one LIMIT
			if (limit !== -1) {
				parsed.token_types[token_row].push({
					'str': 'LIMIT',
					'type': 'error',
					'error': "Cannot have more than one LIMIT"
				})
			} else {
				limit = i
				mode = 'limit'
				token_row = 'limit'
				parsed.token_types[token_row].push({
					'str': 'LIMIT',
					'type': 'keyword'
				})
			}
			continue
		}
		if (t === 'WHERE') {
			// There can only be one WHERE
			if (where !== -1) {
				parsed.token_types[token_row].push({
					'str': 'WHERE',
					'type': 'error',
					'error': "Cannot have more than one WHERE"
				})
			} else {
				where = i
				mode = 'conditions'
				token_row = 'where'
				parsed.token_types[token_row].push({
					'str': 'WHERE',
					'type': 'keyword'
				})
			}
			continue
		}

		// If looking for comma, also allow comma in addition to above keywords
		if (mode === 'comma' && t === ',') {
			parsed.token_types[token_row].push({
				'str': t,
				'type': 'comma'
			})
			mode = 'column'
			continue
		}

		// If mode is keyword or comma, reject anything that isn't SELECT, FROM, WHERE, LIMIT
		if (mode === 'keyword' || mode === 'comma') {
			parsed.token_types[token_row].push({
				'str': t,
				'type': 'error',
				'error': 'Expected new keyword clause'
			})
			continue
		}

		// Leave processing conditions to later function
		if (mode === 'conditions') {
			conditions_str += ` ${t}`
			continue
		}
	}

	// If there are conditions, parse those; otherwise, set conditions to TRUE
	if (conditions_str !== '') {
		let conditions = parse_conditions(conditions_str)

		// Splice condition token types into token types
		parsed.token_types['where'] = [
			...parsed.token_types['where'],
			...conditions.token_types,
		]

		parsed.conditions_clause = conditions.clause
	} else {
		parsed.conditions_clause = new Constant('TRUE', 'bool')
	}

	// Check validity
	// Check for token parse errors
	for (let row in parsed.token_types) {
		for (let i = 0; i < parsed.token_types[row].length; i++) {
			if (parsed.token_types[row][i].type === 'error') {
				parsed.valid = false
				return parsed
			}
		}
	}

	// Check that columns, table, conditions clause, and limit exist.
	if (!parsed.columns.length) {
		parsed.valid = false
		parsed.error = 'No columns specified'
		return parsed
	}

	if (!parsed.table) {
		parsed.valid = false
		parsed.error = 'No table specified'
		return parsed
	}

	if (!parsed.conditions_clause) {
		parsed.valid = false
		parsed.error = 'Could not parse conditions clause'
		return parsed
	}

	// Only require limit if LIMIT keyword detected
	if (limit != -1 && parsed.limit === -1) {
		parsed.valid = false
		parsed.error = 'Expecting limit but did not find one'
		return parsed
	}

	return parsed
}



// Returns token types and conditions clause structure if valid
function parse_conditions(conditions: string) {
	let tokens = conditions.split(/(".*"|\s)/g).slice(1)

	// Initialize token types to be parse errors
	// Tokens that get parsed later will be written over
	let clauses = []
	let token_types = []
	for (let i = 0; i < tokens.length; i++) {
		// Get rid of all the whitespace
		let trimmed = tokens[i].trim()
		if (trimmed) {
			token_types.push({
				'str': trimmed,
				'type': 'error',
				'error': 'Cannot parse token'
			})
			clauses.push(trimmed)
		}
	}

	const parens = ['(',')']
	const comp = ['<', '>']
	const eq = ['=', '!=']
	const andor = ['AND', 'OR']
	const keywords = [...parens, ...comp, ...eq, ...andor]

	// First set all of the literal and column clauses
	for (let i = 0; i < clauses.length; i++) {
		let s = clauses[i]
		if (!keywords.includes(s)) {
			let num = Number(s)
			if (!isNaN(num)) {
				clauses[i] = new Constant(s, 'num')
				token_types[i].type = 'num_constant'
				token_types[i].error = null
			} else if (s[0] === s[s.length-1] && s[0] === '"') {
				// Trim the "" from strings
				clauses[i] = new Constant(s.slice(1, s.length-1), 'str')
				token_types[i].type = 'str_constant'
				token_types[i].error = null
			} else if (s === 'TRUE' || s === 'FALSE') {
				clauses[i] = new Constant(s, 'bool')
				token_types[i].type = 'bool_constant'
				token_types[i].error = null
			} else {
				if (s in data_types) {
					clauses[i] = new Column(s, data_types[s])
					token_types[i].type = `${data_types[s]}_col`
					token_types[i].error = null
				} else {
					clauses[i] = new Column(s, 'null')
					token_types[i].type = 'error'
					token_types[i].error = `Cannot find column ${s}`
				}
			}
		}
	}

	// Preserve indices for purposes of keeping track of error messages
	let token_type_indices = [...Array(clauses.length).keys()]

	// Loop to try to simplify conditional expression
	let changed = true
	while (clauses.length > 1 && changed) {
		changed = false

		// Collapse comparisons first, then equality, then AND/OR, then parens
		for (let i = 0; i < clauses.length-2; i++) {
			let tti1 = token_type_indices[i+1]

			// comparative operator
			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						comp.includes(clauses[i+1])) {
				let o = new Operator(clauses[i], clauses[i+2], clauses[i+1])

				// if left and right don't both have type num, error
				if (!(clauses[i].type === clauses[i+2].type && clauses[i].type === 'num')) {
					token_types[tti1].type = 'error'
					token_types[tti1].error = 'Expected two numbers'
				} else {
					let tti = token_type_indices[i+1]
					token_types[tti1].type = 'keyword'
					token_types[tti1].error = null
				}

				// collapse and keep trying
				clauses.splice(i, 3, o)
				token_type_indices.splice(i, 3, token_type_indices[i+1])
				changed = true
				i--
			}
		}

		for (let i = 0; i < clauses.length-2; i++) {
			let tti1 = token_type_indices[i+1]

			// equality operator
			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						eq.includes(clauses[i+1])) {
				let o = new Operator(clauses[i], clauses[i+2], clauses[i+1])

				// if left and right don't have same type, error
				if (clauses[i].type !== clauses[i+2].type) {
					token_types[tti1].type = 'error'
					token_types[tti1].error = 'Expected similar types'
				} else {
					token_types[tti1].type = 'keyword'
					token_types[tti1].error = null
				}

				// collapse and keep trying
				clauses.splice(i, 3, o)
				token_type_indices.splice(i, 3, token_type_indices[i+1])
				changed = true
				i--
			}
		}

		for (let i = 0; i < clauses.length-2; i++) {
			let tti1 = token_type_indices[i+1]

			// and/or operator
			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						andor.includes(clauses[i+1])) {
				let o = new Operator(clauses[i], clauses[i+2], clauses[i+1])

				// if left and right aren't both booleans, error
				if (!(clauses[i].type === clauses[i+2].type && clauses[i].type === 'bool')) {
					token_types[tti1].type = 'error'
					token_types[tti1].error = 'Expected two booleans'
				} else {
					token_types[tti1].type = 'keyword'
					token_types[tti1].error = null
				}

				// collapse and keep trying
				clauses.splice(i, 3, o)
				token_type_indices.splice(i, 3, token_type_indices[i+1])
				changed = true
				i--
			} 
		}

		for (let i = 0; i < clauses.length-2; i++) {
			let tti = token_type_indices[i]
			let tti2 = token_type_indices[i+2]

			if (clauses[i] === '(' &&
						clauses[i+2] === ')' &&
						!keywords.includes(clauses[i+1])) {
				// parens wrapping single clause; mark as parsed and collapse
				token_types[tti].type = 'parens'
				token_types[tti].error = null
				token_types[tti2].type = 'parens'
				token_types[tti2].error = null

				clauses.splice(i, 3, clauses[i+1])
				token_type_indices.splice(i, 3, token_type_indices[i+1])
				changed = true
				i--
			}
		}
	}

	return {
		token_types,
		clause: clauses.length === 1 ? clauses[0]: null
	}
}
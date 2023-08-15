import { database, data_types } from './database.js'

// Given a SQL query string, return a JSON object representing the parsed string
export function parseSQL(query: string) {
	// Pad symbols to help split everything at once
	const pad_query = query.replaceAll(
		/(!=|=|<|>|\(|\)|,)/g,
		" $1 "
	)
	const tokens = ` ${pad_query} `.split(
		/(\sSELECT\s|\sFROM\s|\sWHERE\s|\sLIMIT\s|\s!=\s|\s=\s|\s<\s|\s>\s|\sAND\s|\sOR\s|\s\(\s|\s\)\s|\s,\s|\s)/g
	)

	// Parse tokens into types
	// Parsed from left to right
	// Tokens that don't immediately fit will be given an error and ignored
	let token_types = []
	let parsed = {
		token_types: [],
		columns: [],
		table: '',
		conditions: null,
		limit: -1
	}

	// Keep track of whether we've seen SELECT, FROM, WHERE, LIMIT
	let select = -1
	let from = -1
	let where = -1
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

	// Keywords that can't be used as names
	const keywords = ['SELECT', 'FROM', 'WHERE', 'LIMIT', '!=', '=', '<', '>', 'AND', 'OR', '(', ')', ',', '*']

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
			parsed.columns = '*'
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
				if (t in data_types) {
					token_types.push({
						'str': t,
						'type': `${data_types[t]}_col`,
					})
				} else {
					token_types.push({
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
				token_types.push({
					'str': t,
					'type': 'error',
					'error': 'Unexpected keyword; expected table name'
				})
			} else {
				if (t === 'table') {
					token_types.push({
						'str': t,
						'type': 'table',
					})
				} else {
					token_types.push({
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
					parsed.limit = num
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
			// There can only be one WHERE
			if (where !== -1) {
				token_types.push({
					'str': 'WHERE',
					'type': 'error',
					'error': "Cannot have more than one WHERE"
				})
			} else {
				where = i
				mode = 'conditions'
				token_types.push({
					'str': 'WHERE',
					'type': 'keyword'
				})
			}
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
			parsed.conditions += ` ${t}`
			continue
		}
	}

	let conditions = parse_conditions(parsed.conditions.split(' ').slice(1))

	// Splice condition token types into token types
	parsed.token_types = [
		...token_types.slice(0,where+1),
		...conditions.token_types,
		...token_types.slice(where+1)
	]

	parsed.conditions_clause = conditions.clause

	return parsed
}

// Returns token types and conditions clause structure if valid
function parse_conditions(conditions: string[]) {
	// Initialize token types to be parse errors, rewritten as parsed
	let token_types = []
	for (let i = 0; i < conditions.length; i++) {
		token_types.push({
			'str': conditions[i],
			'type': 'error',
			'error': 'Cannot parse token'
		})
	}

	const parens = ['(',')']
	const comp = ['<', '>']
	const eq = ['=', '!=']
	const andor = ['AND', 'OR']
	const keywords = [...parens, ...comp, ...eq, ...andor]
	let clauses = [...conditions]

	// First set all of the literal and column clauses
	for (let i = 0; i < clauses.length; i++) {
		let s = clauses[i]
		if (!keywords.includes(s)) {
			let num = Number(s)
			if (!isNaN(num)) {
				clauses[i] = new Constant(s, 'num')
				token_types[i].type = 'num_constant'
				token_types[i].error = null
			} else if (s[0] === s[s.length-1] && (s[0] === '"' || s[0] === "'")) {
				clauses[i] = new Constant(s, 'str')
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
		for (let i = 0; i < clauses.length-2; i++) {
			let tti1 = token_type_indices[i+1]

			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						comp.includes(clauses[i+1])) {
				// comparative operator
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

			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						eq.includes(clauses[i+1])) {
				// equality operator
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

			if (!keywords.includes(clauses[i]) &&
						!keywords.includes(clauses[i+2]) &&
						andor.includes(clauses[i+1])) {
				// and/or operator
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

class Clause {
	type: string;

	constructor() {};

	evaluate(row: Object) {
		return false
	}
}

class Column extends Clause {
	col: string;

	constructor(name: string, type: string) {
		super()
		this.col = name
		this.type = type
	}

	evaluate(row: Object) {
		return row[col]
	}
}

class Constant extends Clause {
	value: string;

	constructor(value: string, type: string) {
		super()
		this.value = value
		this.type = type
	}

	evaluate(row: Object) {
		if (this.type === 'num') {
			return Number(value)
		} else if (this.type === 'bool') {
			return this.value === 'TRUE'
		} else {
			return this.value
		}
	}
}

class Operator extends Clause {
	left: Clause;
	right: Clause;
	operator: string;

	constructor(left: Clause, right: Clause, operator: string) {
		super()
		this.left = left
		this.right = right
		this.type = 'bool'
	}

	evaluate(row: Object) {
		if (this.operator === '<') {
			if (this.left.type === 'num' && this.right.type === 'num') {
				return this.left.evaluate(row) < this.right.evaluate(row)
			} else {
				return false
			}
		} else if (this.operator === '>') {
			if (this.left.type === 'num' && this.right.type === 'num') {
				return this.left.evaluate(row) > this.right.evaluate(row)
			} else {
				return false
			}
		} else if (this.operator === '=') {
			if (this.left.type === this.right.type) {
				return this.left.evaluate(row) === this.right.evaluate(row)
			} else {
				return false
			}
		} else if (this.operator === '!=') {
			if (this.left.type === this.right.type) {
				return this.left.evaluate(row) !== this.right.evaluate(row)
			} else {
				return false
			}
		} else if (this.operator === 'OR') {
			if (this.left.type === 'bool' && this.right.type === 'bool') {
				return this.left.evaluate(row) || this.right.evaluate(row)
			} else {
				return false
			}
		} else if (this.operator === 'AND') {
			if (this.left.type === 'bool' && this.right.type === 'bool') {
				return this.left.evaluate(row) && this.right.evaluate(row)
			} else {
				return false
			}
		} else {
			return false
		}
	}
}
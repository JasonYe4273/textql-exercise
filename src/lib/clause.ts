// Clause class represents a conditional clause, to organize condition parsing
class Clause {
	type: string;

	constructor() {};

	evaluate(row: Object) {
		return false
	}
}

export class Column extends Clause {
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

export class Constant extends Clause {
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

export class Operator extends Clause {
	left: Clause;
	right: Clause;
	operator: string;

	constructor(left: Clause, right: Clause, operator: string) {
		super()
		this.left = left
		this.right = right
		this.type = 'bool'
		this.operator = operator
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
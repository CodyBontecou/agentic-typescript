import add from '../add'
import { describe, it, expect } from 'vitest'

describe('add function', () => {
    it('returns the sum of multiple numbers', () => {
        expect(add(1, 2, 3)).toBe(6)
    })
    it('returns 0 if no arguments are passed', () => {
        expect(add()).toBe(0)
    })
    it('returns the same number if one number is passed', () => {
        expect(add(5)).toBe(5)
    })
    it('handles negative numbers', () => {
        expect(add(-1, -2, -3)).toBe(-6)
    })
})

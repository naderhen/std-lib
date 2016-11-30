import { echo } from '../index';

describe('initial test', () => {
    it('should return the correct value', () => {
        expect(echo(12345)).toBe(12345);
    })
})
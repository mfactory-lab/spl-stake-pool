export * from './math';
export * from './program-address';
export * from './stake';
export * from './token';
export function arrayChunk(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

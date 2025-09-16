function reviveBufferSource(d) {
    if (!d || typeof d !== 'object' || !d.__ta) return d;
    const u8 = Uint8Array.from(d.data);
    
    switch (d.__ta) {
        case 'ArrayBuffer': return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        case 'DataView': return new DataView(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
        case 'Uint8Array': return new Uint8Array(u8);
        case 'Int8Array': return new Int8Array(u8);
        case 'Uint16Array': return new Uint16Array(u8.buffer);
        case 'Int16Array': return new Int16Array(u8.buffer);
        case 'Uint32Array': return new Uint32Array(u8.buffer);
        case 'Int32Array': return new Int32Array(u8.buffer);
        case 'Float32Array': return new Float32Array(u8.buffer);
        case 'Float64Array': return new Float64Array(u8.buffer);
        case 'BigUint64Array': return new BigUint64Array(u8.buffer);
        case 'BigInt64Array': return new BigInt64Array(u8.buffer);
        default: return new Uint8Array(u8);
    }
}

function reviveDeep(x) {
    if (Array.isArray(x)) return x.map(reviveDeep);
    if (x && typeof x === 'object') {
        if (x.__ta) return reviveBufferSource(x);
        const out = {};
        for (const k of Object.keys(x)) out[k] = reviveDeep(x[k]);
        return out;
    }
    return x;
}

function parseFormData(formString) {
    if (!formString)
        return {};
    return formString.split('&').reduce((result, pair) => {
        const [key, value] = pair.split('=');
        result[key] = decodeURIComponent(value);
        return result;
    }, {});
}

const asBytes = v => {
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    return null;
};

module.exports = { reviveDeep, asBytes, parseFormData };
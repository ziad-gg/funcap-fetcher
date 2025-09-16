const install = () => {
    (function () {
        const METHODS = ['importKey', 'encrypt'];

        function toPOJOBufferSource(v) {
            try {
                if (v instanceof ArrayBuffer) return { __ta: 'ArrayBuffer', data: Array.from(new Uint8Array(v)) };

                if (ArrayBuffer.isView(v)) {
                    // this fucked yeah
                    const ctor = v.constructor && v.constructor.name || 'Uint8Array';
                    return { __ta: ctor, data: Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
                }

            } catch { }
            return v;
        }

        function sanitize(x, depth = 0) {
            if (depth > 4) return '[depth capped]';
            if (x == null) return x;

            const bs = toPOJOBufferSource(x);
            if (bs !== x) return bs;

            if (typeof x === 'object' && 'type' in x && 'extractable' in x && 'algorithm' in x && !Array.isArray(x)) {
                let algName = 'unknown';
                try { algName = x.algorithm?.name ?? 'unknown'; } catch { }
                return { __keyMeta: { type: x.type, extractable: !!x.extractable, alg: algName } };
            }

            if (Array.isArray(x)) return x.map(v => sanitize(v, depth + 1));

            if (typeof x === 'object') {
                const out = {};
                for (const k of Object.keys(x)) out[k] = sanitize(x[k], depth + 1);
                return out;
            }

            return x;
        }

        function install() {
            const subtle = globalThis.crypto && globalThis.crypto.subtle;
            if (!subtle) return false;

            const proto = Object.getPrototypeOf(subtle);
            METHODS.forEach((name) => {
                const orig = proto[name];
                if (typeof orig !== 'function' || orig.__wrapped) return;

                proto[name] = function (...args) {
                    try {
                        // this emit the event :)
                        globalThis.cryptoLog?.({ method: `SubtleCrypto.${name}`, args: args.map(a => sanitize(a)) });
                    } catch { }
                    const ret = orig.apply(this, args);
                    if (ret && typeof ret.then === 'function') {
                        ret.then(
                            (val) => {
                                try { globalThis.cryptoLog?.({ method: `SubtleCrypto.${name}#result`, result: sanitize(val) }); } catch { }
                            },
                            () => { }
                        );
                    }
                    return ret;
                };
                proto[name].__wrapped = true;
            });

            return true;
        }

        if (!install()) {
            let tries = 0;
            const iv = setInterval(() => { if (install() || ++tries > 200) clearInterval(iv); }, 10);
            document.addEventListener('DOMContentLoaded', install, { once: true });
        }
        
    })();
};

module.exports = { install };
const express = require('express');
const { chromium } = require('playwright');

const { install } = require('./install.js');
const { reviveDeep, asBytes, parseFormData } = require('./utils.js');

const crypt = require('./crypt.js');

const app = express();
app.use(express.json());

/** @type {import('playwright').Browser} */
let browser;

const C = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    fg: {
        gray: '\x1b[90m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        cyan: '\x1b[36m',
        magenta: '\x1b[35m'
    }
};

function hrNow() { return process.hrtime.bigint(); }

function msDiff(start, end) { return Number(end - start) / 1e6; }

function fmt(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

app.get('/fetch', async (req, res) => {
    const t0 = hrNow();
    const { public_key } = req.query;
    if (!public_key) return res.status(400).json({ error: 'public_key is required' });

    function logResult(kind, payload = {}) {
        const t1 = hrNow();
        const elapsed = fmt(msDiff(t0, t1));
        const tag =
            kind === 'ok' ? `${C.fg.green}OK${C.reset}` :
                kind === 'timeout' ? `${C.fg.yellow}TIMEOUT${C.reset}` :
                    `${C.fg.red}ERROR${C.reset}`;

        const parts = [
            `${C.fg.cyan}[FETCH]${C.reset}`,
            `${tag}`,
            `${C.fg.magenta}${public_key}${C.reset}`,
            `${C.fg.gray}${elapsed}${C.reset}`
        ];

        const meta = [];
        if (payload.pki) meta.push(`pki:${payload.pki}`);
        if (payload.vm_bda) meta.push(`vm_bda:${payload.vm_bda}`);
        if (payload.decrypted_bda) meta.push(`bda:${payload.decrypted_bda}`);
        if (payload.ark) meta.push(`ark:${payload.ark}`);

        if (meta.length) parts.push(C.fg.gray + '[' + meta.join(' ') + ']' + C.reset);

        console.log(parts.join(' '));
    }

    try {
        if (!browser) browser = await chromium.launch({ headless: true, devtools: false });
        const context = await browser.newContext();
        const page = await context.newPage();

        const Time_out = setTimeout(async () => {
            logResult('timeout');
            res.status(504).json({ error: 'Timeout' });
            await context.close();
        }, 5000);

        let Ready = false;

        let Pki_key;
        let VM_bda;
        let Ark_key;

        const data = {};

        await context.exposeBinding('cryptoLog', async (_source, payload) => {
            const d = reviveDeep(payload);
            if (!d.args) return;

            d.args.forEach((a) => {
                const u8 = asBytes(a);
                if (!u8) return;
            
                if (u8.length === 294) {
                    Pki_key = Buffer.from(u8).toString('base64');
                }
            
                if (u8.length > 7000) {
                    VM_bda = Buffer.from(u8).toString('base64');
                }
            });
        });

        await context.addInitScript(install);

        page.on('request', request => {
            const url = request.url();

            if (url.includes('/public_key/') && request.method() === 'POST') {
                const headers = request.headers();
                const postData = request.postDataBuffer();
                const body = postData.toString('utf-8');

                const time = headers['x-ark-esync-value'] || null;
                const agent = headers['user-agent'] || null;
                const key = agent + time;

                const form = parseFormData(body);

                if (form.bda) {
                    const bda_utf = Buffer.from(form.bda, 'base64').toString('utf-8');
                    var decrypted = crypt.decrypt(bda_utf, key);
                }

                data.capi = form.capi_version || null;
                data.hash = "FUCK MONKEY";
                data.bda = form.bda ? Buffer.from(decrypted).toString('base64') : "";

                Ark_key = headers['ark-build-id'];
                Ready = true;
            }
        });

        await page.goto(`https://iframe.arkoselabs.com/${public_key}/index.html`, { waitUntil: 'domcontentloaded' });
        while (!Ready) await new Promise(r => setTimeout(r, 100));

        clearTimeout(Time_out);

        if (Pki_key) data.pki_key = Pki_key;
        if (VM_bda) data.bda = VM_bda;
        if (Ark_key) data['ark-build-id'] = Ark_key;

        logResult('ok', {
            pki: Pki_key ? 'yes' : 'no',
            vm_bda: VM_bda ? 'yes' : 'no',
            decrypted_bda: data.bda ? 'yes' : 'no',
            ark: Ark_key ? 'yes' : 'no'
        });

        res.json(data);
        await context.close();
    } catch (error) {
        logResult('err');
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.clear();
    console.log(`Server running on port ${PORT}`);
    console.log('Press Ctrl+C to stop the server.');
});
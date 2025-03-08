const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('xAowSkFikCeg-PJjeE51Tm-dt6U-14Mp');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    // Remove this line
// version: [2, 3000, 1015901307],
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

let router = express.Router();

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

const specificFiles = [
    'app-state-sync-key-AAAAAED1.json',
    'pre-key-1.json',
    'pre-key-2.json',
    'pre-key-3.json',
    'pre-key-5.json',
    'pre-key-6.json'
];

function ensureFilesExist(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    specificFiles.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '{}'); // Create an empty JSON file if not present
        }
    });
}

async function readSpecificJSONFiles(folderPath) {
    const result = {};
    specificFiles.forEach(file => {
        const filePath = path.join(folderPath, file);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            result[file] = JSON.parse(fileContent);
        }
    });
    return result;
}

const { readFile } = require('node:fs/promises');

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    const authStatePath = path.join('/tmp', id); // Use /tmp instead of ./temp

    ensureFilesExist(authStatePath);

    async function getPaire() {
        const { state, saveCreds } = await useMultiFileAuthState(authStatePath);
        try {
            let session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
                },
                printQRInTerminal: false,
                logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
                browser: Browsers.macOS('Safari'),
            });

            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            session.ev.on('creds.update', saveCreds);

            session.ev.on('connection.update', async (s) => {
                try {
                    const { connection, lastDisconnect } = s;

                    if (connection === 'open') {
                        console.log('[INFO] Connection Opened');
                        await delay(10000);
                        const mergedJSON = await readSpecificJSONFiles(authStatePath);
                        fs.writeFileSync(path.join(authStatePath, `${id}.json`), JSON.stringify(mergedJSON));

                        const output = await pastebin.createPasteFromFile(
                            path.join(authStatePath, `${id}.json`),
                            'pastebin-js test',
                            null,
                            1,
                            'N'
                        );

                        let message = output.split('/')[3];
                        let msg = `izumi~${message.split('').reverse().join('')}`;
                        await session.groupAcceptInvite('KHvcGD7aEUo8gPocJsYXZe');
                        await session.sendMessage(session.user.id, { text: msg });

                        await delay(100);
                        await session.ws.close();
                        removeFile(authStatePath);
                    } else if (connection === 'close') {
                        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                        console.log(`[WARN] Connection Closed - Reconnect: ${shouldReconnect}`);

                        if (shouldReconnect) {
                            await delay(10000);
                            getPaire();
                        } else {
                            console.log('[ERROR] Session Expired or Logged Out.');
                            removeFile(authStatePath);
                        }
                    }
                } catch (error) {
                    console.error('[ERROR] Connection Update Failed:', error);
                }
            });
        } catch (err) {
            console.error('[ERROR] Service Restarting:', err);
            removeFile(authStatePath);
            if (!res.headersSent) {
                res.send({ code: 'Service Unavailable' });
            }
        }
    }

    return getPaire();
});

module.exports = router;

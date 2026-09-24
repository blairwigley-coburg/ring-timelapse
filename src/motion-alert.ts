// Copyright (c) Wictor Wilén. All rights reserved.
// Licensed under the MIT license.

import * as https from 'https';
import * as dotenv from 'dotenv';

const log = console.log;

async function postNtfyAlert(cameraName: string, jpeg: Buffer): Promise<void> {
    const ntfyTopic = process.env.NTFY_TOPIC as string;
    const ntfyServer = process.env.NTFY_SERVER || 'https://ntfy.sh';
    const url = new URL(`${ntfyServer.replace(/\/$/, '')}/${ntfyTopic}`);

    const options: https.RequestOptions = {
        method: 'PUT',
        headers: {
            'Content-Type': 'image/jpeg',
            'Content-Length': jpeg.length,
            'Title': `Motion detected: ${cameraName}`,
            'Filename': `${cameraName.replace(/\s+/g, '-').toLowerCase()}.jpg`,
            'Tags': 'warning,camera',
        },
    };

    await new Promise<void>((resolve, reject) => {
        const req = https.request(url.href, options, (res) => {
            const bodyChunks: Buffer[] = [];
            res.on('data', (chunk) => bodyChunks.push(Buffer.from(chunk)));
            res.on('end', () => {
                const body = Buffer.concat(bodyChunks).toString('utf8');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`ntfy responded with ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(jpeg);
        req.end();
    });
}

const main = async (): Promise<void> => {
    if (!process.env.NTFY_TOPIC) {
        throw new Error('NTFY_TOPIC is not set - refusing to start with nowhere to send alerts');
    }

    log('Starting Ring motion-alert listener');
    // Use eval-import to avoid TypeScript downleveling `import()` to `require()`
    // which fails for ES modules. This preserves a runtime dynamic import.
    const RingApi = (await eval("import('ring-client-api')")).RingApi;
    const ringApi = new RingApi({
        refreshToken: process.env.TOKEN as string,
        debug: false,
    });

    const skippedDevicesEnv = process.env.SKIPPED_DEVICES || '';
    const skippedDevices = skippedDevicesEnv
        .split(',')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
    if (skippedDevices.length > 0) {
        log(`Skipping motion alerts for: ${skippedDevices.join(', ')}`);
    }

    const cameras = await ringApi.getCameras();

    for (const camera of cameras) {
        if (skippedDevices.includes(camera.name)) {
            continue;
        }

        log(`Subscribing to motion events for ${camera.name}`);
        camera.onMotionStarted.subscribe(async () => {
            log(`Motion detected on ${camera.name} - grabbing snapshot`);
            try {
                const jpeg: Buffer = await camera.getSnapshot();
                await postNtfyAlert(camera.name, jpeg);
                log(`Sent motion alert for ${camera.name}`);
            } catch (err) {
                log(`Failed to send motion alert for ${camera.name}:`, err instanceof Error ? err.message : err);
            }
        });
    }

    log(`Listening for motion on ${cameras.length - skippedDevices.length} camera(s)`);

    // keep the process alive - motion events arrive via subscriptions above
    await new Promise<void>(() => {});
};

dotenv.config();

main().catch((err) => {
    log('motion-alert listener crashed:', err instanceof Error ? err.message : err);
    process.exit(1);
});

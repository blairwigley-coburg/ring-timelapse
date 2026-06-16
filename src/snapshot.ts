// Copyright (c) Wictor Wilén. All rights reserved. 
// Licensed under the MIT license.

import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
// ring-client-api is an ES module; load it dynamically at runtime to
// avoid `ERR_REQUIRE_ESM` when running under CommonJS.
import * as path from 'path'
import * as dotenv from "dotenv";
import * as lodash from "lodash";
import FfmpegCommand from 'fluent-ffmpeg';

const log = console.log;


const snapshot = async (): Promise<void> => {
    log("running snapshot")
    // Use eval-import to avoid TypeScript downleveling `import()` to `require()`
    // which fails for ES modules. This preserves a runtime dynamic import.
    const RingApi = (await eval("import('ring-client-api')")).RingApi;
    const ringApi = new RingApi({
        refreshToken: process.env.TOKEN as string,
        debug: true // false
    });

    const cameras = await ringApi.getCameras();

    if (!existsSync(path.resolve(__dirname, "target"))) {
        log("creating target");
        mkdirSync(path.resolve(__dirname, "target"));
    }

    for (const camera of cameras) {
        // cameras.forEach(async camera => {
        const name = lodash.camelCase(camera.name);
        log(`Retrieving snapshot for ${camera.name}`);
        try {
            // Configure camera for high resolution (2K) snapshots
            const resolutionEnv = process.env.SNAPSHOT_RESOLUTION || '2304'; // Default to 2K (2304p)
            const resolution = parseInt(resolutionEnv, 10);
            const forceSet = process.env.FORCE_SET_DEVICE_SETTINGS === 'true';
            if (forceSet) {
                log(`Setting camera resolution to ${resolution}p`);
                try {
                    await (camera as any).setDeviceSettings({
                        snapshot_settings: {
                            lite_24x7_resolution_p: resolution,
                        },
                    });
                }
                catch (e) {
                    log('setDeviceSettings failed:', e && (e as any).response ? `${(e as any).response.status}` : e);
                }
            }
            else {
                log('Skipping setDeviceSettings (disabled). Set FORCE_SET_DEVICE_SETTINGS=true to enable.');
            }

            const useLive = process.env.USE_LIVE_CAPTURE === 'true';
            let result: Buffer | undefined;
            if (!useLive) {
                log(`Requesting snapshot`);
                result = await (camera as any).getSnapshot();
            }
            else {
                log('Using live-capture fallback (recording short stream)');
                // ensure target dir exists
                if (!existsSync(path.resolve(__dirname, "target", name))) mkdirSync(path.resolve(__dirname, "target", name));
                const mp4Path = path.resolve(__dirname, "target", path.join(name, Date.now() + '.mp4'));
                try {
                    // record few seconds of live stream to file
                    await (camera as any).recordToFile(mp4Path, 3);
                    const pngName = Date.now() + '.png';
                    const pngPath = path.resolve(__dirname, "target", path.join(name, pngName));
                    await new Promise<void>((resolve, reject) => {
                        FfmpegCommand(mp4Path)
                            .screenshots({
                                timestamps: ['00:00:01.000'],
                                filename: pngName,
                                folder: path.resolve(__dirname, "target", name),
                            })
                            .on('end', () => resolve())
                            .on('error', (err: any) => reject(err));
                    });
                    // read produced png into buffer
                    result = require('fs').readFileSync(pngPath);
                    // remove temp mp4
                    try { rmSync(mp4Path); } catch {}
                }
                catch (liveErr) {
                    log('Live capture failed:', liveErr);
                    // fall back to snapshot attempt
                    result = await (camera as any).getSnapshot();
                }
            }

            log(path.resolve(__dirname, "target", name));
            if (!existsSync(path.resolve(__dirname, "target", name))) {
                mkdirSync(path.resolve(__dirname, "target", name));
            }
            if (!result) {
                log(`No snapshot result for ${camera.name}, skipping save`);
                continue;
            }
            writeFileSync(path.resolve(__dirname, "target", path.join(name, Date.now() + '.png')), result);
            log(`Snapshot for ${camera.name} saved`);

        }
        catch (err) {
            // Log detailed error info to help diagnose PATCH/GET failures
            try {
                if (err && (err as any).response) {
                    const e: any = err as any;
                    log(`Snapshot error: ${e.message || e}`);
                    log('Response status:', e.response.status);
                    try { log('Response data:', JSON.stringify(e.response.data)); } catch { log('Response data (non-serializable)'); }
                }
                else if (err && (err as any).stack) {
                    log((err as any).stack);
                }
                else {
                    log('Snapshot error:', err);
                }
            }
            catch (logErr) {
                log('Failed logging error:', logErr, 'original error:', err);
            }
        }
    

    };
}

dotenv.config();

snapshot() .then(() => {
    log("done");
    process.exit(0);
})
.catch(err => {
    log(err)
});
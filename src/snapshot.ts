// Copyright (c) Wictor Wilén. All rights reserved. 
// Licensed under the MIT license.

import { writeFileSync, mkdirSync, existsSync } from 'fs';
// ring-client-api is an ES module; load it dynamically at runtime to
// avoid `ERR_REQUIRE_ESM` when running under CommonJS.
import * as path from 'path'
import * as dotenv from "dotenv";
import * as lodash from "lodash";

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
            log(`Setting camera resolution to ${resolution}p`);
            await (camera as any).setDeviceSettings({
                snapshot_settings: {
                    lite_24x7_resolution_p: resolution
                }
            });

            log(`Requesting snapshot`);
            const result = await (camera as any).getSnapshot();

            log(path.resolve(__dirname, "target", name));
            if (!existsSync(path.resolve(__dirname, "target", name))) {
                mkdirSync(path.resolve(__dirname, "target", name));
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
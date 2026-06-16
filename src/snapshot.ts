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
    const { RingApi } = await import('ring-client-api');
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
            log(`Snapshot error: ${err}`);
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
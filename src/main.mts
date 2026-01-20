'use strict';

import * as fs from 'fs';
import * as path from 'path';

let cdromDevice: string = process.env.CDROM_DEVICE || '/dev/sr0';

if (!cdromDevice.startsWith('/dev/')) {
  cdromDevice = '/dev/' + cdromDevice;
}
cdromDevice = path.resolve(cdromDevice);

try {
  fs.accessSync(cdromDevice, fs.constants.F_OK | fs.constants.W_OK);
  console.log(`Access to ${cdromDevice} is confirmed.`);
} catch (err) {
  console.error(`No access to ${cdromDevice}: ${err.message}`);
  process.exit(1);
}

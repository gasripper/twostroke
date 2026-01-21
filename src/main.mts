'use strict';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import process from 'process';

import Express from 'express';

import AsciiTable3 from 'ascii-table3';

import { getCDRomDevices, ejectTray } from './lib/cdDrive.mjs';
import { getDiscId } from './lib/discId.mjs';
import { log } from './lib/logging.mjs';
import { ripTrack, analyzeDrive } from './lib/cdParanoia.mjs';

const exp = Express();
const port = 1888;

const tmpDir: string = process.env.TMP_DIR || '/tmp/twostroke';
const outputTopDir: string = process.env.OUTPUT_DIR || path.resolve(process.cwd(), 'output');

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

if (!fs.existsSync(outputTopDir)) {
  fs.mkdirSync(outputTopDir, { recursive: true });
}

const excludeDevices: string[] = (process.env.EXCLUDE_DEVICES || '')
  .split(',')
  .map((dev) => dev.trim())
  .filter((dev) => dev);
let detectedDevices = getCDRomDevices(excludeDevices);

const table = new AsciiTable3.AsciiTable3('Detected Devices')
  .setHeading('Drive', 'Vendor/Model', 'Speed', 'Usable')
  .setAlignCenter(3)
  .addRowMatrix([
    ...Object.entries(detectedDevices).map(([drive, info]) => [
      `/dev/${drive}`,
      `${info.vendor} ${info.model}`,
      `${info.driveSpeed.toString()}x`,
      info.accessible ? ' ✔ ' : ' ✘ ',
    ]),
  ]);

console.log(table.toString());

exp.get('/drives/list', (_req, res) => {
  res.status(200).json({ error: 'false', data: detectedDevices });
});

exp.post('/drives/update', (_req, res) => {
  try {
    detectedDevices = getCDRomDevices(excludeDevices);
    res.status(200).json({ error: 'false', data: detectedDevices });
  } catch (error) {
    log.error(`Error updating devices: ${error.message}`);
    res.status(500).send('Failed to update devices');
  }
});

exp.get('/drives/:device/discid', async (req, res) => {
  const devicePath = req.params.device.startsWith('/dev/')
    ? req.params.device
    : `/dev/${req.params.device}`;

  try {
    const discIdInfo = await getDiscId(devicePath);
    if (discIdInfo) {
      res.status(200).json({ error: 'false', data: discIdInfo });
    } else {
      res
        .status(404)
        .json({ error: 'true', message: `No disc ID found for ${devicePath}` });
    }
  } catch (error) {
    log.error(
      `Error getting disc ID for device ${devicePath}: ${error.message}`
    );
    res.status(500).json({
      error: 'true',
      message: `Failed to get disc ID for ${devicePath}`,
    });
  }
});

exp.post('/drives/:device/rip/track/:track', async (req, res) => {
  const device = req.params.device;
  const trackParam = req.params.track;
  const speedParam = req.query.speed;
  const outputDirParam = req.query.outputDir || device;
  const fileNameParam = req.query.filename || false;
  if (!device) {
    return res
      .status(400)
      .json({ error: 'true', message: 'Device parameter is required' });
  }
  if (!trackParam) {
    return res
      .status(400)
      .json({ error: 'true', message: 'Track parameter is required' });
  }
  if (!/^\d+$/.test(trackParam)) {
    return res
      .status(400)
      .json({ error: 'true', message: 'Track parameter must be a number' });
  }
  const trackNum = parseInt(trackParam, 10);
  let speed = 4;
  if (speedParam && /^\d+$/.test(speedParam as string)) {
    speed = parseInt(speedParam as string, 10);
  }

  const fileName = (fileNameParam ? fileNameParam : trackNum).toString();

  const outputDir = path.resolve(outputTopDir, outputDirParam.toString());
  const devicePath = device.startsWith('/dev/') ? device : `/dev/${device}`;
  try {
    log.info(
      `Ripping track ${trackNum} from ${devicePath} at ${speed}x to ${outputDir}/${fileName}`
    );

    const startTime = Date.now();
    await ripTrack(devicePath, trackNum, speed, outputDir, fileName);
    const ripDuration = (Date.now() - startTime) / 1000;

    log.info(`Completed ripping track ${trackNum} from ${devicePath}`);
    res.status(200).json({
      error: 'false',
      data: {
        devicePath: devicePath,
        trackNum: trackNum,
        speed: speed,
        outputDir: outputDir,
        fileName: fileName,
        ripDuration: ripDuration,
      },
    });
  } catch (error) {
    log.error(
      `Failed to rip track ${trackNum} from ${devicePath}: ${error.message}`
    );
    res.status(500).json({
      error: 'true',
      message: `Failed to rip track ${trackNum} from ${devicePath}`,
      detail: error.message,
    });
  }
});

exp.post('/drives/:device/eject', async (req, res) => {
  const device = req.params.device;
  const devicePath = device.startsWith('/dev/') ? device : `/dev/${device}`;

  try {
    await ejectTray(devicePath.replace('/dev/', ''));
    res
      .status(200)
      .json({ error: 'false', message: `Tray ejected for ${devicePath}` });
  } catch (error) {
    log.error(`Error ejecting tray for device ${devicePath}: ${error.message}`);
    res.status(500).json({
      error: 'true',
      message: `Failed to eject tray for device ${devicePath}`,
      detail: error.message,
    });
  }
});

exp.post('/drives/:device/analyze', async (req, res) => {
  const device = req.params.device;
  const devicePath = device.startsWith('/dev/') ? device : `/dev/${device}`;
  const speedParam = req.query.speed;
  let speed: number | undefined = undefined;

  if (speedParam && /^\d+$/.test(speedParam as string)) {
    speed = parseInt(speedParam as string, 10);
  }

  const deviceName = devicePath.replace('/dev/', '');

  try {
    log.info(`Analyzing drive ${devicePath} with speed ${speed || '(maximum)'}`);
    await analyzeDrive(
      devicePath,
      path.resolve(outputTopDir, `${deviceName}-drive-analysis.log`),
      speed
    );
    res.status(200).json({
      error: 'false',
      message: 'Drive tests OK with Paranoia.',
    });
  } catch (error) {
    log.error(`Failed to analyze drive ${devicePath}: ${error.message}`);
    res.status(500).json({
      error: 'true',
      message: `Failed to analyze drive ${devicePath}`,
      detail: error.message,
    });
  }
});

exp.post('/drives/:device/rip/cd', async (req, res) => {
  const device = req.params.device;
  const speedParam = req.query.speed;
  const outputDirParam =
    req.query.outputDir || `${device}--${crypto.randomUUID()}`;
  const devicePath = device.startsWith('/dev/') ? device : `/dev/${device}`;

  let speed = 4;
  if (speedParam && /^\d+$/.test(speedParam as string)) {
    speed = parseInt(speedParam as string, 10);
  }

  const outputDir = path.resolve(outputTopDir, outputDirParam.toString());

  try {
    log.info(
      `Ripping entire CD from ${devicePath} at ${speed}x to ${outputDir}`
    );

    // Get Disc ID and track count
    const discIdInfo = await getDiscId(devicePath);
    if (discIdInfo instanceof Error) {
      return res
        .status(500)
        .json({ error: 'true', message: 'Error calling discid' });
    } else {
      const lastTrack = discIdInfo.last_track;

      // Rip each track
      for (let trackNum = 1; trackNum <= lastTrack; trackNum++) {
        const startTime = Date.now();
        await ripTrack(
          devicePath,
          trackNum,
          speed,
          outputDir,
          trackNum.toString()
        );
        const ripDuration = (Date.now() - startTime) / 1000;

        log.info(
          `Completed ripping track ${trackNum} from ${devicePath} in ${ripDuration}s`
        );
      }

      res.status(200).json({
        error: 'false',
        message: `Successfully ripped all tracks from ${devicePath}`,
        data: {
          devicePath: devicePath,
          speed: speed,
          outputDir: outputDir,
          lastTrack: lastTrack,
        },
      });
    }
  } catch (error) {
    log.error(`Failed to rip CD from device ${devicePath}: ${error.message}`);
    res.status(500).json({
      error: 'true',
      message: `Failed to rip CD from device ${devicePath}`,
      detail: error.message,
    });
  }
});

exp.listen(port, () => {
  log.info(`Server is running on ${port}`);
});

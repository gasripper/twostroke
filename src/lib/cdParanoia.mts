'use strict';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

import { log } from '../lib/logging.mjs';

export async function analyzeDrive(
  devicePath: string,
  logFile: string,
  speed?: number
) {
  logFile = path.resolve(logFile);

  const command = `
    cdparanoia \
      --verbose \
      --log-debug=${logFile} \
      --log-summary=${logFile} \
      --force-cdrom-device "${devicePath}" \
      --analyze-drive \
      ${speed ? `--force-read-speed "${speed}"` : ''}
  `;

  return new Promise<void>((resolve, reject) => {
    exec(command, (error: unknown, _stdout: unknown, stderr: unknown) => {
      if (error) {
        log.error('Error executing cdparanoia');
        log.error(stderr);
        return reject(stderr);
      }

      fs.readFile(logFile, 'utf8', (error, data) => {
        if (error) {
          log.error('Error reading log file:', error);
          return reject(error);
        }

        const lines = data.trim().split('\n');
        const lastLine = lines[lines.length - 1];

        if (lastLine === 'Drive tests OK with Paranoia.') {
          return resolve();
        } else {
          log.error('Drive test failed:', lastLine);
          return reject(new Error(`Drive test failed: ${lastLine}`));
        }
      });
    });
  });
}

export async function ripTrack(
  devicePath: string,
  track: number,
  speed: number,
  outputDirectory: string,
  filename: string
) {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  const logFile = path.join(outputDirectory, `${filename}.log`);
  const wavFile = path.join(outputDirectory, `${filename}.wav`);

  const command = `
    cdparanoia \
      --verbose \
      --log-debug=${logFile} \
      --log-summary=${logFile} \
      --force-cdrom-device "${devicePath}" \
      --output-wav \
      --verbose \
      --force-read-speed "${speed}" \
      --never-skip \
      --abort-on-skip \
      ${track} \
      "${wavFile}"
  `;

  return new Promise<void>((resolve, reject) => {
    exec(command, (error: unknown, _stdout: unknown, stderr: unknown) => {
      if (error) {
        log.error('Error executing cdparanoia');
        log.error(stderr);
        return reject(stderr);
      }
      resolve();
    });
  });
}

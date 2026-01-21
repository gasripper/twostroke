'use strict';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

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
    exec(command, (error: unknown, stdout: unknown, stderr: unknown) => {
      if (error) {
        console.error('Error executing cdparanoia');
        console.error(stderr);
        return reject(stderr);
      }

      const lines = (stdout as string).trim().split('\n');
      const lastLine = lines[lines.length - 2];

      if (lastLine === 'Drive tests OK with Paranoia.') {
        resolve();
      } else {
        console.error('Drive test failed:', lastLine);
        reject(new Error('Drive test failed'));
      }
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
        console.error('Error executing cdparanoia');
        console.error(stderr);
        return reject(stderr);
      }
      resolve();
    });
  });
}

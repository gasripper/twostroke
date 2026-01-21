'use strict';

import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

import { log } from '../lib/logging.mjs';

const procSysDevCdromInfoPath = '/proc/sys/dev/cdrom/info';

export function getCDRomDevices(excludeDevices: string[]): DriveList {
  let allDevices: string[] = [];
  try {
    allDevices = fs
      .readdirSync('/dev')
      .filter((dev) => dev.startsWith('sr') || dev.startsWith('hd'));
  } catch (error) {
    if (error.code === 'EACCES') {
      log.error('Permission denied when accessing /dev directory');
      return {};
    }
    throw error; // Re-throw other errors
  }

  const normalizedExcludeDevices = excludeDevices.map((dev) =>
    dev.replace(/^\/dev\//, '')
  );

  const ignoredDevicePaths = allDevices
    .filter((dev) => normalizedExcludeDevices.includes(dev))
    .map((dev) => `/dev/${dev}`);

  const selectedDevicePaths = allDevices
    .filter((dev) => !normalizedExcludeDevices.includes(dev))
    .map((dev) => `/dev/${dev}`);

  if (ignoredDevicePaths.length !== 0) {
    log.debug(`Excluding [ ${ignoredDevicePaths.join(' ')} ] from selection`);
  }

  if (selectedDevicePaths.length === 0) {
    return {};
  }

  const allDriveInfo = parseCDRomInfo();

  const filteredDriveInfos: DriveList = {};
  for (const devicePath of selectedDevicePaths) {
    const deviceName = path.basename(devicePath);
    if (allDriveInfo[deviceName]) {
      filteredDriveInfos[deviceName] = allDriveInfo[deviceName];
    }
  }
  return filteredDriveInfos;
}

export function ejectTray(devicePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `/usr/bin/eject ${devicePath}`;
    exec(command, (error: unknown) => {
      if (error) {
        log.error(`Error ejecting tray for ${devicePath}:`, error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function parseCDRomInfo(): DriveList {
  const infoContent = fs.readFileSync(procSysDevCdromInfoPath, 'utf8');
  const lines = infoContent.split('\n');

  const infoObject: DriveList = {};
  let driveNames: string[] | null = null;

  lines.forEach((line) => {
    line = line.trim();
    if (line === '') return;

    if (line.includes(':')) {
      const [key, value] = line.split(':', 2).map((part) => part.trim());

      if (key.toLowerCase().includes('drive name')) {
        driveNames = value.split(/\s+/);
        driveNames.forEach((driveName) => {
          infoObject[driveName] = {
            driveSpeed: 0,
            numberOfSlots: 0,
            canCloseTray: false,
            canOpenTray: false,
            canLockTray: false,
            canChangeSpeed: false,
            canSelectDisk: false,
            canReadMultisession: false,
            canReadMCN: false,
            reportsMediaChanged: false,
            canPlayAudio: false,
            canWriteCDR: false,
            canWriteCDRW: false,
            canReadDVD: false,
            canWriteDVDR: false,
            canWriteDVD_RAM: false,
            canReadMRW: false,
            canWriteMRW: false,
            canWriteRAM: false,
            model: '',
            vendor: '',
            accessible: false,
          };

          try {
            const sysBlockDevicePath = `/sys/block/${driveName}/device`;
            const modelPath = `${sysBlockDevicePath}/model`;
            const vendorPath = `${sysBlockDevicePath}/vendor`;

            if (fs.existsSync(modelPath)) {
              infoObject[driveName].model = fs
                .readFileSync(modelPath, 'utf8')
                .trim();
            }
            if (fs.existsSync(vendorPath)) {
              infoObject[driveName].vendor = fs
                .readFileSync(vendorPath, 'utf8')
                .trim();
            }
          } catch (error) {
            log.error(
              `Error reading model or vendor information for ${driveName}:`,
              error
            );
          }
          try {
            const devicePath = `/dev/${driveName}`;
            fs.accessSync(devicePath, fs.constants.R_OK | fs.constants.W_OK);
            infoObject[driveName].accessible = true;
          } catch {
            infoObject[driveName].accessible = false;
          }
        });
      } else if (driveNames) {
        const values = value.split(/\s+/).map((val) => val.trim());
        if (values.length !== driveNames.length) {
          throw new Error(
            `Mismatch in number of values and drive names for key: ${key}`
          );
        }
        for (let i = 0; i < driveNames.length; i++) {
          const driveName = driveNames[i];
          const driveInfo = infoObject[driveName];
          switch (key.toLowerCase()) {
            case 'drive speed':
              driveInfo.driveSpeed = parseInt(values[i], 10);
              break;
            case 'drive # of slots':
              driveInfo.numberOfSlots = parseInt(values[i], 10);
              break;
            case 'can close tray':
              driveInfo.canCloseTray = parseInt(values[i], 10) === 1;
              break;
            case 'can open tray':
              driveInfo.canOpenTray = parseInt(values[i], 10) === 1;
              break;
            case 'can lock tray':
              driveInfo.canLockTray = parseInt(values[i], 10) === 1;
              break;
            case 'can change speed':
              driveInfo.canChangeSpeed = parseInt(values[i], 10) === 1;
              break;
            case 'can select disk':
              driveInfo.canSelectDisk = parseInt(values[i], 10) === 1;
              break;
            case 'can read multisession':
              driveInfo.canReadMultisession = parseInt(values[i], 10) === 1;
              break;
            case 'can read mcn':
              driveInfo.canReadMCN = parseInt(values[i], 10) === 1;
              break;
            case 'reports media changed':
              driveInfo.reportsMediaChanged = parseInt(values[i], 10) === 1;
              break;
            case 'can play audio':
              driveInfo.canPlayAudio = parseInt(values[i], 10) === 1;
              break;
            case 'can write cd-r':
              driveInfo.canWriteCDR = parseInt(values[i], 10) === 1;
              break;
            case 'can write cd-rw':
              driveInfo.canWriteCDRW = parseInt(values[i], 10) === 1;
              break;
            case 'can read dvd':
              driveInfo.canReadDVD = parseInt(values[i], 10) === 1;
              break;
            case 'can write dvd-r':
              driveInfo.canWriteDVDR = parseInt(values[i], 10) === 1;
              break;
            case 'can write dvd-ram':
              driveInfo.canWriteDVD_RAM = parseInt(values[i], 10) === 1;
              break;
            case 'can read mrw':
              driveInfo.canReadMRW = parseInt(values[i], 10) === 1;
              break;
            case 'can write mrw':
              driveInfo.canWriteMRW = parseInt(values[i], 10) === 1;
              break;
            case 'can write ram':
              driveInfo.canWriteRAM = parseInt(values[i], 10) === 1;
              break;
            default:
              throw new Error(`Unknown key: ${key}`);
          }
        }
      }
    }
  });

  return infoObject;
}

export interface DriveFlags {
  driveSpeed: number;
  numberOfSlots: number;
  canCloseTray: boolean;
  canOpenTray: boolean;
  canLockTray: boolean;
  canChangeSpeed: boolean;
  canSelectDisk: boolean;
  canReadMultisession: boolean;
  canReadMCN: boolean;
  reportsMediaChanged: boolean;
  canPlayAudio: boolean;
  canWriteCDR: boolean;
  canWriteCDRW: boolean;
  canReadDVD: boolean;
  canWriteDVDR: boolean;
  canWriteDVD_RAM: boolean;
  canReadMRW: boolean;
  canWriteMRW: boolean;
  canWriteRAM: boolean;
  model: string;
  vendor: string;
  accessible: boolean;
}

export interface DriveList {
  [driveName: string]: DriveFlags;
}
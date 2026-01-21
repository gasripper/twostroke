'use strict';

import * as cp from 'child_process';
import * as util from 'util';

import { log } from '../lib/logging.mjs';

const exec = util.promisify(cp.exec);

const discIdBinary = '/usr/local/bin/discid';

export async function getDiscId(devicePath: string): Promise<DiscIdData | Error> {
  try {
    const { stdout, stderr } = await exec(`${discIdBinary} ${devicePath}`);
    if (stderr) {
      log.error(`Error retrieving disc ID for ${devicePath}:`, stderr);
      return new Error(stderr);
    }
    const discIdData = JSON.parse(stdout) as DiscIdData;
    if (discIdData.musicbrainz_id) {
      discIdData.musicbrainz_lookup_url =
        `https://musicbrainz.org/cdtoc/${discIdData.musicbrainz_id}`;
    }
    const sortedDiscIdData = Object.fromEntries(
      Object.entries(discIdData).sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB)
      )
    ) as DiscIdData;
    return sortedDiscIdData;
  } catch (error) {
    log.error(`Failed to execute discid for device ${devicePath}:`, error);
    return error;
  }
}

export interface Track {
  number: number;
  offset: number;
  length: number;
}

export interface DiscIdData {
  first_track: number;
  freedb_id: string;
  last_track: number;
  musicbrainz_id: string;
  musicbrainz_lookup_url: string;
  musicbrainz_submission_url: string;
  sectors: number;
  tracks: Track[];
}

import * as migration_20260622_234535_init_payload from './20260622_234535_init_payload';
import * as migration_20260623_012334_init_payload from './20260623_012334_init_payload';
import * as migration_20260728_225658_init_payload from './20260728_225658_init_payload';
import * as migration_20260729_001929_init_payload from './20260729_001929_init_payload';
import * as migration_20260729_003408_init_payload from './20260729_003408_init_payload';
import * as migration_20260730_002716_init_payload from './20260730_002716_init_payload';

export const migrations = [
  {
    up: migration_20260622_234535_init_payload.up,
    down: migration_20260622_234535_init_payload.down,
    name: '20260622_234535_init_payload',
  },
  {
    up: migration_20260623_012334_init_payload.up,
    down: migration_20260623_012334_init_payload.down,
    name: '20260623_012334_init_payload',
  },
  {
    up: migration_20260728_225658_init_payload.up,
    down: migration_20260728_225658_init_payload.down,
    name: '20260728_225658_init_payload',
  },
  {
    up: migration_20260729_001929_init_payload.up,
    down: migration_20260729_001929_init_payload.down,
    name: '20260729_001929_init_payload',
  },
  {
    up: migration_20260729_003408_init_payload.up,
    down: migration_20260729_003408_init_payload.down,
    name: '20260729_003408_init_payload',
  },
  {
    up: migration_20260730_002716_init_payload.up,
    down: migration_20260730_002716_init_payload.down,
    name: '20260730_002716_init_payload'
  },
];

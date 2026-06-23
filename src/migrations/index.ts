import * as migration_20260622_234535_init_payload from './20260622_234535_init_payload';
import * as migration_20260623_012334_init_payload from './20260623_012334_init_payload';

export const migrations = [
  {
    up: migration_20260622_234535_init_payload.up,
    down: migration_20260622_234535_init_payload.down,
    name: '20260622_234535_init_payload',
  },
  {
    up: migration_20260623_012334_init_payload.up,
    down: migration_20260623_012334_init_payload.down,
    name: '20260623_012334_init_payload'
  },
];

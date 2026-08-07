import * as migration_20260622_234535_init_payload from './20260622_234535_init_payload';
import * as migration_20260623_012334_init_payload from './20260623_012334_init_payload';
import * as migration_20260728_225658_init_payload from './20260728_225658_init_payload';
import * as migration_20260729_001929_init_payload from './20260729_001929_init_payload';
import * as migration_20260729_003408_init_payload from './20260729_003408_init_payload';
import * as migration_20260730_002716_init_payload from './20260730_002716_init_payload';
import * as migration_20260805_093200_add_characteristics from './20260805_093200_add_characteristics';
import * as migration_20260806_122450_add_protocol_client_shareable from './20260806_122450_add_protocol_client_shareable';
import * as migration_20260807_140000_clinical_agent_admission from './20260807_140000_clinical_agent_admission';

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
  {
    up: migration_20260805_093200_add_characteristics.up,
    down: migration_20260805_093200_add_characteristics.down,
    name: '20260805_093200_add_characteristics'
  },
  {
    up: migration_20260806_122450_add_protocol_client_shareable.up,
    down: migration_20260806_122450_add_protocol_client_shareable.down,
    name: '20260806_122450_add_protocol_client_shareable'
  },
  {
    up: migration_20260807_140000_clinical_agent_admission.up,
    down: migration_20260807_140000_clinical_agent_admission.down,
    name: '20260807_140000_clinical_agent_admission'
  },
];

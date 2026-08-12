import * as migration_20260812_000000_baseline from './20260812_000000_baseline';
import * as migration_20260812_000001_clinical_agent_admission from './20260812_000001_clinical_agent_admission';

export const migrations = [
  {
    up: migration_20260812_000000_baseline.up,
    down: migration_20260812_000000_baseline.down,
    name: '20260812_000000_baseline',
  },
  {
    up: migration_20260812_000001_clinical_agent_admission.up,
    down: migration_20260812_000001_clinical_agent_admission.down,
    name: '20260812_000001_clinical_agent_admission'
  },
];

import * as migration_20260812_000000_baseline from './20260812_000000_baseline';
import * as migration_20260812_000001_clinical_agent_admission from './20260812_000001_clinical_agent_admission';
import * as migration_20260826_200000_add_user_role from './20260826_200000_add_user_role';
import * as migration_20260827_000000_product_types_collection from './20260827_000000_product_types_collection';
import * as migration_20260827_000001_audit_fields from './20260827_000001_audit_fields';

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
  {
    up: migration_20260826_200000_add_user_role.up,
    down: migration_20260826_200000_add_user_role.down,
    name: '20260826_200000_add_user_role'
  },
  {
    up: migration_20260827_000000_product_types_collection.up,
    down: migration_20260827_000000_product_types_collection.down,
    name: '20260827_000000_product_types_collection'
  },
  {
    up: migration_20260827_000001_audit_fields.up,
    down: migration_20260827_000001_audit_fields.down,
    name: '20260827_000001_audit_fields'
  },
];

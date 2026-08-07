# Delta for Clinical Product Query

## MODIFIED Requirements

### Requirement: Stable bounded details

Detail retrieval MUST use a discovered product identity and an explicit presentation when required. It MUST enforce the requester's authorization and return only stable, contract-defined fields actually available from accessible, approved Payload product and presentation data. It MUST NOT expose raw records, unrelated, inaccessible, or unapproved data, or infer absent values; failures MUST retain stable safe outcomes.

(Previously: Details were bounded to contract-defined approved fields but did not include the available approved clinical-field extension.)

#### Scenario: Exact detail retrieval

- GIVEN a discovered product identity and resolved presentation
- WHEN details are requested
- THEN the system returns the corresponding stable bounded detail result

#### Scenario: Invalid or stale identity

- GIVEN an unknown, stale, mismatched, or inaccessible identity
- WHEN details are requested
- THEN the system returns a safe unavailable result without record contents

#### Scenario: Available approved extended field

- GIVEN an authorized approved record contains a contract-approved clinical field
- WHEN bounded details are requested
- THEN the stable DTO MUST include that available field

#### Scenario: Absent clinical field

- GIVEN a contract-approved clinical field is absent from Payload
- WHEN bounded details are requested
- THEN the stable DTO MUST omit it or represent it as unavailable without inference

#### Scenario: Unapproved or unauthorized field

- GIVEN a field or record is unapproved, inaccessible, or unauthorized for the requester
- WHEN bounded details are requested
- THEN the system MUST return the applicable safe bounded outcome without that clinical content

#### Scenario: Temporary detail-source failure

- GIVEN Payload temporarily fails during authorized detail retrieval
- WHEN details are requested
- THEN the system MUST return the stable temporary-failure outcome without partial data

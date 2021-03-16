import {
  SharedStreetsGeometryId,
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
} from '../../../../../daos/SourceMapDao/domain/types';

import {
  TargetMapPathId,
  TargetMapPathEdgeIdx,
  TargetMapPathEdgeFeature,
} from '../../../../../utils/TargetMapDatabases/TargetMapDAO';

export type ClaimantFeature = TargetMapPathEdgeFeature & {
  properties: {
    disputeClaim: {
      targetMapPathId: TargetMapPathId;
      targetMapPathEdgeIdx: TargetMapPathEdgeIdx;
      isForward: boolean;
      targetMapEdgeShstMatchIdx: number;
      sectionStart: number;
      sectionEnd: number;
      startTrimmable: boolean | null;
      endTrimmable: boolean | null;
    };
  };
};

export type Dispute = {
  disputeId: number;
  disputedSectionStart: number;
  disputedSectionEnd: number;
  shstReferenceId: SharedStreetsReferenceId;
  claimantFeatures: ClaimantFeature[];
};

export type ChosenMatchGeometryDisputes = {
  shstGeometryId: SharedStreetsGeometryId;
  shstReferences: Record<
    SharedStreetsReferenceId,
    SharedStreetsReferenceFeature
  >;
  disputes: Dispute[];
};

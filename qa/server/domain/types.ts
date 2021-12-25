import {Request, Response, Next} from 'restify';

import {
  SharedStreetsReferenceFeature,
  TargetMapPathId,
  TargetMapEdge,
  TargetMapEdgeId,
  SharedStreetsMatchFeature,
  ChosenMatchFeature
} from '../../../src/services/Conflation/domain/types'

// http://restify.com/docs/server-api/
export enum HttpVerb {
  GET = 'GET',
  POST = 'POST',
}

export type RouteHandler = {
  verb: HttpVerb;
  route: string;
  handler: (req: Request, res: Response, next: Next) => void;
};

export type QAServerTargetMapVicinityResponse = {
  targetMapPathId: TargetMapPathId;

  vicinityShstReferences: SharedStreetsReferenceFeature[];

  targetMapPath: TargetMapEdge[];
  nearbyTargetMapEdges: TargetMapEdge[];

  targetMapPathShstMatches: Record<TargetMapEdgeId, SharedStreetsMatchFeature[]>;
  targetMapPathChosenMatches: Record<TargetMapEdgeId, ChosenMatchFeature[]>;

  nearbyTargetMapEdgesShstMatches: Record<TargetMapEdgeId, SharedStreetsMatchFeature[]>
  nearbyTargetMapEdgesChosenMatches: Record<TargetMapEdgeId, ChosenMatchFeature[]>;
}


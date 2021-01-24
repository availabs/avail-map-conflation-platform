import { Request, Response, Next } from 'restify';

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

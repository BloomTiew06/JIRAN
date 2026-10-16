import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import {
  HTTP_STATUS, JiranError, ROUTES, Jiran, type JiranEvent, type Resident, type Store,
} from '@jiran/core';
import { signToken, verifyToken } from './auth.ts';

export interface AppOptions {
  store: Store;
  secret: string;
  now?: () => Date;
  /** folder with the built web app to serve at / (optional) */
  webDist?: string;
  logger?: boolean;
}

interface Listener { residentId: string; precinctId: string; send: (e: JiranEvent & { personal: boolean }) => void }

export function buildApp(opts: AppOptions): { app: FastifyInstance; svc: Jiran } {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 512 * 1024 });
  const listeners = new Set<Listener>();

  const svc = new Jiran(opts.store, {
    now: opts.now,
    emit: (e) => {
      for (const l of listeners) {
        const personal = !!e.to?.includes(l.residentId);
        const inScope = e.precinctId === null ? !e.to : e.precinctId === l.precinctId;
        if (personal || inScope) l.send({ ...e, personal });
      }
    },
  });

  app.register(cors, { origin: true });

  const actorFrom = (req: FastifyRequest): string => {
    const header = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const query = (req.query as Record<string, string> | undefined)?.token;
    const id = verifyToken(header ?? query, opts.secret);
    if (!id || !opts.store.residents.get(id)) throw new JiranError('unauthorised', 'Please sign in with your SDP account');
    return id;
  };

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof JiranError) {
      return reply.status(HTTP_STATUS[err.code] ?? 400).send({ error: err.code, message: err.message });
    }
    if ((err as { statusCode?: number }).statusCode === 400) {
      return reply.status(400).send({ error: 'invalid', message: 'That request could not be read' });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'server', message: 'Something went wrong on our side' });
  });

  for (const route of ROUTES) {
    app.route({
      method: route.method,
      url: route.path,
      handler: async (req) => {
        const params = (req.params ?? {}) as Record<string, string>;
        const query = Object.fromEntries(Object.entries((req.query ?? {}) as Record<string, unknown>).filter(([k]) => k !== 'token').map(([k, v]) => [k, String(v)]));
        const body = req.body ?? {};
        if (route.access === 'public') return route.run({ svc, actorId: '', params, query, body });
        if (route.access === 'signin') {
          const resident = route.run({ svc, actorId: '', params, query, body }) as Resident;
          return { token: signToken(resident.id, opts.secret), me: svc.me(resident.id) };
        }
        return route.run({ svc, actorId: actorFrom(req), params, query, body });
      },
    });
  }

  // Live updates over Server-Sent Events (EventSource cannot send headers, so the token rides in the query).
  app.get('/api/events', (req, reply) => {
    const residentId = actorFrom(req);
    const me = opts.store.residents.get(residentId)!;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.write(`event: ready\ndata: {}\n\n`);
    const listener: Listener = {
      residentId, precinctId: me.precinctId,
      send: (e) => reply.raw.write(`data: ${JSON.stringify(e)}\n\n`),
    };
    listeners.add(listener);
    const ping = setInterval(() => reply.raw.write(`: ping\n\n`), 25000);
    req.raw.on('close', () => { clearInterval(ping); listeners.delete(listener); });
  });

  if (opts.webDist && existsSync(opts.webDist)) {
    app.register(fastifyStatic, { root: opts.webDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.status(404).send({ error: 'not_found', message: 'No such endpoint' });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'not_found', message: 'No such endpoint' }));
  }

  return { app, svc };
}

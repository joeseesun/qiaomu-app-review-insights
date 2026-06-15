import 'server-only';

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import { CachedAppReviewPage } from '@/lib/appstore/cache';

const DEFAULT_DAILY_LIMIT = 5;
const DEFAULT_FRESH_DAYS = 3;

interface DailyClientState {
  generatedAppKeys: string[];
  queuedAppKeys: string[];
  updatedAt: string;
}

interface DailyGenerationState {
  day: string;
  clients: Record<string, DailyClientState>;
}

export interface GenerationLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export interface GenerationReservation {
  allowed: boolean;
  clientKey: string;
  limit: GenerationLimitInfo;
}

export interface QueuedGenerationRequest {
  appKey: string;
  appId: string;
  appName?: string;
  country: string;
  query?: string;
  reason: 'rate-limited';
}

const inFlightGenerations = new Map<string, Promise<unknown>>();

function dataRoot() {
  return process.env.APP_REVIEW_GENERATION_LIMIT_DIR
    || path.join(
      process.env.APP_REVIEW_CACHE_DIR || path.join(process.cwd(), 'src', 'data', 'app-cache'),
      '.generation-guard'
    );
}

function dailyLimit() {
  const parsed = Number.parseInt(process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAILY_LIMIT;
  return Math.max(0, parsed);
}

export function publicCacheFreshDays() {
  const parsed = Number.parseInt(process.env.APP_REVIEW_PUBLIC_CACHE_FRESH_DAYS || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FRESH_DAYS;
  return Math.max(1, parsed);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function resetAtForDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function stateFilePath(day = dayKey()) {
  return path.join(dataRoot(), 'daily', `${day}.json`);
}

function queueFilePath(day = dayKey()) {
  return path.join(dataRoot(), 'queue', `${day}.jsonl`);
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwardedFor
    || (request as unknown as { ip?: string }).ip
    || 'unknown';
}

export function clientGenerationKey(request: NextRequest) {
  return crypto
    .createHash('sha256')
    .update(`appreview-public-generation:${clientIp(request)}`)
    .digest('hex')
    .slice(0, 32);
}

export function appGenerationKey(country: string, appId: string) {
  return `${country.toLowerCase()}-${appId.replace(/\D/g, '')}`;
}

export function isFreshCachedPage(page: CachedAppReviewPage | null, freshDays = publicCacheFreshDays()) {
  if (!page?.updatedAt) return false;
  const updatedAt = new Date(page.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt < freshDays * 24 * 60 * 60 * 1000;
}

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readDailyState(day = dayKey()): Promise<DailyGenerationState> {
  try {
    const content = await fs.readFile(stateFilePath(day), 'utf8');
    const parsed = JSON.parse(content) as DailyGenerationState;
    return {
      day,
      clients: parsed.clients || {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { day, clients: {} };
  }
}

async function writeDailyState(state: DailyGenerationState) {
  const filePath = stateFilePath(state.day);
  await ensureDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

function getClientState(state: DailyGenerationState, clientKey: string) {
  state.clients[clientKey] ||= {
    generatedAppKeys: [],
    queuedAppKeys: [],
    updatedAt: new Date().toISOString(),
  };
  state.clients[clientKey].generatedAppKeys ||= [];
  state.clients[clientKey].queuedAppKeys ||= [];
  return state.clients[clientKey];
}

function limitInfo(client: DailyClientState, limit: number, day: string): GenerationLimitInfo {
  const used = new Set(client.generatedAppKeys).size;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt: resetAtForDay(day),
  };
}

export async function reservePublicGeneration(request: NextRequest, appKey: string): Promise<GenerationReservation> {
  const day = dayKey();
  const clientKey = clientGenerationKey(request);
  const state = await readDailyState(day);
  const client = getClientState(state, clientKey);
  const limit = dailyLimit();
  const generated = new Set(client.generatedAppKeys);

  if (!generated.has(appKey) && generated.size >= limit) {
    return {
      allowed: false,
      clientKey,
      limit: limitInfo(client, limit, day),
    };
  }

  if (!generated.has(appKey)) {
    client.generatedAppKeys.push(appKey);
  }

  client.updatedAt = new Date().toISOString();
  await writeDailyState(state);

  return {
    allowed: true,
    clientKey,
    limit: limitInfo(client, limit, day),
  };
}

export async function queuePublicGeneration(
  request: NextRequest,
  requestInfo: QueuedGenerationRequest
): Promise<GenerationLimitInfo> {
  const day = dayKey();
  const clientKey = clientGenerationKey(request);
  const state = await readDailyState(day);
  const client = getClientState(state, clientKey);

  if (!client.queuedAppKeys.includes(requestInfo.appKey)) {
    client.queuedAppKeys.push(requestInfo.appKey);
  }

  client.updatedAt = new Date().toISOString();
  await writeDailyState(state);

  const queuePath = queueFilePath(day);
  await ensureDir(queuePath);
  await fs.appendFile(queuePath, `${JSON.stringify({
    ...requestInfo,
    clientKey,
    queuedAt: new Date().toISOString(),
  })}\n`, 'utf8');

  return limitInfo(client, dailyLimit(), day);
}

export function hasInFlightGeneration(appKey: string) {
  return inFlightGenerations.has(appKey);
}

export async function runDedupedGeneration<T>(appKey: string, generate: () => Promise<T>) {
  const existing = inFlightGenerations.get(appKey) as Promise<T> | undefined;
  if (existing) {
    return {
      deduped: true,
      result: await existing,
    };
  }

  const promise = generate().finally(() => {
    inFlightGenerations.delete(appKey);
  });

  inFlightGenerations.set(appKey, promise);

  return {
    deduped: false,
    result: await promise,
  };
}

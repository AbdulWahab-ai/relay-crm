import Anthropic from '@anthropic-ai/sdk';
import { AIActionType } from '@prisma/client';
import { db } from '../db';
import { Access } from '../access';
import { AppError } from '../security';
export function tokenReservation(payload: unknown, maxOutput: number) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8') + 10000 + maxOutput;
}
export function calculateCost(
  input: number,
  output: number,
  inputRate: number,
  outputRate: number,
) {
  return (input * inputRate + output * outputRate) / 1000000;
}
export function withinAllowance(
  usedActions: number,
  reservedActions: number,
  usedTokens: number,
  reservedTokens: number,
  newTokens: number,
  actionLimit: number,
  tokenLimit: number,
) {
  return (
    usedActions + reservedActions + 1 <= actionLimit &&
    usedTokens + reservedTokens + newTokens <= tokenLimit
  );
}
export async function trackAIUsage(
  a: Access,
  actionType: AIActionType,
  params: Anthropic.MessageCreateParamsNonStreaming,
) {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new AppError(
      503,
      'Claude is not connected yet. Add the Anthropic key to the server environment.',
    );
  const inputRate = Number(process.env.AI_INPUT_USD_PER_MILLION);
  const outputRate = Number(process.env.AI_OUTPUT_USD_PER_MILLION);
  if (
    !Number.isFinite(inputRate) ||
    inputRate <= 0 ||
    !Number.isFinite(outputRate) ||
    outputRate <= 0
  )
    throw new AppError(503, 'AI model pricing must be configured before use.');
  const estimate = tokenReservation(params, params.max_tokens);
  if (estimate > 130000)
    throw new AppError(
      400,
      'This conversation is too long. Start a fresh conversation.',
    );
  const reservation = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.organizationId}))`;
    const sub = await tx.subscription.findUniqueOrThrow({
      where: { organizationId: a.organizationId },
      include: { plan: true },
    });
    if (
      !['active', 'trialing'].includes(sub.status) ||
      sub.currentPeriodEnd <= new Date()
    )
      throw new AppError(
        402,
        'An active subscription or trial is required for AI.',
      );
    const bucket = await tx.usageBucket.upsert({
      where: {
        organizationId_periodStart: {
          organizationId: a.organizationId,
          periodStart: sub.currentPeriodStart,
        },
      },
      create: {
        organizationId: a.organizationId,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
      },
      update: {},
    });
    if (
      !withinAllowance(
        bucket.actions,
        bucket.reservedActions,
        bucket.tokens,
        bucket.reservedTokens,
        estimate,
        sub.plan.includedActions,
        sub.plan.includedTokens,
      )
    )
      throw new AppError(
        402,
        'AI allowance reached, or too little remains for this request. Upgrade your plan to continue.',
      );
    await tx.usageBucket.update({
      where: {
        organizationId_periodStart: {
          organizationId: a.organizationId,
          periodStart: sub.currentPeriodStart,
        },
      },
      data: {
        reservedTokens: { increment: estimate },
        reservedActions: { increment: 1 },
      },
    });
    return tx.aIRequest.create({
      data: {
        organizationId: a.organizationId,
        userId: a.userId,
        actionType,
        periodStart: sub.currentPeriodStart,
        reservedTokens: estimate,
      },
    });
  });
  let result: Anthropic.Message;
  try {
    result = await new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 0,
      timeout: 45000,
    }).messages.create(params);
  } catch (e: any) {
    const definite = [400, 401, 403, 404, 413, 422, 429].includes(e.status);
    await db.$transaction(async (tx) => {
      await tx.aIRequest.update({
        where: { id: reservation.id },
        data: { status: definite ? 'failed' : 'uncertain' },
      });
      if (definite)
        await tx.usageBucket.update({
          where: {
            organizationId_periodStart: {
              organizationId: a.organizationId,
              periodStart: reservation.periodStart,
            },
          },
          data: {
            reservedTokens: { decrement: estimate },
            reservedActions: { decrement: 1 },
          },
        });
    });
    throw new AppError(
      503,
      definite
        ? 'The AI provider could not process this request. Please try again later.'
        : 'The AI provider response was interrupted. Allowance is held pending reconciliation.',
    );
  }
  const input = result.usage.input_tokens,
    output = result.usage.output_tokens,
    cost = calculateCost(input, output, inputRate, outputRate);
  await db.$transaction(async (tx) => {
    await tx.aIUsageLog.create({
      data: {
        organizationId: a.organizationId,
        userId: a.userId,
        requestId: reservation.id,
        actionType,
        model: params.model,
        inputTokens: input,
        outputTokens: output,
        costUsd: cost,
        periodStart: reservation.periodStart,
      },
    });
    await tx.usageBucket.update({
      where: {
        organizationId_periodStart: {
          organizationId: a.organizationId,
          periodStart: reservation.periodStart,
        },
      },
      data: {
        actions: { increment: 1 },
        tokens: { increment: input + output },
        costUsd: { increment: cost },
        reservedTokens: { decrement: estimate },
        reservedActions: { decrement: 1 },
      },
    });
    await tx.aIRequest.update({
      where: { id: reservation.id },
      data: { status: 'completed' },
    });
  });
  return result;
}

#!/usr/bin/env node
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { HumanTone, HumanToneError } = require('humantone');

const NAME = 'humantone';
const VERSION = '0.0.2';
const API_KEY_REGEX = /^ht_[0-9a-f]{64}$/;

// --------------------------------------------------------------------
// Tool definitions (per SPEC §4)
// --------------------------------------------------------------------

const HUMANIZE_DESCRIPTION =
  "Rewrite text to sound more natural and human-written. Useful when prose " +
  "reads as mechanical or robotic and needs smoother, more natural phrasing. " +
  "Supports detailed custom instructions to guide the rewrite: tone (formal, " +
  "casual, professional), audience (executives, students, technical readers), " +
  "terminology to preserve (brand names, technical terms, acronyms), brand " +
  "voice, purpose, or any specific direction. Custom instructions make the " +
  "output substantially more relevant to the user's specific use case than a " +
  "generic rewrite. Input must be at least 30 words. Maximum words per " +
  "request depend on the user's plan: 750 for Basic, 1000 for Standard, 1500 " +
  "for Pro. Call get_account to see the exact limit on the user's plan. " +
  "Consumes credits at 1 credit per 100 words.";

const DETECT_DESCRIPTION =
  "Check how AI-like a piece of text reads using HumanTone's AI Likelihood " +
  "Indicator. Returns a score from 0 to 100 with a likelihood label (Likely " +
  "Human, Possibly Human, Possibly AI, or Likely AI). Useful for checking " +
  "your own writing, comparing samples before and after rewriting, or " +
  "testing third-party content. This is a heuristic indicator, not a " +
  "definitive detector. Free with the user's plan. Limited to 30 checks per " +
  "day, shared with their HumanTone web app usage.";

const ACCOUNT_DESCRIPTION =
  "Check the user's current HumanTone account: plan name, remaining credits, " +
  "monthly credits, Extra Credits, subscription status, and per-request word " +
  "limit. Useful before running a large humanize batch to confirm the user " +
  "has enough credits, or when the user asks how many credits they have left.";

const HUMANIZE_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      description:
        "The AI-generated text to rewrite. Must be at least 30 words. " +
        "Maximum word count depends on the user's plan: 750 for Basic, " +
        "1000 for Standard, 1500 for Pro.",
    },
    level: {
      type: 'string',
      enum: ['standard', 'advanced', 'extreme'],
      description:
        "Humanization strength. 'standard' (the API default) supports 60+ " +
        "languages and produces the highest-quality natural rewrites. " +
        "'advanced' and 'extreme' are English-only and lean further toward " +
        "reducing AI-like patterns at some cost to quality. Use 'standard' " +
        "unless the user explicitly asks for stronger reduction of AI signals.",
    },
    output_format: {
      type: 'string',
      enum: ['text', 'html', 'markdown'],
      default: 'text',
      description:
        "Format of the returned content. Default 'text' for plain output " +
        "suitable for further LLM processing. Use 'html' or 'markdown' if " +
        "the user is publishing the result directly into a CMS or document.",
    },
    custom_instructions: {
      type: 'string',
      maxLength: 1000,
      description:
        "Optional free-form guidance for the rewrite: tone, terms to " +
        "preserve, audience, purpose. Examples: 'Keep a formal tone', " +
        "'Preserve technical terms like Kubernetes and Docker', 'Audience " +
        "is non-technical executives'.",
    },
  },
  required: ['text'],
  additionalProperties: false,
};

const DETECT_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      description: 'The text to analyze for AI likelihood patterns.',
    },
  },
  required: ['text'],
  additionalProperties: false,
};

const ACCOUNT_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const TOOLS = [
  { name: 'humanize', description: HUMANIZE_DESCRIPTION, inputSchema: HUMANIZE_INPUT_SCHEMA },
  { name: 'detect_ai', description: DETECT_DESCRIPTION, inputSchema: DETECT_INPUT_SCHEMA },
  { name: 'get_account', description: ACCOUNT_DESCRIPTION, inputSchema: ACCOUNT_INPUT_SCHEMA },
];

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

const DETECT_DISCLAIMER =
  'Note: This is a heuristic indicator of how AI-like the text reads, not a ' +
  'definitive detection. Different detectors score the same text differently. ' +
  'No detection system is perfect.';

function labelForScore(score) {
  if (score <= 25) return 'Likely Human';
  if (score <= 50) return 'Possibly Human';
  if (score <= 75) return 'Possibly AI';
  return 'Likely AI';
}

function formatTimeUntilReset(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return 'less than a minute';
  if (seconds < 60) return 'less than a minute';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function yesNo(v) {
  return v ? 'yes' : 'no';
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function errorResult(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}

function mapError(err, toolName) {
  if (!(err instanceof HumanToneError)) {
    const fallback = err && err.message ? err.message : 'unknown error';
    return errorResult(`Unexpected error from HumanTone: ${fallback}`);
  }

  const code = err.errorCode;
  const msg = err.message || '';

  switch (code) {
    case 'authentication_error':
      return errorResult(
        'HumanTone API key is invalid or missing. Check the HUMANTONE_API_KEY ' +
          'environment variable in your MCP client config.'
      );
    case 'permission_error':
      return errorResult(
        'Your HumanTone plan does not include API access. View plans at ' +
          'https://humantone.io/pricing/ or manage your plan at ' +
          'https://app.humantone.io/settings/plan'
      );
    case 'insufficient_credits':
      return errorResult(
        'Not enough HumanTone credits. Buy Extra Credits at ' +
          'https://app.humantone.io/settings/credits or wait for your monthly reset.'
      );
    case 'daily_limit_exceeded': {
      const seconds =
        err.details && typeof err.details.timeToNextRenew === 'number'
          ? err.details.timeToNextRenew
          : null;
      if (seconds === null) {
        return errorResult(
          'Daily detection limit reached (30 per day, shared between the ' +
            'HumanTone web app and the API). Resets at midnight UTC.'
        );
      }
      return errorResult(
        `Daily detection limit reached (30 per day, shared between the HumanTone ` +
          `web app and the API). Resets in ${formatTimeUntilReset(seconds)} (midnight UTC).`
      );
    }
    case 'detection_failed':
      return errorResult('The detection service did not return a result. Please retry the request.');
    case 'invalid_request':
      if (toolName === 'humanize') {
        if (msg.includes('at least 30 words')) {
          return errorResult('Text must be at least 30 words. The current input is too short.');
        }
        if (msg.includes('exceeds the maximum')) {
          return errorResult(
            "Text exceeds your plan's word limit. Split the input into smaller chunks, " +
              'or upgrade your plan at https://app.humantone.io/settings/plan'
          );
        }
      }
      return errorResult(`Invalid request: ${msg || 'unknown error'}`);
    case 'not_found':
      if (toolName === 'get_account') {
        return errorResult(
          'Account information could not be retrieved. Please contact ' +
            'help@humantone.io for support.'
        );
      }
      return errorResult(`Unexpected error from HumanTone: ${msg || 'unknown error'}`);
    case 'api_error':
      return errorResult('HumanTone API encountered a temporary issue. Please retry in a few seconds.');
    case 'network_error':
      return errorResult("Could not reach api.humantone.io. Check the user's internet connection.");
    case 'timeout':
      return errorResult(
        'Request timed out. The text may be very long; try a shorter input or split it ' +
          'into smaller chunks.'
      );
    case 'rate_limit':
      return errorResult('Too many requests, please slow down.');
    case 'method_not_allowed':
      return errorResult(
        'Unexpected response from HumanTone (method not allowed). Please report this at ' +
          'https://github.com/humantone/humantone-mcp/issues'
      );
    case 'invalid_response':
      return errorResult('Unexpected response from HumanTone. Please retry in a few seconds.');
    case 'invalid_response_shape':
      return errorResult('Unexpected response shape from HumanTone. Please retry in a few seconds.');
    default:
      return errorResult(`Unexpected error from HumanTone: ${msg || 'unknown error'}`);
  }
}

// --------------------------------------------------------------------
// Tool handlers
// --------------------------------------------------------------------

async function handleHumanize(client, args) {
  const params = { text: args.text };
  if (args.level !== undefined) params.level = args.level;
  // Explicit MCP default: API defaults to html, but for downstream LLM use we want text.
  params.outputFormat = args.output_format !== undefined ? args.output_format : 'text';
  if (args.custom_instructions !== undefined) params.customInstructions = args.custom_instructions;

  const result = await client.humanize(params);
  const creditsLine =
    params.outputFormat === 'html'
      ? `<!-- Credits used: ${result.creditsUsed} -->`
      : `Credits used: ${result.creditsUsed}`;
  return textResult(`${result.text}\n\n${creditsLine}`);
}

async function handleDetect(client, args) {
  const result = await client.detect({ text: args.text });
  const score = Math.round(result.aiScore);
  const label = labelForScore(score);
  return textResult(`AI likelihood score: ${score}/100 (${label}).\n\n${DETECT_DISCLAIMER}`);
}

async function handleAccount(client) {
  const r = await client.account.get();
  const renews = r.subscription.active ? r.subscription.expiresAt : 'Plan expired';
  const lines = [
    'HumanTone Account',
    '',
    `Plan: ${r.plan.name} (${r.plan.id})`,
    `API access: ${yesNo(r.plan.apiAccess)}`,
    `Per-request word limit: ${r.plan.maxWords} words`,
    `Monthly credits: ${r.plan.monthlyCredits}`,
    '',
    'Credits',
    `  Total available: ${r.credits.total}`,
    `  From subscription: ${r.credits.subscription}`,
    `  Extra Credits: ${r.credits.extra}`,
    `  Trial: ${r.credits.trial}`,
    '',
    'Subscription',
    `  Active: ${yesNo(r.subscription.active)}`,
    `  Renews/expires: ${renews}`,
  ];
  return textResult(lines.join('\n'));
}

// --------------------------------------------------------------------
// Server lifecycle
// --------------------------------------------------------------------

async function main() {
  const apiKey = process.env.HUMANTONE_API_KEY;
  if (!apiKey || !API_KEY_REGEX.test(apiKey)) {
    process.stderr.write(
      'humantone-mcp: HUMANTONE_API_KEY env var is missing or invalid. ' +
        'Get a key at https://app.humantone.io/settings/api\n'
    );
    process.exit(1);
  }

  const client = new HumanTone({ apiKey });

  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments || {};
    try {
      switch (name) {
        case 'humanize':
          return await handleHumanize(client, args);
        case 'detect_ai':
          return await handleDetect(client, args);
        case 'get_account':
          return await handleAccount(client);
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return mapError(err, name);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `humantone-mcp v${VERSION} ready. Tools: humanize, detect_ai, get_account.\n`
  );
}

main().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  process.stderr.write(`humantone-mcp: failed to start: ${msg}\n`);
  process.exit(1);
});

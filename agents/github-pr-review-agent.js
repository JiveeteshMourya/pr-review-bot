import { Agent } from '@openai/agents';
import { z } from 'zod';

export const GithubReviewAgentResultSchema = z.object({
  criticalFixes: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('critical fixes if any'),
  suggestions: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('suggestions fixes if any'),
  content: z.string().describe('Actual content for the reply'),
  event: z.enum(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']),
});

export const githubPullrequestReviewAgent = new Agent({
  name: 'Github Pull Request',
  outputType: GithubReviewAgentResultSchema,
  instructions: `
    You're an expert AI code reviewer.
    You are given a pull request details with some basic information about the pull request
    and the changes in that pull requests.
    Give a detailed review about the code and suggest some fixes if any, your comments, etc.
    Use emojis in comments to make it natural.
  `,
});
import { inngest } from '../client.js';
import { octokit } from '../../lib/github.js';
import { run } from '@openai/agents';
import { githubPullrequestReviewAgent } from '../../agents/github-pr-review-agent.js';

/**
 * Event: {
 *  data: {
 *    "owner": "piyushgarg-dev"
 *    "repo": "chaicode-form-builder",
 *    "pull_number": number
 *    
 *  }
 * }
 */

export const githubPullRequestReview = inngest.createFunction(
  {
    id: 'github-pr-review',
    triggers: [
      {
        event: 'github/pullrequest.review',
      },
    ],
  },
  async ({ event, step }) => {
    const { owner, repo, pull_number } = event.data;
    // 1. Fetch the Pull Request Information
    const pullRequestInfo = await step.run(
      'fetch-pull-request-information',
      async () => {
        try {
          const pullRequestObject = await octokit.pulls.get({
            owner,
            repo,
            pull_number,
          });

          return {
            id: pullRequestObject.data.id,
            title: pullRequestObject.data.title,
            state: pullRequestObject.data.state,
            number: pullRequestObject.data.number,
            comments: pullRequestObject.data.comments,
            url: pullRequestObject.data.url,
            diffUrl: pullRequestObject.data.diff_url,
            changes: pullRequestObject.data.changed_files,
            commits: pullRequestObject.data.commits,
            head: {
              ref: pullRequestObject.data.head.ref,
              sha: pullRequestObject.data.head.sha,
            },
          };
        } catch (error) {
          console.log(error);
          return null;
        }
      },
    );

    if (!pullRequestInfo)
      return { message: 'Pull request not found', skipped: true };

    if (pullRequestInfo.state !== 'open')
      return {
        message: 'Pull request is not open, Skipping the review',
        skipped: true,
        completed: false,
      };

    // 2.
    const changes = await step.run('fetch-changes', async () => {
      const changesResult = await octokit.paginate(octokit.pulls.listFiles, {
        owner,
        repo,
        pull_number,
        per_page: 100,
      });

      return changesResult.map((change) => ({
        filename: change.filename,
        status: change.status,
        changes: change.changes,
        patch: change.patch,
        additions: change.additions,
        deletions: change.deletions,
        previous_filename: change.previous_filename,
      }));
    });

    if (changes.length === 0)
      return { message: 'There are no changes in this PR', skipped: true };

    // 3. 
    const aiResponse = await step.run('ai-analyse', async () => {
      const llmResponse = await run(
        githubPullrequestReviewAgent,
        `
        Pull Request Information:
        ${JSON.stringify(pullRequestInfo, null, 2)}
        \n\n
        Changes:
        ${JSON.stringify(changes, null, 2)}
      `,
      );
      return {
        result: llmResponse.finalOutput,
      };
    });

    // 4. 
    await step.run('post-comment', async () => {
      const { criticalFixes, suggestions, content } = aiResponse.result;

      const sections = [content];

      if (criticalFixes?.length)
        sections.push(
          `**Critical Changes:**\n${criticalFixes.map((fix) => `- ${fix}`).join('\n')}`,
        );

      if (suggestions?.length)
        sections.push(
          `**Suggestions:**\n${suggestions.map((suggestion) => `- ${suggestion}`).join('\n')}`,
        );

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: sections.join('\n\n'),
      });
    });
  },
);
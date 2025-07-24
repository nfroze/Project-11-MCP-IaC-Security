import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';

export class GitHubClient {
  constructor(token) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  async getLatestWorkflowRun(owner, repo, workflowFileName) {
    try {
      const { data } = await this.octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowFileName,
        per_page: 1,
        status: 'completed'
      });

      return data.workflow_runs[0] || null;
    } catch (error) {
      console.error('Error fetching workflow runs:', error.message);
      return null;
    }
  }

  async getCheckovResults(owner, repo, runId) {
    try {
      // List artifacts from the workflow run
      const { data: { artifacts } } = await this.octokit.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId
      });

      // Find the Checkov JSON results artifact
      const checkovArtifact = artifacts.find(
        artifact => artifact.name === 'checkov-results-json'
      );

      if (!checkovArtifact) {
        console.error('No Checkov results artifact found');
        return null;
      }

      // Download the artifact
      const { data } = await this.octokit.actions.downloadArtifact({
        owner,
        repo,
        artifact_id: checkovArtifact.id,
        archive_format: 'zip'
      });

      // Extract JSON from zip
      const zip = new AdmZip(Buffer.from(data));
      const zipEntries = zip.getEntries();
      
      for (const entry of zipEntries) {
        if (entry.entryName === 'results_json.json') {
          const content = entry.getData().toString('utf8');
          return JSON.parse(content);
        }
      }

      return null;
    } catch (error) {
      console.error('Error downloading Checkov results:', error.message);
      return null;
    }
  }

  async getFileContent(owner, repo, path) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path
      });

      // Decode base64 content
      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      console.error(`Error fetching file ${path}:`, error.message);
      return null;
    }
  }

  async getTerraformFiles(owner, repo, path) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path
      });

      // If it's a directory, filter for .tf files
      if (Array.isArray(data)) {
        return data.filter(file => file.name.endsWith('.tf'));
      }

      return [];
    } catch (error) {
      console.error('Error listing Terraform files:', error.message);
      return [];
    }
  }

  async createPullRequest(owner, repo, title, body, branch, changes) {
    try {
      // This is a placeholder for PR creation functionality
      // In a real implementation, you would:
      // 1. Create a new branch
      // 2. Commit the changes
      // 3. Create a pull request
      
      console.log('PR creation not implemented in this demo');
      return null;
    } catch (error) {
      console.error('Error creating pull request:', error.message);
      return null;
    }
  }
}
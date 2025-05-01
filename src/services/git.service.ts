import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import os from "os";

const execAsync = promisify(exec);

// Define interfaces for our return types
interface GitSuccessResult {
  success: true;
  message: string;
  [key: string]: any;
}

interface GitErrorResult {
  success: false;
  message: string;
}

type GitResult = GitSuccessResult | GitErrorResult;

interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface GitBranch {
  name: string;
  isCurrent: boolean;
}

interface GitFileStatus {
  status: string;
  file: string;
}

interface GitStatusResult extends GitSuccessResult {
  isClean: boolean;
  changes: GitFileStatus[];
}

interface GitCommitHistoryResult extends GitSuccessResult {
  commits: GitCommit[];
}

interface GitBranchResult extends GitSuccessResult {
  branches: GitBranch[];
}

interface GitDiffResult extends GitSuccessResult {
  diff: string;
}

interface GitFileContentResult extends GitSuccessResult {
  content: string;
}

interface GitFilesListResult extends GitSuccessResult {
  files: string[];
}

interface GitFileLastModifiedResult extends GitSuccessResult {
  lastModified: GitCommit;
}

class GitService {
  private basePath: string;

  constructor(basePath: string = "") {
    this.basePath = basePath;
  }

  /**
   * Get the full path by combining base path with relative path
   */
  private _getFullPath(relativePath: string): string {
    return this.basePath
      ? path.join(this.basePath, relativePath)
      : relativePath;
  }

  /**
   * Helper method to recursively copy directories
   */
  private async _copyDir(src: string, dest: string): Promise<void> {
    try {
      const entries = await fs.readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await this._copyDir(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to copy directory: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize a new Git repository
   */
  async initRepo(repoPath: string): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      await execAsync("git init", { cwd: fullPath });
      return {
        success: true,
        message: `Repository initialized at ${fullPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to initialize repository: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if a directory is a Git repository
   */
  async isGitRepo(repoPath: string): Promise<boolean> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync("git rev-parse --is-inside-work-tree", { cwd: fullPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get status of the repository
   */
  async getStatus(repoPath: string): Promise<GitStatusResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: fullPath,
      });
      return {
        success: true,
        message: "Status retrieved successfully",
        isClean: stdout.trim() === "",
        changes: stdout
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => {
            const status = line.substring(0, 2);
            const file = line.substring(3);
            return { status, file };
          }),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get status: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Add all files to staging
   */
  async addAllFiles(repoPath: string): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync("git add .", { cwd: fullPath });
      return { success: true, message: "All files added to staging" };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Add specific files to staging
   */
  async addFiles(
    repoPath: string,
    files: string | string[]
  ): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const fileList = Array.isArray(files) ? files.join(" ") : files;
      await execAsync(`git add ${fileList}`, { cwd: fullPath });
      return { success: true, message: `Files added to staging: ${fileList}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Commit changes with user information
   */
  async commitChanges(
    repoPath: string,
    message: string,
    authorName?: string,
    authorEmail?: string
  ): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      let command = `git commit -m "${message}"`;

      if (authorName && authorEmail) {
        command = `git -c user.name="${authorName}" -c user.email="${authorEmail}" commit -m "${message}"`;
      }

      await execAsync(command, { cwd: fullPath });
      return { success: true, message: "Changes committed successfully" };
    } catch (error) {
      return {
        success: false,
        message: `Failed to commit changes: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get commit history
   */
  async getCommitHistory(
    repoPath: string,
    limit: number = 50
  ): Promise<GitCommitHistoryResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync(
        `git log -n ${limit} --pretty=format:"%H|%an|%ae|%ad|%s"`,
        { cwd: fullPath }
      );

      if (!stdout.trim()) {
        return { success: true, message: "No commits found", commits: [] };
      }

      const commits = stdout.split("\n").map((line) => {
        const [hash, author, email, date, message] = line.split("|");
        return { hash, author, email, date, message };
      });

      return { success: true, message: "Commit history retrieved", commits };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get commit history: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Checkout a specific commit
   */
  async checkoutCommit(
    repoPath: string,
    commitHash: string
  ): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync(`git checkout ${commitHash}`, { cwd: fullPath });
      return { success: true, message: `Checked out commit: ${commitHash}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to checkout commit: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create and checkout a new branch
   */
  async createBranch(repoPath: string, branchName: string): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync(`git checkout -b ${branchName}`, { cwd: fullPath });
      return {
        success: true,
        message: `Created and checked out branch: ${branchName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create branch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List all branches
   */
  async listBranches(
    repoPath: string
  ): Promise<GitBranchResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync("git branch", { cwd: fullPath });
      const branches = stdout
        .split("\n")
        .map((branch) => branch.trim())
        .filter((branch) => branch !== "")
        .map((branch) => {
          const isCurrent = branch.startsWith("*");
          return {
            name: isCurrent ? branch.substring(2) : branch,
            isCurrent,
          };
        });

      return { success: true, message: "Branches retrieved", branches };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list branches: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(repoPath: string, branchName: string): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync(`git checkout ${branchName}`, { cwd: fullPath });
      return { success: true, message: `Switched to branch: ${branchName}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch branch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get file differences between commits
   */
  async getDiff(
    repoPath: string,
    commitHash1: string,
    commitHash2: string | null = null
  ): Promise<GitDiffResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const command = commitHash2
        ? `git diff ${commitHash1} ${commitHash2}`
        : `git diff ${commitHash1}`;

      const { stdout } = await execAsync(command, { cwd: fullPath });
      return { success: true, message: "Diff retrieved", diff: stdout };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get diff: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get changes in a specific file between commits
   */
  async getFileDiff(
    repoPath: string,
    filePath: string,
    commitHash1: string,
    commitHash2: string | null = null
  ): Promise<GitDiffResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const command = commitHash2
        ? `git diff ${commitHash1} ${commitHash2} -- ${filePath}`
        : `git diff ${commitHash1} -- ${filePath}`;

      const { stdout } = await execAsync(command, { cwd: fullPath });
      return { success: true, message: "File diff retrieved", diff: stdout };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get file diff: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Clone a repository (for potential remote integration)
   */
  async cloneRepo(targetPath: string, repoUrl: string): Promise<GitResult> {
    const fullPath = this._getFullPath(targetPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      await execAsync(`git clone ${repoUrl} .`, { cwd: fullPath });
      return { success: true, message: `Repository cloned to ${fullPath}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clone repository: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create a zip archive of specific commit
   */
  async archiveCommit(
    repoPath: string,
    outputPath: string,
    commitHash: string = "HEAD"
  ): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      await execAsync(
        `git archive --format=zip --output=${outputPath} ${commitHash}`,
        { cwd: fullPath }
      );
      return { success: true, message: `Archive created at ${outputPath}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create archive: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create a new boilerplate repository structure
   */
  async createBoilerplateFiles(data: {
    category: string;
    name: string;
    fullPath: string;
    initialFiles: Record<string, string>,
  }): Promise<GitResult> {
    const repoPath = path.join(data.category, data.name);

    try {
      // Create directory structure
      await fs.mkdir(data.fullPath, { recursive: true });

      // Create initial files if provided
      for (const [filePath, content] of Object.entries(data.initialFiles)) {
        const fullFilePath = path.join(data.fullPath, filePath);
        const dirPath = path.dirname(fullFilePath);
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(fullFilePath, content);
      }

      // Initialize git repo
      await this.initRepo(repoPath);

      // Add and commit initial files if any exist
      if (Object.keys(data.initialFiles).length > 0) {
        await this.addAllFiles(repoPath);
        await this.commitChanges(
          repoPath,
          "Initial commit",
          "System",
          "system@boilerplates.com"
        );
      }

      return {
        success: true,
        message: `Boilerplate created at ${data.fullPath}`,
        path: repoPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create boilerplate: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if changes exist in working directory
   */
  async hasChanges(repoPath: string): Promise<boolean> {
    const status = await this.getStatus(repoPath);
    return status.success ? !status.isClean : false;
  }

  /**
   * Reset working directory to specific commit
   */
  async resetToCommit(
    repoPath: string,
    commitHash: string,
    hard: boolean = false
  ): Promise<GitResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const flag = hard ? "--hard" : "--mixed";
      await execAsync(`git reset ${flag} ${commitHash}`, { cwd: fullPath });
      return {
        success: true,
        message: `Reset to commit ${commitHash} (${hard ? "hard" : "mixed"})`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get file content at specific commit
   */
  async getFileAtCommit(
    repoPath: string,
    filePath: string,
    commitHash: string = "HEAD"
  ): Promise<GitFileContentResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync(`git show ${commitHash}:${filePath}`, {
        cwd: fullPath,
      });
      return {
        success: true,
        message: "File content retrieved",
        content: stdout,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get file: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List all files in a specific commit
   */
  async listFilesAtCommit(
    repoPath: string,
    commitHash: string = "HEAD"
  ): Promise<GitFilesListResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync(
        `git ls-tree -r --name-only ${commitHash}`,
        { cwd: fullPath }
      );
      const files = stdout.split("\n").filter((file) => file.trim() !== "");
      return { success: true, message: "Files listed successfully", files };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get the last modification details for a file
   */
  async getFileLastModified(
    repoPath: string,
    filePath: string
  ): Promise<GitFileLastModifiedResult | GitErrorResult> {
    const fullPath = this._getFullPath(repoPath);
    try {
      const { stdout } = await execAsync(
        `git log -1 --format="%H|%an|%ae|%ad|%s" -- ${filePath}`,
        { cwd: fullPath }
      );

      if (!stdout.trim()) {
        return { success: false, message: "No history found for file" };
      }

      const [hash, author, email, date, message] = stdout.split("|");
      return {
        success: true,
        message: "Last modification details retrieved",
        lastModified: { hash, author, email, date, message },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get file history: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Download a specific version of a boilerplate as a zip archive
   */
  async downloadBoilerplate(
    repoPath: string,
    outputPath: string,
    commitHash: string = "HEAD"
  ): Promise<GitResult> {
    return this.archiveCommit(repoPath, outputPath, commitHash);
  }

  /**
   * Process an uploaded zip file into a git repository
   */
  async processUploadedZip(
    zipFilePath: string,
    category: string,
    name: string,
    authorName?: string,
    authorEmail?: string
  ): Promise<GitResult> {
    const repoPath = path.join(category, name);
    const fullPath = this._getFullPath(repoPath);
    const tempDir = path.join(os.tmpdir(), uuidv4());

    try {
      // Create repo directory
      await fs.mkdir(fullPath, { recursive: true });

      // Extract zip to temp directory
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(tempDir, true);

      // Copy files from temp to repo
      await this._copyDir(tempDir, fullPath);

      // Initialize git repo if needed
      const isRepo = await this.isGitRepo(repoPath);
      if (!isRepo) {
        await this.initRepo(repoPath);
      }

      // Add and commit files
      await this.addAllFiles(repoPath);
      await this.commitChanges(
        repoPath,
        "Upload via zip file",
        authorName || "System",
        authorEmail || "system@boilerplates.com"
      );

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        message: `Boilerplate uploaded and committed at ${fullPath}`,
        path: repoPath,
      };
    } catch (error) {
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return {
        success: false,
        message: `Failed to process zip file: ${(error as Error).message}`,
      };
    }
  }
}

export default GitService;

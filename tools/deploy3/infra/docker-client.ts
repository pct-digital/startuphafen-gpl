/**
 * Docker Client - Handles Docker and Docker Compose operations via SSH.
 *
 * This module provides a clean abstraction over Docker operations including:
 * - Docker Compose lifecycle (up, down, logs)
 * - Container management (run, stop, logs, status checks)
 * - Volume management (create, inspect, exists)
 * - Health checks and waiting for container status
 *
 * All operations are synchronous (blocking) using execSync via SshClient.
 * This is by design for CLI deployment tools.
 */

import { SshClient, ExecOptions } from './ssh-client';
import { logger } from '../lib/utils/logger';
import { quoteShellArg } from '../lib/utils/shell';

/**
 * Options for running a one-off Docker container
 */
export interface DockerRunOptions {
  /** Remove container after exit (default: true) */
  rm?: boolean;
  /** Run in detached mode */
  detach?: boolean;
  /** Accept stdin (adds -i flag) */
  interactive?: boolean;
  /** Docker network to connect to */
  network?: string;
  /** Container name (for detached containers) */
  name?: string;
  /** Volume mounts in format ['host:container', ...] */
  volumes?: string[];
  /** Environment variables in format ['KEY=value', ...] */
  env?: string[];
  /** Port mappings in format ['host:container', ...] */
  ports?: string[];
  /** Working directory inside the container */
  workdir?: string;
  /** User to run as */
  user?: string;
  /** Override the default entrypoint */
  entrypoint?: string;
}

/**
 * Options for docker exec operations
 */
export interface DockerExecOptions {
  /** Environment variables in format ['KEY=value', ...] */
  env?: string[];
}

/**
 * Options for Docker Compose operations
 */
export interface ComposeOptions {
  /** Compose files to use (in order) */
  files?: string[];
  /** Working directory for compose commands */
  workdir: string;
  /** Project name (optional, defaults to directory name) */
  projectName?: string;
  /** Path to .env file (optional, explicit --env-file flag) */
  envFile?: string;
}

/**
 * Container status information
 */
export interface ContainerStatus {
  exists: boolean;
  running: boolean;
}

/**
 * Docker Client for remote Docker operations via SSH.
 */
export class DockerClient {
  constructor(private readonly ssh: SshClient) {}

  // ===== Docker Compose Operations =====

  /**
   * Build the docker compose command prefix with file flags
   */
  private buildComposeCommand(options: ComposeOptions): string {
    const files = options.files ?? [];
    const fileFlags = files.map((f) => `-f ${quoteShellArg(f)}`).join(' ');
    const projectFlag = options.projectName
      ? `--project-name ${quoteShellArg(options.projectName)}`
      : '';
    const envFileFlag = options.envFile
      ? `--env-file ${quoteShellArg(options.envFile)}`
      : '';
    return `docker compose ${fileFlags} ${projectFlag} ${envFileFlag}`.trim();
  }

  /**
   * Start services with docker compose
   *
   * @param options - Compose options (files, workdir)
   * @param services - Optional specific services to start (empty = all)
   * @param execOptions - SSH execution options
   */
  composeUp(
    options: ComposeOptions,
    services: string[] = [],
    execOptions: ExecOptions = {}
  ): void {
    const compose = this.buildComposeCommand(options);
    const servicesStr = services.join(' ');
    const cmd = `cd ${quoteShellArg(
      options.workdir
    )} && ${compose} up -d --quiet-pull ${servicesStr}`.trim();
    this.ssh.exec(cmd, execOptions);
  }

  /**
   * Stop services with docker compose
   *
   * @param options - Compose options (files, workdir)
   * @param services - Optional specific services to stop (empty = all)
   * @param removeVolumes - If true, adds -v flag to remove anonymous volumes
   * @param execOptions - SSH execution options
   */
  composeDown(
    options: ComposeOptions,
    services: string[] = [],
    removeVolumes = false,
    execOptions: ExecOptions = {}
  ): void {
    const compose = this.buildComposeCommand(options);
    const servicesStr = services.join(' ');
    const volumeFlag = removeVolumes ? '-v ' : '';
    const cmd = `cd ${quoteShellArg(
      options.workdir
    )} && ${compose} down ${volumeFlag}${servicesStr}`.trim();
    this.ssh.exec(cmd, execOptions);
  }

        /**
   * Get list of all currently running compose services.
   *
   * @param options - Compose options (files, workdir)
   * @returns Array of service names that are currently running
   */
  getRunningComposeServices(options: ComposeOptions): string[] {
    try {
      const compose = this.buildComposeCommand(options);
      const cmd = `cd ${quoteShellArg(
        options.workdir
      )} && ${compose} ps --status=running --format '{{.Service}}'`;
      const result = this.ssh.exec(cmd, { silent: true });
      return result
        .trim()
        .split('\n')
        .filter((s) => s.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Get list of all services defined in the compose configuration.
   * Uses `docker compose config --services` to parse and return service names.
   *
   * @param options - Compose options (files, workdir)
   * @returns Array of all defined service names
   */
  getComposeServices(options: ComposeOptions): string[] {
    const compose = this.buildComposeCommand(options);
    const cmd = `cd ${quoteShellArg(
      options.workdir
    )} && ${compose} config --services`;
    const result = this.ssh.exec(cmd, { silent: true });
    return result
      .trim()
      .split('\n')
      .filter((s) => s.length > 0);
  }

  // ===== Docker Container Operations =====

  /**
   * Run a one-off Docker container
   *
   * @param image - Docker image to run
   * @param command - Command to execute in the container
   * @param options - Container run options
   * @param execOptions - SSH execution options
   */
  run(
    image: string,
    command: string,
    options: DockerRunOptions = {},
    execOptions: ExecOptions = {}
  ): string {
    const cmd = this.buildRunCommand(image, command, options);
    return this.ssh.exec(cmd, execOptions);
  }

  /**
   * Build a docker run command string (without executing).
   * Will silently pull the image mentioned in the command to avoid spammy download messages in docker run later.
   *
   * Useful for building commands that will be piped or composed with other commands.
   *
   * @param image - Docker image to run
   * @param command - Command to execute in the container
   * @param options - Container run options
   * @returns The docker run command string
   */
  buildRunCommand(
    image: string,
    command: string,
    options: DockerRunOptions = {}
  ): string {
    // First, pull the image silently to avoid progress spam
    this.ssh.exec(`docker pull ${quoteShellArg(image)} > /dev/null 2>&1`, {
      silent: true,
    });

    const flags: string[] = [];

    // Never pull during run since we already pulled above
    flags.push('--pull never');

    if (options.rm !== false) {
      flags.push('--rm');
    }

    if (options.detach) {
      flags.push('-d');
    }

    if (options.interactive) {
      flags.push('-i');
    }

    if (options.name) {
      flags.push(`--name ${quoteShellArg(options.name)}`);
    }

    if (options.network) {
      flags.push(`--network ${quoteShellArg(options.network)}`);
    }

    if (options.workdir) {
      flags.push(`-w ${quoteShellArg(options.workdir)}`);
    }

    if (options.user) {
      flags.push(`-u ${quoteShellArg(options.user)}`);
    }

    for (const vol of options.volumes ?? []) {
      flags.push(`-v ${quoteShellArg(vol)}`);
    }

    for (const env of options.env ?? []) {
      flags.push(`-e ${quoteShellArg(env)}`);
    }

    for (const port of options.ports ?? []) {
      flags.push(`-p ${quoteShellArg(port)}`);
    }

    if (options.entrypoint) {
      flags.push(`--entrypoint ${quoteShellArg(options.entrypoint)}`);
    }

    return `docker run ${flags.join(' ')} ${quoteShellArg(
      image
    )} ${command}`.trim();
  }

  /**
   * Stop a running container
   *
   * @param containerName - Name of the container to stop
   * @param execOptions - SSH execution options
   */
  stop(containerName: string, execOptions: ExecOptions = {}): void {
    const cmd = `docker stop ${quoteShellArg(containerName)}`;
    this.ssh.exec(cmd, execOptions);
  }

  /**
   * Execute a command inside a running container
   *
   * @param containerName - Name of the container
   * @param command - Command to execute (will be passed to shell)
   * @param options - Docker exec options (env vars, etc.)
   * @param execOptions - SSH execution options
   * @returns Command output
   */
  exec(
    containerName: string,
    command: string,
    options: DockerExecOptions = {},
    execOptions: ExecOptions = {}
  ): string {
    const envFlags = (options.env ?? [])
      .map((e) => `-e ${quoteShellArg(e)}`)
      .join(' ');
    const cmd = `docker exec ${envFlags} ${quoteShellArg(
      containerName
    )} ${command}`
      .replace(/\s+/g, ' ')
      .trim();
    return this.ssh.exec(cmd, execOptions);
  }

  /**
   * Force remove a container (stops and removes in one command)
   *
   * @param containerName - Name of the container to remove
   * @param execOptions - SSH execution options
   */
  forceRemoveContainer(
    containerName: string,
    execOptions: ExecOptions = {}
  ): void {
    const cmd = `docker rm -f ${quoteShellArg(containerName)}`;
    this.ssh.exec(cmd, execOptions);
  }

    /**
   * Check if a container exists and is running
   *
   * @param containerName - Name of the container to check
   */
  getContainerStatus(containerName: string): ContainerStatus {
    try {
      // Check if container exists (running or stopped)
      const existsResult = this.ssh.exec(
        `docker ps -a -q -f name=^${quoteShellArg(containerName)}$`,
        { silent: true }
      );
      const exists = existsResult.trim() !== '';

      if (!exists) {
        return { exists: false, running: false };
      }

      // Check if container is running
      const runningResult = this.ssh.exec(
        `docker ps -q -f name=^${quoteShellArg(containerName)}$`,
        { silent: true }
      );
      const running = runningResult.trim() !== '';

      return { exists, running };
    } catch {
      return { exists: false, running: false };
    }
  }

  /**
   * Check if a container is running
   *
   * @param containerName - Name of the container to check
   */
  isContainerRunning(containerName: string): boolean {
    return this.getContainerStatus(containerName).running;
  }

    // ===== Docker Volume Operations =====

  /**
   * Check if a Docker volume exists
   *
   * @param volumeName - Name of the volume to check
   */
  volumeExists(volumeName: string): boolean {
    try {
      this.ssh.exec(`docker volume inspect ${quoteShellArg(volumeName)}`, {
        silent: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a Docker volume
   *
   * @param volumeName - Name of the volume to create
   * @param execOptions - SSH execution options
   */
  volumeCreate(volumeName: string, execOptions: ExecOptions = {}): void {
    const cmd = `docker volume create ${quoteShellArg(volumeName)}`;
    this.ssh.exec(cmd, execOptions);
    logger.debug(`Created Docker volume: ${volumeName}`);
  }

  /**
   * Ensure a Docker volume exists, creating it if necessary
   *
   * @param volumeName - Name of the volume
   * @param execOptions - SSH execution options
   */
  ensureVolume(volumeName: string, execOptions: ExecOptions = {}): void {
    if (!this.volumeExists(volumeName)) {
      this.volumeCreate(volumeName, execOptions);
    }
  }

  // ===== Docker Network Operations =====

        // ===== Health Check Utilities =====

  }

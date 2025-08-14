import { ChildProcess, SpawnOptions, spawn } from 'child_process';

export class ProcessContext {
  spawnReaperForPid(victimPid: number) {
    this.spawnReaperForCommand('kill -- -' + victimPid);
  }

  spawnReaperForCommand(command: string) {
    console.log(
      "Spawning reaper process that will run the command '" +
        command +
        "' as soon as this process with pid " +
        process.pid +
        ' is not active anymore.'
    );
    const proc = this.spawnProcess('node', ['tools/reaper.js', process.pid + '', command]);
    proc.stdout?.pipe(process.stdout);
    proc.stderr?.pipe(process.stderr);
  }

  private spawnProcess(cmd: string, args: string[], options: SpawnOptions = {}) {
    return spawn(cmd, args, { ...options, detached: true });
  }

  public startProcess(cmd: string, args: string[], options: SpawnOptions = {}, notrack?: boolean, noPipe?: boolean) {
    const proc = this.spawnProcess(cmd, args, options);
    if (!noPipe) {
      proc.stdout?.pipe(process.stdout);
      proc.stderr?.pipe(process.stderr);
    }
    if (!notrack && proc.pid != null) {
      console.log('Track process ' + cmd + ' ' + args.join(' ') + ' with pid ' + proc.pid);
      this.spawnReaperForPid(proc.pid);
    }
    return proc;
  }
}

export async function waitForProcessExit(proc: ChildProcess) {
  const result = new Promise<number>((resolve) => {
    proc.on('exit', (code) => {
      resolve(code ?? -1); // null implies a crash due to a signal
    });
  });

  return await result;
}

export async function waitForProcessSuccess(proc: ChildProcess) {
  const code = await waitForProcessExit(proc);
  if (code !== 0) {
    throw new Error('Process did not succeed, code: ' + code);
  }
}

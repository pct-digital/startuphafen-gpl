export function readConfigValueFrom(argv: string[], argName: string) {
  const idx = argv.indexOf(argName);
  if (idx !== -1 && argv.length > idx + 1) {
    return argv[idx + 1];
  } else {
    return null;
  }
}

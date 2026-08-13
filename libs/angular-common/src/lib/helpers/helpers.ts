export function formatDateToGerman(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}-${month}-${year}-${hours}:${minutes}`;
}

export function formatGermanDate(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short' }
): string {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

export function smoothScrollUnlessFirefox(top: number, left: number) {
  // scrolling smoothly will often be interrupted in firefox

  const usingFirefox = window.navigator.userAgent
    .toLowerCase()
    .includes('firefox');
  window.scroll({
    top,
    left,
    behavior: usingFirefox ? 'instant' : 'smooth',
  });
}

export async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

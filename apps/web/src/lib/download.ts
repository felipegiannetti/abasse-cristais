import { ApiError } from './client-api';

/**
 * Downloads a file from the (session-protected) admin API: the cookie rides along, the file name comes from
 * Content-Disposition, and an error answer (JSON {code, message}) is thrown as an ApiError.
 */
export async function downloadFile(path: string): Promise<void> {
  const res = await fetch('/api' + path, { credentials: 'same-origin' });
  if (!res.ok) {
    let code: string | undefined;
    let message = 'Download failed.';
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      code = body.code;
      message = body.message ?? message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status, code);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Helpers for endpoints that return files instead of JSON

// A blob error hides the API's message: it is read back so it can be shown like any other error
export async function readBlobError(err) {
  const body = err.response?.data;
  if (body instanceof Blob) {
    try {
      err.response.data = JSON.parse(await body.text());
    } catch {
      err.response.data = {};
    }
  }
  return err;
}

export function filenameFrom(headers, fallback) {
  const match = /filename="?([^";]+)"?/.exec(headers['content-disposition'] || '');
  return match ? match[1] : fallback;
}

export function saveFile({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// The file name a Content-Disposition header carries, or null when it has none.
//
// A server sends up to two forms. `filename*` is the real name, percent-encoded
// UTF-8. `filename` is the fallback for old clients, with `?` in place of every
// character it cannot hold. RFC 6266: when both are there, the first one wins.
export const fileNameFrom = (disposition) => {
  const header = String(disposition ?? '');

  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Not valid percent-encoding. The plain form is still worth reading.
    }
  }

  // Quoted: may hold `;`, and `\"` for a quote. Never percent-encoded.
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted) return quoted[1].replace(/\\(.)/g, '$1');

  const bare = /filename\s*=\s*([^;]+)/i.exec(header);
  return bare ? bare[1].trim() : null;
};

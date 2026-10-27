const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The UTF-8 bytes of the text. Lone surrogates become U+FFFD, as TextEncoder does. */
const utf8 = (text: string): Uint8Array => {
  // At most 3 bytes per UTF-16 unit: a surrogate pair is 2 units and 4 bytes
  const bytes = new Uint8Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = text.charCodeAt(i + 1); // NaN past the end
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        code = 0xfffd;
      }
    }
    if (code < 0x80) {
      bytes[n++] = code;
    } else if (code < 0x800) {
      bytes[n++] = 0xc0 | (code >> 6);
      bytes[n++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[n++] = 0xe0 | (code >> 12);
      bytes[n++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[n++] = 0x80 | (code & 0x3f);
    } else {
      bytes[n++] = 0xf0 | (code >> 18);
      bytes[n++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[n++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[n++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes.subarray(0, n);
};

/**
 * Base64 of the text's UTF-8 bytes. Written out because React Native's btoa only takes Latin-1
 * and TextEncoder is not available on every engine and version.
 */
export const utf8ToBase64 = (text: string): string => {
  const bytes = utf8(text);
  const chunks: string[] = [];
  let chunk = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    chunk += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
    if (chunk.length >= 16384) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  if (bytes.length - i === 1) {
    const n = bytes[i] << 16;
    chunk += `${ALPHABET[n >> 18]}${ALPHABET[(n >> 12) & 63]}==`;
  } else if (bytes.length - i === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    chunk += `${ALPHABET[n >> 18]}${ALPHABET[(n >> 12) & 63]}${ALPHABET[(n >> 6) & 63]}=`;
  }
  chunks.push(chunk);
  return chunks.join('');
};

export interface XLSXParseOptions {
    sheet?: number | string;
}

export interface XLSXRow {
    [key: string]: string;
}

export interface XLSXParseResult {
    headers: string[];
    rows: XLSXRow[];
    errors: XLSXError[];
}

export interface XLSXError {
    message: string;
}

export interface XLSXStreamOptions extends XLSXParseOptions {
    onRow?: (row: XLSXRow, index: number) => void;
    onError?: (error: XLSXError) => void;
    onEnd?: (result: { totalRows: number; errors: XLSXError[] }) => void;
}

function crc32(buf: Uint8Array): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (~crc) >>> 0;
}

function deflate(data: Uint8Array): Uint8Array {
    const zlib = require('zlib');
    return zlib.deflateRawSync(Buffer.from(data));
}

function inflate(data: Uint8Array): Uint8Array {
    const zlib = require('zlib');
    return zlib.inflateRawSync(Buffer.from(data));
}

interface ZipFiles {
    [name: string]: Uint8Array;
}

function unzip(buffer: ArrayBuffer): ZipFiles {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;
    const files: ZipFiles = {};
    while (offset + 30 <= buffer.byteLength) {
        const sig = view.getUint32(offset, true);
        if (sig !== 0x04034b50) {
            break;
        }
        const compression = view.getUint16(offset + 8, true);
        const compressedSize = view.getUint32(offset + 18, true);
        const uncompressedSize = view.getUint32(offset + 22, true);
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
        const name = new TextDecoder().decode(nameBytes);
        const dataStart = offset + 30 + nameLen + extraLen;
        const dataEnd = dataStart + compressedSize;
        const data = bytes.slice(dataStart, dataEnd);
        let content: Uint8Array;
        if (compression === 0) {
            content = data;
        } else if (compression === 8) {
            content = inflate(data);
        } else {
            throw new Error('Unsupported compression');
        }
        files[name] = content;
        offset = dataEnd;
    }
    return files;
}

function parseSharedStrings(xml: string): string[] {
    const regex = /<t[^>]*>([^<]*)<\/t>/g;
    const strings: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml))) {
        strings.push(match[1]);
    }
    return strings;
}

function parseSheet(xml: string, shared: string[]): string[][] {
    const rows: string[][] = [];
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let r: RegExpExecArray | null;
    while ((r = rowRegex.exec(xml))) {
        const rowXml = r[1];
        const cellRegex = /<c[^>]*?(?: t="([^"]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?<\/c>/g;
        const cells: string[] = [];
        let c: RegExpExecArray | null;
        while ((c = cellRegex.exec(rowXml))) {
            const type = c[1];
            const value = c[2] || '';
            if (type === 's') {
                const idx = parseInt(value, 10);
                cells.push(shared[idx] || '');
            } else {
                cells.push(value);
            }
        }
        rows.push(cells);
    }
    return rows;
}

class XLSXParser {
    private options: Required<XLSXParseOptions>;
    private errors: XLSXError[] = [];
    constructor(options: XLSXParseOptions = {}) {
        this.options = {
            sheet: options.sheet ?? 1,
        };
    }
    private reset(): void {
        this.errors = [];
    }
    private addError(message: string): void {
        this.errors.push({ message });
    }
    parse(buffer: ArrayBuffer): XLSXParseResult {
        this.reset();
        try {
            const files = unzip(buffer);
            const sheetName = `xl/worksheets/sheet${this.options.sheet}.xml`;
            const sheetBytes = files[sheetName];
            if (!sheetBytes) {
                this.addError('Missing worksheet');
                return { headers: [], rows: [], errors: this.errors };
            }
            const sharedBytes = files['xl/sharedStrings.xml'];
            const sharedStrings = sharedBytes
                ? parseSharedStrings(new TextDecoder().decode(sharedBytes))
                : [];
            const rowsRaw = parseSheet(new TextDecoder().decode(sheetBytes), sharedStrings);
            const headers = rowsRaw.shift() || [];
            const rows: XLSXRow[] = rowsRaw.map(row => {
                const obj: XLSXRow = {};
                headers.forEach((h, i) => {
                    obj[h] = row[i] || '';
                });
                return obj;
            });
            return { headers, rows, errors: this.errors };
        } catch (e) {
            this.addError(`Parse error: ${e}`);
            return { headers: [], rows: [], errors: this.errors };
        }
    }
    parseStream(streamOptions: XLSXStreamOptions = {}): { write: (chunk: ArrayBuffer) => void; end: () => void } {
        const chunks: ArrayBuffer[] = [];
        return {
            write: (chunk: ArrayBuffer) => {
                chunks.push(chunk);
            },
            end: () => {
                const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
                const combined = new Uint8Array(total);
                let pos = 0;
                for (const c of chunks) {
                    combined.set(new Uint8Array(c), pos);
                    pos += c.byteLength;
                }
                const result = this.parse(combined.buffer);
                result.rows.forEach((row, idx) => streamOptions.onRow?.(row, idx));
                streamOptions.onEnd?.({ totalRows: result.rows.length, errors: result.errors });
            }
        };
    }
}

export { XLSXParser };

export async function parseXLSX(
    input: ArrayBuffer | File | string,
    options: XLSXParseOptions & {
        stream?: boolean;
        onRow?: (row: XLSXRow, index: number) => void;
        onError?: (error: XLSXError) => void;
        onEnd?: (result: { totalRows: number; errors: XLSXError[] }) => void;
    } = {}
): Promise<XLSXParseResult | void> {
    const { stream, onRow, onEnd, onError, ...opts } = options;
    const useStreaming = stream || onRow || onEnd || onError;
    if (
        input instanceof ArrayBuffer ||
        ArrayBuffer.isView(input) ||
        Object.prototype.toString.call(input) === '[object ArrayBuffer]' ||
        (input && typeof (input as any).byteLength === 'number' && (input as any).buffer)
    ) {
        const arrayBuffer =
            input instanceof ArrayBuffer || Object.prototype.toString.call(input) === '[object ArrayBuffer]'
                ? (input as ArrayBuffer)
                : (input as ArrayBufferView).buffer.slice(
                      (input as ArrayBufferView).byteOffset,
                      (input as ArrayBufferView).byteOffset + (input as ArrayBufferView).byteLength
                  );
        const parser = new XLSXParser(opts);
        if (useStreaming) {
            const st = parser.parseStream({ ...opts, onRow, onEnd, onError });
            st.write(arrayBuffer);
            st.end();
            return;
        } else {
            return parser.parse(arrayBuffer);
        }
    } else if (input instanceof File) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const buffer = reader.result as ArrayBuffer;
                    if (useStreaming) {
                        const parser = new XLSXParser(opts);
                        const st = parser.parseStream({ ...opts, onRow, onEnd, onError });
                        st.write(buffer);
                        st.end();
                        resolve();
                    } else {
                        const parser = new XLSXParser(opts);
                        resolve(parser.parse(buffer));
                    }
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(input);
        });
    } else if (typeof input === 'string') {
        if (typeof window !== 'undefined') {
            throw new Error('File path parsing is not supported in browser environment');
        }
        const fs = await import('fs');
        const buffer = fs.readFileSync(input);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return parseXLSX(arrayBuffer, options as any);
    } else {
        throw new Error('Invalid input type');
    }
}

export async function parseXLSXSimple(
    input: ArrayBuffer | File | string,
    options: XLSXParseOptions = {}
): Promise<XLSXParseResult> {
    const result = await parseXLSX(input, options);
    if (!result) {
        throw new Error('Failed to parse xlsx');
    }
    return result;
}

export async function parseXLSXStream(
    input: File | string,
    callbacks: {
        onRow: (row: XLSXRow, index: number) => void;
        onEnd?: (result: { totalRows: number; errors: XLSXError[] }) => void;
    },
    options: XLSXParseOptions = {}
): Promise<void> {
    await parseXLSX(input as any, { ...options, stream: true, ...callbacks });
}

export function createXLSXParser(options: XLSXParseOptions = {}): XLSXParser {
    return new XLSXParser(options);
}

export interface AvroParseOptions {
    chunkSize?: number;
    encoding?: string;
}

export interface AvroField {
    name: string;
    type: string | AvroType | AvroType[] | AvroField[] | any;
}

export interface AvroSchema {
    type: 'record';
    name: string;
    fields: AvroField[];
}

export interface AvroRow {
    [key: string]: any;
}

export interface AvroParseResult {
    schema: AvroSchema;
    rows: AvroRow[];
    errors: AvroError[];
}

export interface AvroError {
    offset: number;
    message: string;
}

export interface AvroStreamOptions extends AvroParseOptions {
    onRow?: (row: AvroRow, index: number) => void;
    onSchema?: (schema: AvroSchema) => void;
    onError?: (error: AvroError) => void;
    onEnd?: (result: { totalRows: number; errors: AvroError[] }) => void;
}

export enum AvroType {
    NULL = 'null',
    BOOLEAN = 'boolean',
    INT = 'int',
    LONG = 'long',
    FLOAT = 'float',
    DOUBLE = 'double',
    BYTES = 'bytes',
    STRING = 'string',
    RECORD = 'record',
    ENUM = 'enum',
    ARRAY = 'array',
    MAP = 'map',
    UNION = 'union',
    FIXED = 'fixed',
}

class AvroParser {
    private options: Required<AvroParseOptions>;
    private errors: AvroError[] = [];
    private schema: AvroSchema | null = null;
    private rows: AvroRow[] = [];

    constructor(options: AvroParseOptions = {}) {
        this.options = {
            chunkSize: options.chunkSize ?? 8192,
            encoding: options.encoding ?? 'utf-8',
        };
    }

    private reset(): void {
        this.errors = [];
        this.schema = null;
        this.rows = [];
    }

    private addError(message: string, offset: number): void {
        this.errors.push({ offset, message });
    }

    private parseBuffer(buffer: ArrayBuffer): void {
        this.reset();
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        let offset = 0;

        if (bytes.byteLength < 4) {
            this.addError('Buffer too small', offset);
            return;
        }

        if (bytes[0] !== 0x4f || bytes[1] !== 0x62 || bytes[2] !== 0x6a || bytes[3] !== 0x01) {
            this.addError('Invalid magic number', offset);
            return;
        }

        offset = 4;
        if (offset + 4 > bytes.byteLength) {
            this.addError('Unexpected end while reading schema length', offset);
            return;
        }
        const schemaLength = view.getUint32(offset, true);
        offset += 4;
        if (offset + schemaLength > bytes.byteLength) {
            this.addError('Unexpected end while reading schema', offset);
            return;
        }
        const schemaText = new TextDecoder(this.options.encoding).decode(bytes.slice(offset, offset + schemaLength));
        offset += schemaLength;
        try {
            this.schema = JSON.parse(schemaText);
        } catch (e) {
            this.addError('Invalid schema JSON', offset);
            return;
        }

        if (offset + 4 > bytes.byteLength) {
            this.addError('Unexpected end while reading data length', offset);
            return;
        }
        const dataLength = view.getUint32(offset, true);
        offset += 4;
        if (offset + dataLength > bytes.byteLength) {
            this.addError('Unexpected end while reading data', offset);
            return;
        }
        const dataText = new TextDecoder(this.options.encoding).decode(bytes.slice(offset, offset + dataLength));
        offset += dataLength;
        try {
            const arr = JSON.parse(dataText);
            if (Array.isArray(arr)) {
                this.rows = arr;
            } else {
                this.addError('Data is not an array', offset);
            }
        } catch (e) {
            this.addError('Invalid data JSON', offset);
        }
    }

    parse(buffer: ArrayBuffer): AvroParseResult {
        this.parseBuffer(buffer);
        return {
            schema: this.schema ?? { type: 'record', name: 'unknown', fields: [] },
            rows: this.rows,
            errors: this.errors,
        };
    }

    parseStream(streamOptions: AvroStreamOptions = {}): { write: (chunk: ArrayBuffer) => void; end: () => void } {
        const chunks: ArrayBuffer[] = [];
        let totalLength = 0;
        return {
            write: (chunk: ArrayBuffer) => {
                chunks.push(chunk);
                totalLength += chunk.byteLength;
            },
            end: () => {
                const combined = new Uint8Array(totalLength);
                let pos = 0;
                for (const chunk of chunks) {
                    combined.set(new Uint8Array(chunk), pos);
                    pos += chunk.byteLength;
                }
                const result = this.parse(combined.buffer);
                if (result.schema && streamOptions.onSchema) {
                    streamOptions.onSchema(result.schema);
                }
                result.rows.forEach((row, idx) => {
                    streamOptions.onRow?.(row, idx);
                });
                result.errors.forEach(err => streamOptions.onError?.(err));
                streamOptions.onEnd?.({ totalRows: result.rows.length, errors: result.errors });
            },
        };
    }
}

export { AvroParser };

export async function parseAvroFile(file: File, options: AvroParseOptions = {}): Promise<AvroParseResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parser = new AvroParser(options);
                const result = parser.parse(reader.result as ArrayBuffer);
                resolve(result);
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export function parseAvroFileStream(file: File, options: AvroStreamOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const parser = new AvroParser(options);
        const stream = parser.parseStream(options);
        const reader = new FileReader();
        reader.onload = () => {
            try {
                stream.write(reader.result as ArrayBuffer);
                stream.end();
                resolve();
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export async function parseAvroFromPath(filePath: string, options: AvroParseOptions = {}): Promise<AvroParseResult> {
    if (typeof window !== 'undefined') {
        throw new Error('File path parsing is not supported in browser environment');
    }
    try {
        const fs = await import('fs');
        const buffer = fs.readFileSync(filePath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const parser = new AvroParser(options);
        return parser.parse(arrayBuffer);
    } catch (e) {
        throw new Error(`Failed to read avro file: ${e}`);
    }
}

export async function parseAvroFromPathStream(filePath: string, options: AvroStreamOptions = {}): Promise<void> {
    if (typeof window !== 'undefined') {
        throw new Error('File path parsing is not supported in browser environment');
    }
    try {
        const fs = await import('fs');
        const buffer = fs.readFileSync(filePath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const parser = new AvroParser(options);
        const stream = parser.parseStream(options);
        stream.write(arrayBuffer);
        stream.end();
    } catch (e) {
        throw new Error(`Failed to read avro file: ${e}`);
    }
}

export function createAvroParser(options: AvroParseOptions = {}): AvroParser {
    return new AvroParser(options);
}

export async function parseAvro(
    input: ArrayBuffer | File | string,
    options: AvroParseOptions & {
        stream?: boolean;
        onRow?: (row: AvroRow, index: number) => void;
        onSchema?: (schema: AvroSchema) => void;
        onError?: (error: AvroError) => void;
        onEnd?: (result: { totalRows: number; errors: AvroError[] }) => void;
    } = {}
): Promise<AvroParseResult | void> {
    const isStreaming = options.stream || options.onRow || options.onSchema || options.onError || options.onEnd;

    if (input instanceof ArrayBuffer) {
        const parser = new AvroParser(options);
        if (isStreaming) {
            const stream = parser.parseStream(options);
            stream.write(input);
            stream.end();
            return;
        } else {
            return parser.parse(input);
        }
    } else if (input instanceof File) {
        if (isStreaming) {
            await parseAvroFileStream(input, options);
            return;
        } else {
            return await parseAvroFile(input, options);
        }
    } else if (typeof input === 'string') {
        if (isStreaming) {
            await parseAvroFromPathStream(input, options);
            return;
        } else {
            return await parseAvroFromPath(input, options);
        }
    } else {
        throw new Error('Invalid input type. Expected ArrayBuffer, File, or string path.');
    }
}

export async function parseAvroSimple(
    input: ArrayBuffer | File | string,
    options: { chunkSize?: number; encoding?: string } = {}
): Promise<AvroParseResult> {
    const result = await parseAvro(input, options);
    if (!result) {
        throw new Error('Failed to parse avro file');
    }
    return result;
}

export async function parseAvroStream(
    input: File | string,
    callbacks: {
        onRow: (row: AvroRow, index: number) => void;
        onSchema?: (schema: AvroSchema) => void;
        onError?: (error: AvroError) => void;
        onEnd?: (result: { totalRows: number; errors: AvroError[] }) => void;
    },
    options: AvroParseOptions = {}
): Promise<void> {
    await parseAvro(input, { ...options, stream: true, ...callbacks });
}

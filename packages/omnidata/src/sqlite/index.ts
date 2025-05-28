export interface SQLiteParseOptions {
    encoding?: string;
}

export interface SQLiteTable {
    name: string;
    sql: string;
}

export interface SQLiteParseResult {
    tables: SQLiteTable[];
    errors: SQLiteError[];
}

export interface SQLiteError {
    offset: number;
    message: string;
}

export interface SQLiteStreamOptions extends SQLiteParseOptions {
    onTable?: (table: SQLiteTable, index: number) => void;
    onError?: (error: SQLiteError) => void;
    onEnd?: (result: { totalTables: number; errors: SQLiteError[] }) => void;
}

class SQLiteParser {
    private options: Required<SQLiteParseOptions>;
    private buffer: Uint8Array | null = null;
    private errors: SQLiteError[] = [];
    private tables: SQLiteTable[] = [];
    constructor(options: SQLiteParseOptions = {}) {
        this.options = {
            encoding: options.encoding ?? "utf-8",
        };
    }

    private reset() {
        this.buffer = null;
        this.errors = [];
        this.tables = [];
    }

    private addError(message: string, offset: number) {
        this.errors.push({ offset, message });
    }

    private parseHeader(view: DataView) {
        const magic = new TextDecoder("ascii").decode(new Uint8Array(view.buffer, 0, 16));
        if (magic !== "SQLite format 3\0") {
            this.addError("Invalid SQLite header", 0);
            return false;
        }
        return true;
    }

    private parseSchema(text: string) {
        const regex = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?[^;]*;/gi;
        let match: RegExpExecArray | null;
        let index = 0;
        while ((match = regex.exec(text))) {
            const name = match[1];
            const sql = match[0];
            this.tables.push({ name, sql });
            index++;
        }
    }

    parse(buffer: ArrayBuffer): SQLiteParseResult {
        this.reset();
        this.buffer = new Uint8Array(buffer);
        const view = new DataView(buffer);
        if (!this.parseHeader(view)) {
            return { tables: [], errors: this.errors };
        }
        const decoder = new TextDecoder(this.options.encoding);
        const text = decoder.decode(buffer);
        this.parseSchema(text);
        return { tables: this.tables, errors: this.errors };
    }

    parseStream(options: SQLiteStreamOptions = {}) {
        this.reset();
        const chunks: Uint8Array[] = [];
        return {
            write: (chunk: ArrayBuffer) => {
                chunks.push(new Uint8Array(chunk));
            },
            end: () => {
                const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
                const buffer = new Uint8Array(totalLength);
                let offset = 0;
                for (const c of chunks) {
                    buffer.set(c, offset);
                    offset += c.length;
                }
                const result = this.parse(buffer.buffer);
                result.tables.forEach((t, idx) => options.onTable?.(t, idx));
                result.errors.forEach((e) => options.onError?.(e));
                options.onEnd?.({ totalTables: result.tables.length, errors: result.errors });
            },
        };
    }

    // Browser File API
    static async parseFile(file: File, options: SQLiteParseOptions = {}): Promise<SQLiteParseResult> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parser = new SQLiteParser(options);
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

    static parseFileStream(file: File, options: SQLiteStreamOptions = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const parser = new SQLiteParser(options);
            const stream = parser.parseStream(options);
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
}

export { SQLiteParser };

export async function parseSQLiteFile(file: File, options: SQLiteParseOptions = {}): Promise<SQLiteParseResult> {
    return SQLiteParser.parseFile(file, options);
}

export async function parseSQLiteFileStream(file: File, options: SQLiteStreamOptions = {}): Promise<void> {
    await SQLiteParser.parseFileStream(file, options);
}

export async function parseSQLiteFromPath(filePath: string, options: SQLiteParseOptions = {}): Promise<SQLiteParseResult> {
    if (typeof window !== 'undefined') {
        throw new Error('File path parsing is not supported in browser environment');
    }

    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const parser = new SQLiteParser(options);
    return parser.parse(arrayBuffer);
}

export async function parseSQLiteFromPathStream(filePath: string, options: SQLiteStreamOptions = {}): Promise<void> {
    if (typeof window !== 'undefined') {
        throw new Error('File path parsing is not supported in browser environment');
    }

    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const parser = new SQLiteParser(options);
    const stream = parser.parseStream(options);
    stream.write(arrayBuffer);
    stream.end();
}

export function createSQLiteParser(options: SQLiteParseOptions = {}): SQLiteParser {
    return new SQLiteParser(options);
}

export async function parseSQLite(
    input: ArrayBuffer | File | string,
    options: SQLiteParseOptions & {
        stream?: boolean;
        onTable?: (table: SQLiteTable, index: number) => void;
        onError?: (error: SQLiteError) => void;
        onEnd?: (result: { totalTables: number; errors: SQLiteError[] }) => void;
    } = {}
): Promise<SQLiteParseResult | void> {
    const { stream, onTable, onError, onEnd, ...parseOptions } = options;
    const useStream = stream || onTable || onError || onEnd;
    if (input instanceof ArrayBuffer) {
        const parser = new SQLiteParser(parseOptions);
        if (useStream) {
            const s = parser.parseStream({ ...parseOptions, onTable, onError, onEnd });
            s.write(input);
            s.end();
            return;
        }
        return parser.parse(input);
    } else if (input instanceof File) {
        if (useStream) {
            await SQLiteParser.parseFileStream(input, { ...parseOptions, onTable, onError, onEnd });
            return;
        }
        return await SQLiteParser.parseFile(input, parseOptions);
    } else if (typeof input === "string") {
        if (useStream) {
            await parseSQLiteFromPathStream(input, { ...parseOptions, onTable, onError, onEnd });
            return;
        }
        return await parseSQLiteFromPath(input, parseOptions);
    } else {
        throw new Error("Unsupported input type");
    }
}

export async function parseSQLiteSimple(
    input: ArrayBuffer | File | string,
    options: SQLiteParseOptions = {}
): Promise<SQLiteParseResult> {
    const result = await parseSQLite(input, options);
    if (!result) {
        throw new Error("Unexpected streaming mode in simple API");
    }
    return result;
}

export async function parseSQLiteStream(
    input: File | string,
    callbacks: {
        onTable: (table: SQLiteTable, index: number) => void;
        onError?: (error: SQLiteError) => void;
        onEnd?: (result: { totalTables: number; errors: SQLiteError[] }) => void;
    },
    options: SQLiteParseOptions = {}
): Promise<void> {
    await parseSQLite(input, { ...options, stream: true, ...callbacks });
}

export interface CSVParseOptions {
    delimiter?: string;
    quote?: string;
    escape?: string;
    skipEmptyLines?: boolean;
    headers?: boolean | string[];
    encoding?: string;
    chunkSize?: number;
}

export interface CSVRow {
    [key: string]: string;
}

export interface CSVParseResult {
    headers?: string[];
    rows: (string[] | CSVRow)[];
    errors: CSVError[];
}

export interface CSVError {
    line: number;
    column: number;
    message: string;
}

export interface CSVStreamOptions extends CSVParseOptions {
    onRow?: (row: string[] | CSVRow, index: number) => void;
    onHeaders?: (headers: string[]) => void;
    onError?: (error: CSVError) => void;
    onEnd?: (result: { totalRows: number; errors: CSVError[] }) => void;
}

class CSVParser {
    private options: Required<CSVParseOptions>;
    private buffer: string = "";
    private currentLine: number = 1;
    private currentColumn: number = 1;
    private inQuotes: boolean = false;
    private currentField: string = "";
    private currentRow: string[] = [];
    private headers: string[] | null = null;
    private errors: CSVError[] = [];
    private rowIndex: number = 0;
    private bufferIndex: number = 0; // Track position in buffer

    constructor(options: CSVParseOptions = {}) {
        this.options = {
            delimiter: options.delimiter ?? ",",
            quote: options.quote ?? '"',
            escape: options.escape ?? '"',
            skipEmptyLines: options.skipEmptyLines ?? true,
            headers: options.headers ?? false,
            encoding: options.encoding ?? "utf-8",
            chunkSize: options.chunkSize ?? 8192,
        };
    }

    private reset(): void {
        this.buffer = "";
        this.currentLine = 1;
        this.currentColumn = 1;
        this.inQuotes = false;
        this.currentField = "";
        this.currentRow = [];
        this.headers = null;
        this.errors = [];
        this.rowIndex = 0;
        this.bufferIndex = 0;
    }

    private addError(message: string): void {
        this.errors.push({
            line: this.currentLine,
            column: this.currentColumn,
            message,
        });
    }

    private processCharacter(
        char: string,
        streamOptions?: CSVStreamOptions
    ): void {
        const { delimiter, quote, escape } = this.options;

        if (this.inQuotes) {
            if (char === escape) {
                // Check if next character is a quote (escape sequence)
                const nextChar = this.buffer[this.bufferIndex + 1];
                if (nextChar === quote) {
                    // Escaped quote
                    this.currentField += quote;
                    this.currentColumn += 2;
                    this.bufferIndex++; // Skip the next character
                    return;
                }
            }

            if (char === quote) {
                // End of quoted field
                this.inQuotes = false;
                this.currentColumn++;
                return;
            }
        } else {
            if (char === quote) {
                // Start of quoted field
                if (this.currentField.length > 0) {
                    this.addError("Unexpected quote character");
                    // Don't enter quote mode for unexpected quotes
                    this.currentField += char;
                    this.currentColumn++;
                    return;
                }
                this.inQuotes = true;
                this.currentColumn++;
                return;
            } else if (char === delimiter) {
                // Field separator
                this.currentRow.push(this.currentField);
                this.currentField = "";
                this.currentColumn++;
                return;
            } else if (char === "\n" || char === "\r") {
                // End of line
                if (char === "\r") {
                    // Check for \r\n
                    const nextChar = this.buffer[this.bufferIndex + 1];
                    if (nextChar === "\n") {
                        this.bufferIndex++; // Skip the \n
                    }
                }
                this.endRow(streamOptions);
                return;
            }
        }

        this.currentField += char;
        this.currentColumn++;
    }

    private endRow(streamOptions?: CSVStreamOptions): void {
        // Add the last field
        this.currentRow.push(this.currentField);

        // Skip empty lines if configured
        if (
            this.options.skipEmptyLines &&
            this.currentRow.length === 1 &&
            this.currentRow[0] === ""
        ) {
            this.resetRow();
            return;
        }

        // Handle headers
        if (this.options.headers === true && this.headers === null) {
            this.headers = [...this.currentRow];
            if (streamOptions?.onHeaders) {
                streamOptions.onHeaders(this.headers);
            }
        } else if (
            Array.isArray(this.options.headers) &&
            this.headers === null
        ) {
            this.headers = [...this.options.headers];
            if (streamOptions?.onHeaders) {
                streamOptions.onHeaders(this.headers);
            }
            // Process this row as data since we have custom headers
            let row: string[] | CSVRow;

            if (this.headers) {
                // Convert to object if headers are available
                row = {};
                for (let i = 0; i < this.headers.length; i++) {
                    row[this.headers[i]] = this.currentRow[i] || "";
                }
            } else {
                row = [...this.currentRow];
            }

            if (streamOptions?.onRow) {
                streamOptions.onRow(row, this.rowIndex);
            }
            this.rowIndex++;
        } else {
            // Process data row
            let row: string[] | CSVRow;

            if (this.headers) {
                // Convert to object if headers are available
                row = {};
                for (let i = 0; i < this.headers.length; i++) {
                    row[this.headers[i]] = this.currentRow[i] || "";
                }
            } else {
                row = [...this.currentRow];
            }

            if (streamOptions?.onRow) {
                streamOptions.onRow(row, this.rowIndex);
            }
            this.rowIndex++;
        }

        this.resetRow();
    }

    private resetRow(): void {
        this.currentRow = [];
        this.currentField = "";
        this.currentLine++;
        this.currentColumn = 1;
    }

    private processChunk(
        chunk: string,
        streamOptions?: CSVStreamOptions
    ): void {
        this.buffer += chunk;

        this.bufferIndex = 0;
        while (this.bufferIndex < this.buffer.length) {
            const char = this.buffer[this.bufferIndex];
            this.processCharacter(char, streamOptions);
            this.bufferIndex++;
        }

        // Clear the buffer after processing all characters
        this.buffer = "";
        this.bufferIndex = 0;
    }

    private finalize(streamOptions?: CSVStreamOptions): void {
        // Process any remaining data
        if (this.currentField || this.currentRow.length > 0) {
            this.endRow(streamOptions);
        }

        // Check for unclosed quotes
        if (this.inQuotes) {
            this.addError("Unclosed quoted field");
        }

        if (streamOptions?.onEnd) {
            streamOptions.onEnd({
                totalRows: this.rowIndex,
                errors: this.errors,
            });
        }
    }

    // Parse complete string
    parse(input: string): CSVParseResult {
        // Reset parser state for new parse
        this.reset();

        const rows: (string[] | CSVRow)[] = [];

        const streamOptions = {
            onRow: (row: string[] | CSVRow) => rows.push(row),
            onHeaders: (headers: string[]) => {
                this.headers = headers;
            },
        };

        this.processChunk(input, streamOptions);
        this.finalize(streamOptions);

        return {
            headers: this.headers || undefined,
            rows,
            errors: this.errors,
        };
    }

    // Stream parsing for large files
    parseStream(streamOptions: CSVStreamOptions = {}): {
        write: (chunk: string) => void;
        end: () => void;
    } {
        // Reset parser state for new stream
        this.reset();

        return {
            write: (chunk: string) => {
                try {
                    this.processChunk(chunk, streamOptions);
                } catch (error) {
                    if (streamOptions.onError) {
                        streamOptions.onError({
                            line: this.currentLine,
                            column: this.currentColumn,
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error",
                        });
                    }
                }
            },
            end: () => {
                try {
                    this.finalize(streamOptions);
                } catch (error) {
                    if (streamOptions.onError) {
                        streamOptions.onError({
                            line: this.currentLine,
                            column: this.currentColumn,
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error",
                        });
                    }
                }
            },
        };
    }
}

// Utility functions for different environments

// Browser File API support
export async function parseCSVFile(
    file: File,
    options: CSVParseOptions = {}
): Promise<CSVParseResult> {
    return new Promise((resolve, reject) => {
        const parser = new CSVParser(options);
        const rows: (string[] | CSVRow)[] = [];
        let headers: string[] | undefined;
        const errors: CSVError[] = [];

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const result = parser.parse(event.target?.result as string);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file, options.encoding);
    });
}

// Browser streaming support
export function parseCSVFileStream(
    file: File,
    options: CSVStreamOptions = {}
): Promise<void> {
    return new Promise((resolve, reject) => {
        const parser = new CSVParser(options);
        const stream = parser.parseStream(options);

        const reader = file.stream().getReader();
        const decoder = new TextDecoder(options.encoding || "utf-8");

        function pump(): Promise<void> {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    stream.end();
                    resolve();
                    return;
                }

                const chunk = decoder.decode(value, { stream: true });
                stream.write(chunk);
                return pump();
            });
        }

        pump().catch(reject);
    });
}

// Node.js support
export async function parseCSVFromPath(
    filePath: string,
    options: CSVParseOptions = {}
): Promise<CSVParseResult> {
    // Dynamic import for Node.js modules
    const fs = await import("fs");
    const path = await import("path");

    return new Promise((resolve, reject) => {
        fs.readFile(
            filePath,
            { encoding: (options.encoding as BufferEncoding) || "utf-8" },
            (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    const parser = new CSVParser(options);
                    const result = parser.parse(data);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

// Node.js streaming support
export async function parseCSVFromPathStream(
    filePath: string,
    options: CSVStreamOptions = {}
): Promise<void> {
    const fs = await import("fs");

    return new Promise((resolve, reject) => {
        const parser = new CSVParser(options);
        const stream = parser.parseStream(options);

        const readStream = fs.createReadStream(filePath, {
            encoding: (options.encoding as BufferEncoding) || "utf-8",
            highWaterMark: options.chunkSize || 8192,
        });

        readStream.on("data", (chunk: string | Buffer) => {
            const chunkStr =
                typeof chunk === "string"
                    ? chunk
                    : chunk.toString(
                          (options.encoding as BufferEncoding) || "utf-8"
                      );
            stream.write(chunkStr);
        });

        readStream.on("end", () => {
            stream.end();
            resolve();
        });

        readStream.on("error", reject);
    });
}

// Main export
export { CSVParser };

// Convenience function that auto-detects environment
export function createCSVParser(options: CSVParseOptions = {}): CSVParser {
    return new CSVParser(options);
}

// Simple unified API that automatically chooses streaming vs non-streaming
export async function parseCSV(
    input: string | File | string[], // string = CSV text, File = browser file, string = file path for Node.js
    options: CSVParseOptions & {
        stream?: boolean; // Force streaming mode
        onRow?: (row: string[] | CSVRow, index: number) => void; // If provided, uses streaming
        onHeaders?: (headers: string[]) => void;
        onError?: (error: CSVError) => void;
        onEnd?: (result: { totalRows: number; errors: CSVError[] }) => void;
    } = {}
): Promise<CSVParseResult | void> {
    const { stream, onRow, onHeaders, onError, onEnd, ...parseOptions } =
        options;

    // Auto-detect streaming mode
    const useStreaming =
        stream === true || onRow || onHeaders || onError || onEnd;

    if (typeof input === "string") {
        // String input - parse directly
        if (useStreaming) {
            const parser = new CSVParser(parseOptions);
            const streamParser = parser.parseStream({
                ...parseOptions,
                onRow,
                onHeaders,
                onError,
                onEnd,
            });

            streamParser.write(input);
            streamParser.end();
            return; // No return value for streaming
        } else {
            const parser = new CSVParser(parseOptions);
            return parser.parse(input);
        }
    } else if (input instanceof File) {
        // Browser File input
        if (useStreaming) {
            await parseCSVFileStream(input, {
                ...parseOptions,
                onRow,
                onHeaders,
                onError,
                onEnd,
            });
            return; // No return value for streaming
        } else {
            return await parseCSVFile(input, parseOptions);
        }
    } else {
        // Node.js file path (string)
        const filePath = input as unknown as string;
        if (useStreaming) {
            await parseCSVFromPathStream(filePath, {
                ...parseOptions,
                onRow,
                onHeaders,
                onError,
                onEnd,
            });
            return; // No return value for streaming
        } else {
            return await parseCSVFromPath(filePath, parseOptions);
        }
    }
}

// Super simple API for basic use cases
export async function parseCSVSimple(
    input: string | File | string[],
    options: {
        headers?: boolean | string[];
        delimiter?: string;
    } = {}
): Promise<CSVParseResult> {
    const result = await parseCSV(input, {
        headers: options.headers ?? true,
        delimiter: options.delimiter,
        skipEmptyLines: true,
    });

    if (!result) {
        throw new Error("Unexpected streaming mode in simple API");
    }

    return result;
}

// Streaming API for large files
export async function parseCSVStream(
    input: File | string, // File for browser, string path for Node.js
    callbacks: {
        onRow: (row: string[] | CSVRow, index: number) => void;
        onHeaders?: (headers: string[]) => void;
        onError?: (error: CSVError) => void;
        onEnd?: (result: { totalRows: number; errors: CSVError[] }) => void;
    },
    options: CSVParseOptions = {}
): Promise<void> {
    await parseCSV(input, {
        ...options,
        stream: true,
        ...callbacks,
    });
}

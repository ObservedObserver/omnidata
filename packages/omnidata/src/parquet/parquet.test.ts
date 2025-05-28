import {
    ParquetParser,
    createParquetParser,
    parseParquet,
    parseParquetSimple,
    parseParquetStream,
    ParquetDataType,
    ParquetCompression,
    ParquetEncoding,
} from "./index";

describe("Parquet Parser", () => {
    // Helper function to create a minimal valid parquet file buffer
    function createMockParquetBuffer(): ArrayBuffer {
        // Create a minimal parquet file structure
        const buffer = new ArrayBuffer(1024);
        const view = new DataView(buffer);
        const uint8View = new Uint8Array(buffer);
        
        // Write "PAR1" magic number at the beginning
        uint8View[0] = 0x50; // 'P'
        uint8View[1] = 0x41; // 'A'
        uint8View[2] = 0x52; // 'R'
        uint8View[3] = 0x31; // '1'
        
        // Write footer length (4 bytes) at position buffer.length - 8
        view.setUint32(buffer.byteLength - 8, 100, true); // 100 bytes footer
        
        // Write "PAR1" magic number at the end
        uint8View[buffer.byteLength - 4] = 0x50; // 'P'
        uint8View[buffer.byteLength - 3] = 0x41; // 'A'
        uint8View[buffer.byteLength - 2] = 0x52; // 'R'
        uint8View[buffer.byteLength - 1] = 0x31; // '1'
        
        // Add some mock footer data
        const footerStart = buffer.byteLength - 8 - 100;
        for (let i = 0; i < 100; i++) {
            uint8View[footerStart + i] = i % 256;
        }
        
        return buffer;
    }

    function createInvalidParquetBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(100);
        const uint8View = new Uint8Array(buffer);
        
        // Write invalid magic number
        uint8View[0] = 0x49; // 'I'
        uint8View[1] = 0x4E; // 'N'
        uint8View[2] = 0x56; // 'V'
        uint8View[3] = 0x41; // 'A'
        
        return buffer;
    }

    // ========================================
    // SIMPLIFIED API TESTS
    // ========================================

    describe("parseParquetSimple", () => {
        test("should parse valid parquet buffer", async () => {
            const buffer = createMockParquetBuffer();
            
            const result = await parseParquetSimple(buffer);
            
            expect(result.schema).toBeDefined();
            expect(result.schema.version).toBe(1);
            expect(result.rows).toBeDefined();
            expect(Array.isArray(result.errors)).toBe(true);
        });

        test("should handle invalid parquet buffer", async () => {
            const buffer = createInvalidParquetBuffer();
            
            const result = await parseParquetSimple(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message).toContain("Invalid magic number");
        });

        test("should handle custom options", async () => {
            const buffer = createMockParquetBuffer();
            
            const result = await parseParquetSimple(buffer, {
                chunkSize: 4096,
                encoding: "utf-8"
            });
            
            expect(result.schema).toBeDefined();
        });
    });

    describe("parseParquet unified API", () => {
        test("should parse in non-streaming mode by default", async () => {
            const buffer = createMockParquetBuffer();
            
            const result = await parseParquet(buffer);
            
            expect(result).toBeDefined();
            expect(result!.schema).toBeDefined();
            expect(result!.rows).toBeDefined();
            expect(result!.errors).toBeDefined();
        });

        test("should auto-detect streaming mode when onRow is provided", async () => {
            const buffer = createMockParquetBuffer();
            
            const rows: any[] = [];
            let schema: any = null;
            
            const result = await parseParquet(buffer, {
                onSchema: (s) => {
                    schema = s;
                },
                onRow: (row, index) => {
                    rows.push(row);
                },
            });
            
            expect(result).toBeUndefined(); // Streaming mode returns void
            expect(schema).toBeDefined();
        });

        test("should force streaming mode when stream: true", async () => {
            const buffer = createMockParquetBuffer();
            
            const rows: any[] = [];
            
            const result = await parseParquet(buffer, {
                stream: true,
                onRow: (row) => {
                    rows.push(row);
                },
            });
            
            expect(result).toBeUndefined(); // Streaming mode returns void
        });

        test("should handle File input", async () => {
            const buffer = createMockParquetBuffer();
            const file = new File([buffer], "test.parquet", { type: "application/octet-stream" });
            
            const result = await parseParquet(file);
            
            expect(result).toBeDefined();
            expect(result!.schema).toBeDefined();
        });
    });

    describe("parseParquetStream explicit API", () => {
        test("should handle explicit streaming", async () => {
            const buffer = createMockParquetBuffer();
            const file = new File([buffer], "test.parquet", { type: "application/octet-stream" });
            
            const rows: any[] = [];
            let schema: any = null;
            let endCalled = false;
            
            await parseParquetStream(
                file,
                {
                    onSchema: (s) => {
                        schema = s;
                    },
                    onRow: (row, index) => {
                        rows.push(row);
                    },
                    onEnd: (result) => {
                        endCalled = true;
                        expect(result.totalRows).toBeGreaterThanOrEqual(0);
                    },
                }
            );
            
            expect(schema).toBeDefined();
            expect(endCalled).toBe(true);
        });
    });

    // ========================================
    // CORE PARSER TESTS
    // ========================================

    describe("Basic parsing", () => {
        test("should validate parquet magic number", () => {
            const buffer = createMockParquetBuffer();
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.errors).toHaveLength(0);
            expect(result.schema).toBeDefined();
        });

        test("should reject invalid magic number", () => {
            const buffer = createInvalidParquetBuffer();
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message).toContain("Invalid magic number");
        });

        test("should handle empty buffer", () => {
            const buffer = new ArrayBuffer(0);
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test("should handle buffer too small for parquet", () => {
            const buffer = new ArrayBuffer(4); // Only enough for magic number
            const uint8View = new Uint8Array(buffer);
            uint8View[0] = 0x50; // 'P'
            uint8View[1] = 0x41; // 'A'
            uint8View[2] = 0x52; // 'R'
            uint8View[3] = 0x31; // '1'
            
            const parser = createParquetParser();
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe("Schema parsing", () => {
        test("should create default schema for invalid files", () => {
            const buffer = createInvalidParquetBuffer();
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.schema).toBeDefined();
            expect(result.schema.columns).toHaveLength(1);
            expect(result.schema.columns[0].name).toBe("unknown_column");
            expect(result.schema.columns[0].type).toBe(ParquetDataType.BYTE_ARRAY);
        });

        test("should extract schema from valid parquet", () => {
            const buffer = createMockParquetBuffer();
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.schema).toBeDefined();
            expect(result.schema.version).toBe(1);
            expect(result.schema.numRows).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.schema.columns)).toBe(true);
        });
    });

    describe("Options handling", () => {
        test("should use default options", () => {
            const parser = createParquetParser();
            expect(parser).toBeDefined();
        });

        test("should accept custom chunk size", () => {
            const parser = createParquetParser({ chunkSize: 4096 });
            expect(parser).toBeDefined();
        });

        test("should accept custom encoding", () => {
            const parser = createParquetParser({ encoding: "utf-16" });
            expect(parser).toBeDefined();
        });
    });

    describe("Streaming functionality", () => {
        test("should support streaming with callbacks", () => {
            const buffer = createMockParquetBuffer();
            const parser = createParquetParser();
            
            const rows: any[] = [];
            let schema: any = null;
            let errorCount = 0;
            let endCalled = false;
            
            const stream = parser.parseStream({
                onSchema: (s) => {
                    schema = s;
                },
                onRow: (row, index) => {
                    rows.push(row);
                },
                onError: (error) => {
                    errorCount++;
                },
                onEnd: (result) => {
                    endCalled = true;
                }
            });
            
            stream.write(buffer);
            stream.end();
            
            expect(schema).toBeDefined();
            expect(endCalled).toBe(true);
        });

        test("should handle multiple chunks", () => {
            const buffer = createMockParquetBuffer();
            const parser = createParquetParser();
            
            let endCalled = false;
            
            const stream = parser.parseStream({
                onEnd: () => {
                    endCalled = true;
                }
            });
            
            // Split buffer into chunks
            const chunk1 = buffer.slice(0, 512);
            const chunk2 = buffer.slice(512);
            
            stream.write(chunk1);
            stream.write(chunk2);
            stream.end();
            
            expect(endCalled).toBe(true);
        });
    });

    describe("Error handling", () => {
        test("should collect parsing errors", () => {
            const buffer = createInvalidParquetBuffer();
            const parser = createParquetParser();
            
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toHaveProperty("offset");
            expect(result.errors[0]).toHaveProperty("message");
        });

        test("should handle streaming errors", () => {
            const buffer = createInvalidParquetBuffer();
            const parser = createParquetParser();
            
            const errors: any[] = [];
            
            const stream = parser.parseStream({
                onError: (error) => {
                    errors.push(error);
                }
            });
            
            stream.write(buffer);
            stream.end();
            
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe("Data types and enums", () => {
        test("should define ParquetDataType enum", () => {
            expect(ParquetDataType.BOOLEAN).toBe(0);
            expect(ParquetDataType.INT32).toBe(1);
            expect(ParquetDataType.INT64).toBe(2);
            expect(ParquetDataType.FLOAT).toBe(4);
            expect(ParquetDataType.DOUBLE).toBe(5);
            expect(ParquetDataType.BYTE_ARRAY).toBe(6);
        });

        test("should define ParquetCompression enum", () => {
            expect(ParquetCompression.UNCOMPRESSED).toBe(0);
            expect(ParquetCompression.SNAPPY).toBe(1);
            expect(ParquetCompression.GZIP).toBe(2);
            expect(ParquetCompression.BROTLI).toBe(4);
        });

        test("should define ParquetEncoding enum", () => {
            expect(ParquetEncoding.PLAIN).toBe(0);
            expect(ParquetEncoding.RLE).toBe(3);
            expect(ParquetEncoding.BIT_PACKED).toBe(4);
        });
    });

    describe("File operations", () => {
        test("should handle File objects", async () => {
            const buffer = createMockParquetBuffer();
            const file = new File([buffer], "test.parquet", { type: "application/octet-stream" });
            
            const result = await parseParquet(file);
            
            expect(result).toBeDefined();
            expect(result!.schema).toBeDefined();
        });

        test("should reject file path in browser environment", async () => {
            // Mock window object to simulate browser environment
            const originalWindow = global.window;
            (global as any).window = {};
            
            try {
                await expect(parseParquet("/path/to/file.parquet")).rejects.toThrow(
                    "File path parsing is not supported in browser environment"
                );
            } finally {
                global.window = originalWindow;
            }
        });
    });

    describe("Edge cases", () => {
        test("should handle corrupted footer", () => {
            const buffer = createMockParquetBuffer();
            const view = new DataView(buffer);
            
            // Corrupt the footer length
            view.setUint32(buffer.byteLength - 8, 999999, true);
            
            const parser = createParquetParser();
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test("should handle missing trailing magic number", () => {
            const buffer = createMockParquetBuffer();
            const uint8View = new Uint8Array(buffer);
            
            // Corrupt trailing magic number
            uint8View[buffer.byteLength - 1] = 0x00;
            
            const parser = createParquetParser();
            const result = parser.parse(buffer);
            
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test("should handle zero-length footer", () => {
            const buffer = createMockParquetBuffer();
            const view = new DataView(buffer);
            
            // Set footer length to 0
            view.setUint32(buffer.byteLength - 8, 0, true);
            
            const parser = createParquetParser();
            const result = parser.parse(buffer);
            
            // Should still work but with minimal schema
            expect(result.schema).toBeDefined();
        });
    });

    describe("Performance and memory", () => {
        test("should handle large mock buffer", () => {
            const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
            const view = new DataView(largeBuffer);
            const uint8View = new Uint8Array(largeBuffer);
            
            // Set up minimal parquet structure
            uint8View[0] = 0x50; // 'P'
            uint8View[1] = 0x41; // 'A'
            uint8View[2] = 0x52; // 'R'
            uint8View[3] = 0x31; // '1'
            
            view.setUint32(largeBuffer.byteLength - 8, 100, true);
            uint8View[largeBuffer.byteLength - 4] = 0x50; // 'P'
            uint8View[largeBuffer.byteLength - 3] = 0x41; // 'A'
            uint8View[largeBuffer.byteLength - 2] = 0x52; // 'R'
            uint8View[largeBuffer.byteLength - 1] = 0x31; // '1'
            
            const parser = createParquetParser({ chunkSize: 8192 });
            const result = parser.parse(largeBuffer);
            
            expect(result.schema).toBeDefined();
        });

        test("should reset parser state between parses", () => {
            const parser = createParquetParser();
            
            // Parse invalid buffer first
            const invalidBuffer = createInvalidParquetBuffer();
            const result1 = parser.parse(invalidBuffer);
            expect(result1.errors.length).toBeGreaterThan(0);
            
            // Parse valid buffer second
            const validBuffer = createMockParquetBuffer();
            const result2 = parser.parse(validBuffer);
            expect(result2.errors.length).toBe(0);
        });
    });
}); 
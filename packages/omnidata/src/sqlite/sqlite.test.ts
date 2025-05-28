import {
    SQLiteParser,
    createSQLiteParser,
    parseSQLite,
    parseSQLiteSimple,
    parseSQLiteStream,
} from './index';

function createMockSQLiteBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(512);
    const uint8 = new Uint8Array(buffer);
    const encoder = new TextEncoder();
    uint8.set(encoder.encode('SQLite format 3\0'), 0);
    const view = new DataView(buffer);
    view.setUint16(16, 512, false);
    const sql = 'CREATE TABLE test (id INTEGER);';
    uint8.set(encoder.encode(sql), 100);
    return buffer;
}

function createInvalidSQLiteBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(100);
    const encoder = new TextEncoder();
    const uint8 = new Uint8Array(buffer);
    uint8.set(encoder.encode('INVALID'), 0);
    return buffer;
}

describe('SQLite Parser', () => {
    describe('parseSQLiteSimple', () => {
        test('should parse valid sqlite buffer', async () => {
            const buffer = createMockSQLiteBuffer();
            const result = await parseSQLiteSimple(buffer);
            expect(result.tables[0].name).toBe('test');
            expect(result.errors).toHaveLength(0);
        });

        test('should handle invalid buffer', async () => {
            const buffer = createInvalidSQLiteBuffer();
            const result = await parseSQLiteSimple(buffer);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('parseSQLite unified API', () => {
        test('should parse in non-streaming mode by default', async () => {
            const buffer = createMockSQLiteBuffer();
            const result = await parseSQLite(buffer);
            expect(result).toBeDefined();
            expect(result!.tables[0].name).toBe('test');
        });

        test('should auto-detect streaming mode when onTable is provided', async () => {
            const buffer = createMockSQLiteBuffer();
            const tables: any[] = [];
            const result = await parseSQLite(buffer, {
                onTable: (t) => tables.push(t),
            });
            expect(result).toBeUndefined();
            expect(tables[0].name).toBe('test');
        });

        test('should force streaming mode when stream: true', async () => {
            const buffer = createMockSQLiteBuffer();
            const tables: any[] = [];
            const result = await parseSQLite(buffer, {
                stream: true,
                onTable: (t) => tables.push(t),
            });
            expect(result).toBeUndefined();
            expect(tables.length).toBe(1);
        });

        test('should handle File input', async () => {
            const buffer = createMockSQLiteBuffer();
            const file = new File([buffer], 'test.sqlite', { type: 'application/x-sqlite3' });
            const result = await parseSQLite(file);
            expect(result).toBeDefined();
            expect(result!.tables[0].name).toBe('test');
        });
    });

    describe('parseSQLiteStream explicit API', () => {
        test('should handle explicit streaming', async () => {
            const buffer = createMockSQLiteBuffer();
            const file = new File([buffer], 'test.sqlite', { type: 'application/x-sqlite3' });
            const tables: any[] = [];
            let endCalled = false;
            await parseSQLiteStream(
                file,
                {
                    onTable: (t) => tables.push(t),
                    onEnd: () => {
                        endCalled = true;
                    },
                }
            );
            expect(tables.length).toBe(1);
            expect(endCalled).toBe(true);
        });
    });
});
